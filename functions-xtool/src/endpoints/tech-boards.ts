import * as logger from 'firebase-functions/logger'
import {
  CallableRequest,
  HttpsError,
  onCall,
  onRequest,
} from 'firebase-functions/https'
import { defineSecret } from 'firebase-functions/params'
import { onSchedule } from 'firebase-functions/scheduler'
import { getAuth } from 'firebase-admin/auth'
import { recordBatchRun } from '../batch-log'
import { traceRun, traced } from '../cost-trace'
import {
  addBackground,
  attachFile,
  BackgroundInput,
  clearFiles,
  createTechItem,
  deleteBackground,
  fileUrls,
  MAX_FILE_BYTES,
  Editor,
  getMember,
  handleWebhookEvent,
  MondayWebhookEvent,
  searchAddress,
  setupTechWebhooks,
  syncTechBoards,
  TechBoardKey,
  TechBoardsSyncSummary,
  TechEditError,
  TechEditInput,
  updateTechItem,
} from '../tech-boards'
import { db, mondayApiKey } from '../app'
import { endpoint } from '../http'

// 기술지원팀 보드(tech 페이지) — Monday가 원본이고 Firestore(techItems ·
// techBoardMeta)는 캐시다. 화면은 캐시를 규칙으로 직접 읽고(기술팀만), 고칠 때는
// 아래 함수가 Monday에 대신 쓴 뒤 캐시를 맞추고 수정 기록(techEditLogs)을 남긴다.
// 들어오는 변경은 Monday webhook(몇 초)과 정기 동기화(하루 여섯 번, 보조)로 받는다.

// 카카오 로컬 API(주소 검색) — 카카오 개발자 콘솔 > 내 애플리케이션 > 앱 키의
// REST API 키. `firebase functions:secrets:set KAKAO_REST_API_KEY`로 넣는다.
const kakaoApiKey = defineSecret('KAKAO_REST_API_KEY')

// 보드 아홉 개, 합쳐 천 건 남짓 — 보통 1분 안에 끝난다.
const TECH_SYNC_TIMEOUT_SECONDS = 300

/** 토큰의 주인이 기술팀(또는 관리자)인지 — 아니면 거절. 이메일 인증 필수
 * (로그인 화면·Firestore 규칙과 같은 기준). */
async function memberOf(
  token: { email?: string; email_verified?: boolean } | undefined,
  uid: string | undefined,
  admin = false,
): Promise<Editor> {
  if (!uid || !token?.email) {
    throw new HttpsError('unauthenticated', '로그인이 필요해요')
  }
  if (token.email_verified !== true) {
    throw new HttpsError('permission-denied', '메일 인증이 필요해요')
  }
  const member = await getMember(db, token.email)
  // 임시 비밀번호로 들어온 동안(첫 비밀번호를 정하기 전)은 아무것도 못 한다.
  const allowed =
    member?.status === 'active' &&
    member.mustChangePassword !== true &&
    (admin ? member.isAdmin : member.isAdmin || member.teams?.tech === true)
  if (!member || !allowed) {
    throw new HttpsError('permission-denied', '권한이 없는 계정이에요')
  }
  return { email: member.email, name: member.name, uid }
}

const requireMember = (request: CallableRequest<unknown>, admin = false) =>
  memberOf(request.auth?.token, request.auth?.uid, admin)

/** 화면에 보여 줄 오류로 — 입력 오류는 문구 그대로, 그 밖(Monday 실패 등)은
 * 원인을 붙여서. */
function toHttpsError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error
  if (error instanceof TechEditError) {
    return new HttpsError('invalid-argument', error.message)
  }
  const message = error instanceof Error ? error.message : String(error)
  logger.error('기술 보드 수정 실패:', error)
  return new HttpsError('internal', `Monday에 저장하지 못했어요: ${message}`)
}

const assess = (result: TechBoardsSyncSummary) => ({
  partial: result.failedCount > 0,
  note:
    result.failedCount > 0
      ? `보드 ${result.failedCount}개 동기화 실패`
      : undefined,
})

// ────────────────────────────────
// techUpdateItem — item 고치기(이름·진행 단계·컬럼). 기술팀만.
// ────────────────────────────────
export const techUpdateItem = onCall(
  { secrets: [mondayApiKey], timeoutSeconds: 60 },
  traced(
    'techUpdateItem',
    'callable',
    async (request: CallableRequest<TechEditInput>) => {
    const editor = await requireMember(request)
    try {
      const doc = await updateTechItem(
        db,
        mondayApiKey.value(),
        request.data,
        editor,
      )
      return { itemId: doc?.itemId ?? null }
    } catch (error) {
      throw toHttpsError(error)
    }
  }),
)

// ────────────────────────────────
// techCreateItem — 새 item 만들기. 기술팀만.
// ────────────────────────────────
export const techCreateItem = onCall(
  { secrets: [mondayApiKey], timeoutSeconds: 60 },
  traced(
    'techCreateItem',
    'callable',
    async (request: CallableRequest<TechEditInput>) => {
    const editor = await requireMember(request)
    try {
      const doc = await createTechItem(
        db,
        mondayApiKey.value(),
        request.data,
        editor,
      )
      return { itemId: doc?.itemId ?? null }
    } catch (error) {
      throw toHttpsError(error)
    }
  }),
)

// ────────────────────────────────
// techSearchAddress — 주소 검색(Monday 주소 칸에 쓸 좌표 찾기). 기술팀만.
// ────────────────────────────────
export const techSearchAddress = onCall(
  { secrets: [kakaoApiKey], timeoutSeconds: 20 },
  traced(
    'techSearchAddress',
    'callable',
    async (request: CallableRequest<{ query?: string }>) => {
    await requireMember(request)
    try {
      const results = await searchAddress(
        kakaoApiKey.value(),
        String(request.data?.query ?? ''),
      )
      return { results }
    } catch (error) {
      if (error instanceof TechEditError) throw toHttpsError(error)
      logger.error('주소 검색 실패:', error)
      throw new HttpsError('internal', '주소를 찾지 못했어요. 잠시 후 다시 해 주세요')
    }
  }),
)

// ────────────────────────────────
// techUploadFile — 파일 하나를 Monday 파일 칸에 붙인다. 기술팀만.
//   POST(본문 = 파일 그대로, 10MB까지)
//   헤더: Authorization: Bearer <Firebase ID 토큰>, Content-Type: 파일 종류,
//         X-Board-Key · X-Item-Id · X-Column-Id,
//         X-File-Name(encodeURIComponent)
// 호출 함수(onCall)는 JSON이라 base64로 부풀어 10MB를 못 넘겨서 HTTP로 받는다.
// ────────────────────────────────
export const techUploadFile = onRequest(
  { secrets: [mondayApiKey], timeoutSeconds: 120, memory: '512MiB' },
  endpoint(
    { name: 'techUploadFile', method: 'POST' },
    async ({ request, response }) => {
      try {
        const header = request.get('authorization') ?? ''
        const bearer = header.match(/^Bearer (.+)$/)?.[1]
        if (!bearer) throw new HttpsError('unauthenticated', '로그인이 필요해요')
        const decoded = await getAuth()
          .verifyIdToken(bearer)
          .catch(() => {
            throw new HttpsError('unauthenticated', '로그인이 만료됐어요')
          })
        const editor = await memberOf(decoded, decoded.uid)
        const data = request.rawBody ?? Buffer.alloc(0)
        if (data.length > MAX_FILE_BYTES) {
          throw new HttpsError(
            'invalid-argument',
            '10MB보다 큰 파일은 올릴 수 없어요',
          )
        }
        const doc = await attachFile(
          db,
          mondayApiKey.value(),
          {
            boardKey: String(request.get('x-board-key') ?? '') as TechBoardKey,
            itemId: String(request.get('x-item-id') ?? ''),
            columnId: String(request.get('x-column-id') ?? ''),
            fileName: decodeURIComponent(request.get('x-file-name') ?? 'file'),
            contentType: request.get('content-type') ?? '',
            data,
          },
          editor,
        )
        response.status(200).send({ ok: true, itemId: doc?.itemId ?? null })
      } catch (error) {
        const e = toHttpsError(error)
        const status =
          e.code === 'unauthenticated' ? 401 :
            e.code === 'permission-denied' ? 403 :
              e.code === 'invalid-argument' ? 400 : 500
        response.status(status).send({ error: e.message })
      }
    },
  ),
)

// ────────────────────────────────
// techFileUrls — 항목에 붙은 파일의 임시 주소(1시간)·썸네일. 기술팀만.
// ────────────────────────────────
export const techFileUrls = onCall(
  { secrets: [mondayApiKey], timeoutSeconds: 30 },
  async (
    request: CallableRequest<{ itemId?: string; assetIds?: string[] }>,
  ) => {
    await requireMember(request)
    try {
      const files = await fileUrls(
        db,
        mondayApiKey.value(),
        String(request.data?.itemId ?? ''),
        (request.data?.assetIds ?? []).map(String),
      )
      return { files }
    } catch (error) {
      throw toHttpsError(error)
    }
  },
)

// ────────────────────────────────
// techClearFiles — 파일 칸 비우기(모두 지우기). 기술팀만. Monday API에 파일 하나만
// 지우는 기능이 없어 칸 전체를 비운다.
// ────────────────────────────────
export const techClearFiles = onCall(
  { secrets: [mondayApiKey], timeoutSeconds: 60 },
  async (
    request: CallableRequest<{
      boardKey?: string
      itemId?: string
      columnId?: string
    }>,
  ) => {
    const editor = await requireMember(request)
    try {
      const doc = await clearFiles(
        db,
        mondayApiKey.value(),
        {
          boardKey: String(request.data?.boardKey ?? '') as TechBoardKey,
          itemId: String(request.data?.itemId ?? ''),
          columnId: String(request.data?.columnId ?? ''),
        },
        editor,
      )
      return { itemId: doc?.itemId ?? null }
    } catch (error) {
      throw toHttpsError(error)
    }
  },
)

// ────────────────────────────────
// techAddBackground·techDeleteBackground — 설정 > 배경에 사진 올리기·지우기.
// 올린 사진은 기술팀 모두가 골라 쓰고, 지우기는 올린 사람만. 기술팀만.
// ────────────────────────────────
export const techAddBackground = onCall(
  { timeoutSeconds: 30 },
  async (request: CallableRequest<BackgroundInput>) => {
    const editor = await requireMember(request)
    try {
      return await addBackground(db, request.data ?? {}, editor)
    } catch (error) {
      throw toHttpsError(error)
    }
  },
)

export const techDeleteBackground = onCall(
  { timeoutSeconds: 30 },
  async (request: CallableRequest<{ id?: string }>) => {
    const editor = await requireMember(request)
    try {
      await deleteBackground(db, String(request.data?.id ?? ''), editor)
      return { ok: true }
    } catch (error) {
      throw toHttpsError(error)
    }
  },
)

// ────────────────────────────────
// techSyncNow — 지금 바로 전체 동기화(관리자). 하루 여섯 번 자동으로도 돈다.
// ────────────────────────────────
export const techSyncNow = onCall(
  { secrets: [mondayApiKey], timeoutSeconds: TECH_SYNC_TIMEOUT_SECONDS },
  traced('techSyncNow', 'callable', async (request: CallableRequest) => {
    await requireMember(request, true)
    return recordBatchRun(
      db,
      { job: 'tech-boards', codebase: 'xtool', trigger: 'manual' },
      () => syncTechBoards(db, mondayApiKey.value()),
      assess,
    )
  }),
)

// ────────────────────────────────
// techSetupWebhooks — Monday webhook (다시) 만들기(관리자). 처음 한 번, 그리고
// 보드를 바꿨을 때.
// ────────────────────────────────
export const techSetupWebhooks = onCall(
  { secrets: [mondayApiKey], timeoutSeconds: TECH_SYNC_TIMEOUT_SECONDS },
  traced('techSetupWebhooks', 'callable', async (request: CallableRequest) => {
    await requireMember(request, true)
    const project = process.env.GCLOUD_PROJECT
    const url = `https://us-central1-${project}.cloudfunctions.net/mondayTechWebhook`
    const boards = await setupTechWebhooks(db, mondayApiKey.value(), url)
    return { url, boards }
  }),
)

// ────────────────────────────────
// mondayTechWebhook — Monday가 보내는 변경 알림. 처음 등록할 때 오는 challenge는
// 그대로 돌려줘야 등록된다.
// ────────────────────────────────
export const mondayTechWebhook = onRequest(
  { secrets: [mondayApiKey], timeoutSeconds: 60 },
  (request, response) => traceRun(
    { fn: 'mondayTechWebhook', trigger: 'http', method: request.method },
    async (trace) => {
    // 비용 추적(cost-trace.ts) — 응답이 끝나면 로그 한 줄.
    response.on('finish', () => trace.end({
      status: response.statusCode,
      responseBytes: Number(response.getHeader('content-length') ?? 0),
    }))
    if (request.method !== 'POST') {
      response.status(405).send({ error: 'Method Not Allowed' })
      return
    }
    const body = (request.body ?? {}) as {
      challenge?: string
      event?: MondayWebhookEvent
    }
    if (body.challenge) {
      response.status(200).send({ challenge: body.challenge })
      return
    }
    try {
      const result = body.event ?
        await handleWebhookEvent(db, mondayApiKey.value(), body.event) :
        'ignored'
      response.status(200).send({ ok: true, result })
    } catch (error) {
      // Monday는 실패하면 다시 보낸다 — 로그만 남기고 200으로 끝내 재시도 폭주를
      // 막는다(놓친 변경은 정기 동기화가 메운다).
      logger.error('Monday webhook 처리 실패:', body.event, error)
      response.status(200).send({ ok: false })
    }
    }),
)

// ────────────────────────────────
// syncTechBoardsScheduled — Monday 동기화와 같은 시각(09·11·13·15·17·22시 KST).
// webhook이 놓친 변경을 메우는 보조.
// ────────────────────────────────
export const syncTechBoardsScheduled = onSchedule(
  {
    schedule: '0 9,11,13,15,17,22 * * *',
    timeZone: 'Asia/Seoul',
    secrets: [mondayApiKey],
    timeoutSeconds: TECH_SYNC_TIMEOUT_SECONDS,
  },
  traced('syncTechBoardsScheduled', 'schedule', async (event) => {
    try {
      const summary = await recordBatchRun(
        db,
        {
          job: 'tech-boards',
          codebase: 'xtool',
          trigger: 'scheduled',
          scheduledAt: event.scheduleTime,
        },
        () => syncTechBoards(db, mondayApiKey.value()),
        assess,
      )
      logger.info(
        `기술 보드 자동 동기화 완료: 성공 ${summary.okCount}개, ` +
          `실패 ${summary.failedCount}개`,
      )
    } catch (error) {
      logger.error('기술 보드 자동 동기화 실패:', error)
    }
  }),
)

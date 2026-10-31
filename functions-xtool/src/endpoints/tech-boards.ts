import * as logger from 'firebase-functions/logger'
import {
  CallableRequest,
  HttpsError,
  onCall,
  onRequest,
} from 'firebase-functions/https'
import { defineSecret } from 'firebase-functions/params'
import { onSchedule } from 'firebase-functions/scheduler'
import { recordBatchRun } from '../batch-log'
import {
  createTechItem,
  Editor,
  getMember,
  handleWebhookEvent,
  MondayWebhookEvent,
  searchAddress,
  setupTechWebhooks,
  syncTechBoards,
  TechBoardsSyncSummary,
  TechEditError,
  TechEditInput,
  updateTechItem,
} from '../tech-boards'
import { db, mondayApiKey } from '../app'

// 기술지원팀 보드(tech 페이지) — Monday가 원본이고 Firestore(techItems ·
// techBoardMeta)는 캐시다. 화면은 캐시를 규칙으로 직접 읽고(기술팀만), 고칠 때는
// 아래 함수가 Monday에 대신 쓴 뒤 캐시를 맞추고 수정 기록(techEditLogs)을 남긴다.
// 들어오는 변경은 Monday webhook(몇 초)과 정기 동기화(하루 여섯 번, 보조)로 받는다.

// 카카오 로컬 API(주소 검색) — 카카오 개발자 콘솔 > 내 애플리케이션 > 앱 키의
// REST API 키. `firebase functions:secrets:set KAKAO_REST_API_KEY`로 넣는다.
const kakaoApiKey = defineSecret('KAKAO_REST_API_KEY')

// 보드 아홉 개, 합쳐 천 건 남짓 — 보통 1분 안에 끝난다.
const TECH_SYNC_TIMEOUT_SECONDS = 300

/** 로그인한 사람이 기술팀(또는 관리자)인지 — 아니면 거절. 이메일 인증 필수
 * (로그인 화면·Firestore 규칙과 같은 기준). */
async function requireMember(
  request: CallableRequest<unknown>,
  admin = false,
): Promise<Editor> {
  const token = request.auth?.token
  if (!request.auth || !token?.email) {
    throw new HttpsError('unauthenticated', '로그인이 필요해요')
  }
  if (token.email_verified !== true) {
    throw new HttpsError('permission-denied', '메일 인증이 필요해요')
  }
  const member = await getMember(db, token.email)
  const allowed =
    member?.status === 'active' &&
    (admin ? member.isAdmin : member.isAdmin || member.teams?.tech === true)
  if (!member || !allowed) {
    throw new HttpsError('permission-denied', '권한이 없는 계정이에요')
  }
  return { email: member.email, name: member.name, uid: request.auth.uid }
}

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
  },
)

// ────────────────────────────────
// techCreateItem — 새 item 만들기. 기술팀만.
// ────────────────────────────────
export const techCreateItem = onCall(
  { secrets: [mondayApiKey], timeoutSeconds: 60 },
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
  },
)

// ────────────────────────────────
// techSearchAddress — 주소 검색(Monday 주소 칸에 쓸 좌표 찾기). 기술팀만.
// ────────────────────────────────
export const techSearchAddress = onCall(
  { secrets: [kakaoApiKey], timeoutSeconds: 20 },
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
  },
)

// ────────────────────────────────
// techSyncNow — 지금 바로 전체 동기화(관리자). 하루 여섯 번 자동으로도 돈다.
// ────────────────────────────────
export const techSyncNow = onCall(
  { secrets: [mondayApiKey], timeoutSeconds: TECH_SYNC_TIMEOUT_SECONDS },
  async (request) => {
    await requireMember(request, true)
    return recordBatchRun(
      db,
      { job: 'tech-boards', codebase: 'xtool', trigger: 'manual' },
      () => syncTechBoards(db, mondayApiKey.value()),
      assess,
    )
  },
)

// ────────────────────────────────
// techSetupWebhooks — Monday webhook (다시) 만들기(관리자). 처음 한 번, 그리고
// 보드를 바꿨을 때.
// ────────────────────────────────
export const techSetupWebhooks = onCall(
  { secrets: [mondayApiKey], timeoutSeconds: 120 },
  async (request) => {
    await requireMember(request, true)
    const project = process.env.GCLOUD_PROJECT
    const url = `https://us-central1-${project}.cloudfunctions.net/mondayTechWebhook`
    const boards = await setupTechWebhooks(db, mondayApiKey.value(), url)
    return { url, boards }
  },
)

// ────────────────────────────────
// mondayTechWebhook — Monday가 보내는 변경 알림. 처음 등록할 때 오는 challenge는
// 그대로 돌려줘야 등록된다.
// ────────────────────────────────
export const mondayTechWebhook = onRequest(
  { secrets: [mondayApiKey], timeoutSeconds: 60 },
  async (request, response) => {
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
  },
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
  async (event) => {
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
  },
)

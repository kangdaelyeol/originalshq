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
  ASSIGNEE_BOARDS,
  attachFile,
  BackgroundInput,
  clearFiles,
  copyAssignees,
  copyPhonesFromNames,
  createItemUpdate,
  createTechItem,
  deleteTechItems,
  fetchItemUpdates,
  findTechBoard,
  refreshItemUpdates,
  deleteBackground,
  fileUrls,
  MAX_FILE_BYTES,
  Editor,
  getMember,
  handleWebhookEvent,
  MAX_DELETE,
  MondayWebhookEvent,
  refreshItems,
  searchAddress,
  setupTechWebhooks,
  checkColumnNames,
  checkInstallItems,
  getInquiryNotify,
  sendInquiryTest,
  setInquiryNotify,
  syncTechBoard,
  syncTechBoards,
  TechBoardKey,
  TechBoardsSyncSummary,
  TechEditError,
  TechEditInput,
  updateTechItem,
} from '../tech-boards'
import { db, mondayApiKey } from '../app'
import { endpoint } from '../http'
import {
  sendChannelText,
  sendUserText,
  WORKS_CHANNEL_LABELS,
  WORKS_CHANNELS,
  WORKS_SECRETS,
  WorksChannel,
  WorksError,
} from '../works'

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
      const { doc, conflicts, createdSubitems } = await updateTechItem(
        db,
        mondayApiKey.value(),
        request.data,
        editor,
      )
      // conflicts — 다른 사람이 먼저 바꿔서 쓰지 않은 칸(화면이 알리고 덮을지 묻는다).
      // createdSubitems — 만든 하위 줄 id(화면이 "만드는 중" 줄에 고친 것을 이어 보낸다).
      return { itemId: doc?.itemId ?? null, conflicts, createdSubitems }
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
      const { doc, createdSubitems } = await createTechItem(
        db,
        mondayApiKey.value(),
        request.data,
        editor,
      )
      return { itemId: doc?.itemId ?? null, createdSubitems }
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
// techDeleteItems — item 여러 개 지우기(Monday 표 선택 막대). 기술팀만. Monday
// 휴지통으로 간다. 한 번에 MAX_DELETE개까지 — 화면이 나눠 보낸다.
// ────────────────────────────────
export const techDeleteItems = onCall(
  { secrets: [mondayApiKey], timeoutSeconds: 120 },
  traced(
    'techDeleteItems',
    'callable',
    async (
      request: CallableRequest<{ boardKey: TechBoardKey; itemIds: string[] }>,
    ) => {
      const editor = await requireMember(request)
      const ids = request.data?.itemIds
      if (
        !findTechBoard({ key: String(request.data?.boardKey ?? '') }) ||
        !Array.isArray(ids) ||
        ids.length === 0 ||
        ids.length > MAX_DELETE ||
        ids.some((id) => typeof id !== 'string' || !/^\d+$/.test(id))
      ) {
        throw new HttpsError('invalid-argument', '지울 항목이 올바르지 않아요')
      }
      try {
        return await deleteTechItems(
          db,
          mondayApiKey.value(),
          request.data.boardKey,
          ids,
          editor,
        )
      } catch (error) {
        throw toHttpsError(error)
      }
    },
  ),
)

// ────────────────────────────────
// techItemUpdates·techCreateUpdate — item 업데이트(Monday 댓글) 읽기·쓰기. 기술팀만,
// 업데이트를 세는 보드(출장·아톡문의)의 우리 캐시에 있는 item만.
// ────────────────────────────────
async function updatesTarget(data: { boardKey?: string; itemId?: string }) {
  const source = findTechBoard({ key: String(data?.boardKey ?? '') })
  const itemId = String(data?.itemId ?? '')
  if (!source?.updates || !/^\d+$/.test(itemId)) {
    throw new HttpsError('invalid-argument', '업데이트를 볼 수 없는 항목이에요')
  }
  const cached = await db.collection('techItems').doc(itemId).get()
  if (cached.data()?.boardKey !== source.key) {
    throw new HttpsError('not-found', '보드에 없는 항목이에요')
  }
  return { source, itemId }
}

export const techItemUpdates = onCall(
  { secrets: [mondayApiKey], timeoutSeconds: 30 },
  traced(
    'techItemUpdates',
    'callable',
    async (request: CallableRequest<{ boardKey: string; itemId: string }>) => {
      await requireMember(request)
      const { source, itemId } = await updatesTarget(request.data)
      try {
        // 읽은 목록을 캐시에도 쓴다 — 다음에 패널을 열면 바로 보인다.
        const updates = await refreshItemUpdates(
          db,
          mondayApiKey.value(),
          source.key,
          itemId,
        )
        return { updates }
      } catch (error) {
        // 읽기라 "저장하지 못했어요"(toHttpsError)가 아니라 읽기 실패로 알린다.
        logger.error('업데이트 읽기 실패:', error)
        const message = error instanceof Error ? error.message : String(error)
        throw new HttpsError(
          'internal',
          `Monday에서 업데이트를 읽지 못했어요: ${message}`,
        )
      }
    },
  ),
)

export const techCreateUpdate = onCall(
  { secrets: [mondayApiKey], timeoutSeconds: 30 },
  traced(
    'techCreateUpdate',
    'callable',
    async (
      request: CallableRequest<{
        boardKey: string
        itemId: string
        text: string
        parentId?: string | null
      }>,
    ) => {
      const editor = await requireMember(request)
      const { source, itemId } = await updatesTarget(request.data)
      const parentId = request.data?.parentId ?
        String(request.data.parentId) :
        null
      let id: string
      try {
        // 답글은 이 item의 업데이트에만 — 다른 보드의 업데이트에 달지 못하게.
        if (parentId) {
          const updates = await fetchItemUpdates(mondayApiKey.value(), itemId)
          if (!updates.some((update) => update.id === parentId)) {
            throw new HttpsError(
              'invalid-argument',
              '답글을 달 업데이트를 찾지 못했어요',
            )
          }
        }
        id = await createItemUpdate(
          mondayApiKey.value(),
          itemId,
          String(request.data?.text ?? ''),
          editor.name || editor.email,
          parentId,
        )
      } catch (error) {
        throw toHttpsError(error)
      }
      // 말풍선 개수와 업데이트 캐시를 바로 맞춘다 — 실패해도 글은 올라갔으니 성공으로
      // 돌려준다(webhook·정기 동기화가 곧 맞춘다). 실패로 돌려주면 다시 눌러 같은 글이
      // 두 번 올라간다.
      await Promise.all([
        refreshItems(db, mondayApiKey.value(), source, [itemId]).catch(
          (error) => logger.warn(`업데이트 개수 갱신 실패(${itemId}):`, error),
        ),
        refreshItemUpdates(db, mondayApiKey.value(), source.key, itemId).catch(
          (error) => logger.warn(`업데이트 캐시 갱신 실패(${itemId}):`, error),
        ),
      ])
      return { id }
    },
  ),
)

// ────────────────────────────────
// techCopyPhones — 출장업무 item 이름에서 번호를 뽑아 "전화번호" 칸에 복사(관리자).
// 이름은 그대로 둔다. 칸이 없으면 이름 칸 옆에 만들고, 이미 채워진 건은 건너뛴다.
// dryRun이면 무엇을 할지만 돌려준다. 끝나면 그 보드를 다시 동기화해 새 칸을 캐시에
// 넣는다. 그 뒤로 새로 만든 건은 webhook이 채운다(tech-boards/phones.ts).
// ────────────────────────────────
// 화면에 돌려줄 목록 길이 — 나머지는 건수만
const PHONE_LIST_LIMIT = 50

export const techCopyPhones = onCall(
  { secrets: [mondayApiKey], timeoutSeconds: TECH_SYNC_TIMEOUT_SECONDS },
  traced(
    'techCopyPhones',
    'callable',
    async (request: CallableRequest<{ dryRun?: boolean }>) => {
      await requireMember(request, true)
      const source = findTechBoard({ key: 'fieldService' })
      if (!source) throw new HttpsError('not-found', '출장업무 보드가 없어요')
      const dryRun = request.data?.dryRun !== false
      try {
        const result = await copyPhonesFromNames(
          mondayApiKey.value(),
          source,
          dryRun,
        )
        // 새 칸이 캐시(meta)에 들어가야 webhook 자동 채우기가 동작한다 — 실패하면 알린다.
        const sync = dryRun ?
          null :
          await syncTechBoard(db, mondayApiKey.value(), source)
        return {
          ...result,
          dryRun,
          sync: sync ? { ok: sync.ok, error: sync.error ?? null } : null,
          targetCount: result.targets.length,
          noPhoneCount: result.noPhone.length,
          targets: result.targets.slice(0, PHONE_LIST_LIMIT),
          noPhone: result.noPhone.slice(0, PHONE_LIST_LIMIT),
          errors: result.errors.slice(0, PHONE_LIST_LIMIT),
        }
      } catch (error) {
        throw toHttpsError(error)
      }
    },
  ),
)

// ────────────────────────────────
// techCheckInstallItems — 출장업무 설치 품목 점검·채워넣기(관리자). 설치 품목은 하위 줄 품명을
// 비추는 미러 칸이라 품명이 "{이름} {수량}개"와 다른 하위 줄을 찾아 고친다. dryRun이면 점검만.
// 시간이 모자라면 remaining을 돌려주고 — 다시 부르면 이어서 고친다. 고쳤으면 보드를 다시
// 동기화해 캐시를 맞춘다(tech-boards/install-items.ts).
// ────────────────────────────────
// 화면에 돌려줄 목록 길이 — 나머지는 건수만
const INSTALL_LIST_LIMIT = 50

export const techCheckInstallItems = onCall(
  { secrets: [mondayApiKey], timeoutSeconds: TECH_SYNC_TIMEOUT_SECONDS },
  traced(
    'techCheckInstallItems',
    'callable',
    async (request: CallableRequest<{ dryRun?: boolean }>) => {
      await requireMember(request, true)
      const source = findTechBoard({ key: 'fieldService' })
      if (!source) throw new HttpsError('not-found', '출장업무 보드가 없어요')
      const dryRun = request.data?.dryRun !== false
      try {
        const result = await checkInstallItems(
          mondayApiKey.value(),
          source,
          dryRun,
        )
        const sync = dryRun || result.written === 0 ?
          null :
          await syncTechBoard(db, mondayApiKey.value(), source)
        return {
          ...result,
          dryRun,
          sync: sync ? { ok: sync.ok, error: sync.error ?? null } : null,
          mismatchCount: result.mismatches.length,
          mirrorOnlyCount: result.mirrorOnly.length,
          mismatches: result.mismatches.slice(0, INSTALL_LIST_LIMIT),
          mirrorOnly: result.mirrorOnly.slice(0, INSTALL_LIST_LIMIT),
          errors: result.errors.slice(0, INSTALL_LIST_LIMIT),
        }
      } catch (error) {
        throw toHttpsError(error)
      }
    },
  ),
)

// ────────────────────────────────
// techCheckColumns — 칸 이름 점검(관리자). 코드가 칸·그룹·라벨을 이름으로 찾는 곳 중
// 보드에 없는 것을 보드마다 돌려준다(tech-boards/column-check.ts). Monday에서 칸
// 이름을 바꾸거나 지운 뒤 동기화하고 본다 — 캐시(Firestore)만 읽고 Monday는 부르지
// 않는다.
// ────────────────────────────────
export const techCheckColumns = onCall(
  { timeoutSeconds: 60 },
  traced('techCheckColumns', 'callable', async (request: CallableRequest) => {
    await requireMember(request, true)
    return { boards: await checkColumnNames(db) }
  }),
)

// ────────────────────────────────
// techInquiryNotify — 아톡문의 새 문의 웍스 알림 설정(관리자). get: 지금 설정,
// set: 켜고 끄기·채널 ID 저장, test: 저장한 채널로 예시 메시지. 알림은 webhook이
// 보낸다(tech-boards/inquiry-notify.ts).
// ────────────────────────────────
interface InquiryNotifyInput {
  action?: 'get' | 'set' | 'test'
  enabled?: boolean
  channelId?: string | null
}

export const techInquiryNotify = onCall(
  { secrets: WORKS_SECRETS, timeoutSeconds: 30 },
  traced(
    'techInquiryNotify',
    'callable',
    async (request: CallableRequest<InquiryNotifyInput>) => {
      const editor = await requireMember(request, true)
      const action = request.data?.action ?? 'get'
      if (action === 'set') {
        const channelId = String(request.data?.channelId ?? '').trim()
        if (channelId && !WORKS_CHANNEL_ID.test(channelId)) {
          throw new HttpsError(
            'invalid-argument',
            '채널 ID에 빈칸·빗금 없이 적어 주세요',
          )
        }
        const enabled = request.data?.enabled === true
        if (enabled && !channelId) {
          throw new HttpsError(
            'invalid-argument',
            '알림을 켜려면 채널 ID를 적어 주세요',
          )
        }
        return {
          settings: await setInquiryNotify(
            db,
            { enabled, channelId: channelId || null },
            editor.name,
          ),
        }
      }
      if (action === 'test') {
        const source = findTechBoard({ key: 'techInquiry' })
        if (!source) throw new HttpsError('not-found', '아톡문의 보드가 없어요')
        try {
          await sendInquiryTest(db, source)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          throw new HttpsError('failed-precondition', message)
        }
      }
      return { settings: await getInquiryNotify(db) }
    },
  ),
)

// ────────────────────────────────
// techWorksTest — 네이버 웍스 봇 연결 확인(관리자). 확인 메시지를 하나 보낸다 — 나에게
// 1:1(userId — 웍스 아이디), 채널 ID를 직접 적은 채팅방(channelId), 정해 둔 채팅방
// (channel) 중 하나. 비밀 값 5개(WORKS_*)·봇 초대가 맞는지 알림을 켜기 전에 본다.
// 비밀 값을 넣기 전에는 이 함수만 배포되지 않는다(다른 함수는 웍스 비밀 값을 안 쓴다).
// ────────────────────────────────
// 웍스 아이디·채널 ID — 빈칸·빗금 없이 적당한 길이만 본다(주소에는 encodeURIComponent로
// 넣는다). 웍스 아이디는 로그인 아이디(name@도메인)나 구성원 ID(UUID) 둘 다 받는다 —
// 맞는 아이디인지는 웍스가 판단한다(틀리면 웍스 오류가 그대로 보인다).
const WORKS_USER_ID = /^[^\s/]{2,128}$/
const WORKS_CHANNEL_ID = /^[^\s/]{8,128}$/

interface WorksTestInput {
  channel?: string
  channelId?: string
  userId?: string
}

export const techWorksTest = onCall(
  { secrets: WORKS_SECRETS, timeoutSeconds: 30 },
  traced(
    'techWorksTest',
    'callable',
    async (request: CallableRequest<WorksTestInput>) => {
      const editor = await requireMember(request, true)
      const userId = String(request.data?.userId ?? '').trim()
      const channelId = String(request.data?.channelId ?? '').trim()
      const channel = String(request.data?.channel ?? 'tech')
      let send: (text: string) => Promise<void>
      let label: string
      if (userId) {
        if (!WORKS_USER_ID.test(userId)) {
          throw new HttpsError(
            'invalid-argument',
            '웍스 아이디에 빈칸·빗금 없이 적어 주세요',
          )
        }
        send = (text) => sendUserText(userId, text)
        label = `${userId}(1:1)`
      } else if (channelId) {
        if (!WORKS_CHANNEL_ID.test(channelId)) {
          throw new HttpsError(
            'invalid-argument',
            '채널 ID에 빈칸·빗금 없이 적어 주세요',
          )
        }
        send = (text) => sendChannelText(channelId, text)
        label = '적은 채팅방'
      } else {
        if (!(channel in WORKS_CHANNELS)) {
          throw new HttpsError('invalid-argument', '모르는 채팅방이에요')
        }
        const key = channel as WorksChannel
        send = (text) => sendChannelText(WORKS_CHANNELS[key], text)
        label = WORKS_CHANNEL_LABELS[key]
      }
      const now = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
      })
      try {
        await send(`[xtool] 웍스 연결 확인 메시지예요.\n${editor.name} · ${now}`)
      } catch (error) {
        if (error instanceof WorksError) {
          throw new HttpsError('failed-precondition', error.message)
        }
        logger.error('웍스 연결 확인 실패:', error)
        throw new HttpsError('internal', '웍스에 보내지 못했어요')
      }
      return { ok: true, channel: label }
    },
  ),
)

// ────────────────────────────────
// techCopyAssignees — 원래 담당자(Monday 사람 칸)를 담당자(엑스툴) 글자 칸으로 복사
// (관리자, 보드 하나씩). 칸이 없으면 담당자 칸 옆에 만들고, 이미 채워진 건은 건너뛴다.
// dryRun이면 무엇을 할지만 돌려준다. 시간이 모자라면 remaining을 돌려주고 — 다시 부르면
// 이어서 쓴다. 다 쓰면 그 보드를 다시 동기화해 새 칸과 담당자를 캐시에 넣는다
// (tech-boards/assignees.ts).
// ────────────────────────────────
export const techCopyAssignees = onCall(
  { secrets: [mondayApiKey], timeoutSeconds: TECH_SYNC_TIMEOUT_SECONDS },
  traced(
    'techCopyAssignees',
    'callable',
    async (
      request: CallableRequest<{ boardKey?: string; dryRun?: boolean }>,
    ) => {
      await requireMember(request, true)
      const key = String(request.data?.boardKey ?? '')
      const source = findTechBoard({ key })
      if (!source || !ASSIGNEE_BOARDS.includes(source.key)) {
        throw new HttpsError('invalid-argument', '담당자 칸이 있는 보드가 아니에요')
      }
      const dryRun = request.data?.dryRun !== false
      try {
        const result = await copyAssignees(
          mondayApiKey.value(),
          source,
          dryRun,
        )
        const sync = dryRun || result.remaining > 0 ?
          null :
          await syncTechBoard(db, mondayApiKey.value(), source)
        return {
          ...result,
          boardKey: source.key,
          dryRun,
          sync: sync ? { ok: sync.ok, error: sync.error ?? null } : null,
          targetCount: result.targets.length,
          targets: result.targets.slice(0, PHONE_LIST_LIMIT),
          errors: result.errors.slice(0, PHONE_LIST_LIMIT),
        }
      } catch (error) {
        throw toHttpsError(error)
      }
    },
  ),
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
// 웍스 비밀 값 — 아톡문의 새 문의 알림(tech-boards/inquiry-notify.ts)을 보낸다.
export const mondayTechWebhook = onRequest(
  { secrets: [mondayApiKey, ...WORKS_SECRETS], timeoutSeconds: 60 },
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

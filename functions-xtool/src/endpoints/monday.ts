import * as logger from 'firebase-functions/logger'
import { onRequest } from 'firebase-functions/https'
import { onSchedule } from 'firebase-functions/scheduler'
import { readGaTracking, saveGaSyncError, syncGaEvents } from '../ga-sync'
import { recordBatchRun } from '../batch-log'
import { traced } from '../cost-trace'
import {
  deleteBoard,
  fetchItemUpdates,
  getAttributionRows,
  getCustomer,
  getDailyInflow,
  getDailySales,
  getFollowUps,
  getDailyRepeatRevenue,
  getKpiFacts,
  getTechFacts,
  hasSyncedItem,
  listBoards,
  listCustomerSummaries,
  listMissingPhoneItems,
  listPaymentIssues,
  listWorkspaceBoards,
  listWorkspaces,
  previewBoard,
  readLeadFeed,
  rebuildCustomers,
  rebuildCustomersSafely,
  registerBoard,
  syncBoards,
} from '../monday'
import {
  validateRegisterMondayBoard,
  validateRemoveMondayBoard,
  validateSyncMondayBoards,
} from '../validation'
import { db, mondayApiKey } from '../app'
import { endpoint } from '../http'

// 보드 16개 · 약 1만 건을 받아 쓰는 작업 — 4개씩 같이 돌려 보통 1~2분이면
// 끝나지만, Monday 응답이 느린 날을 대비해 넉넉히 둔다.
const MONDAY_SYNC_TIMEOUT_SECONDS = 540

// 여러 보드의 응답(보드당 수 MB JSON)을 동시에 들고 있어 기본 256MB로는 부족하다.
const MONDAY_SYNC_MEMORY = '1GiB'

// ────────────────────────────────
// listMondayBoards — 등록된 보드와 각 보드의 마지막 동기화 결과
// ────────────────────────────────
export const listMondayBoards = onRequest(
  endpoint(
    { name: 'listMondayBoards', method: 'GET', admin: true },
    async ({ response }) => {
      const boards = await listBoards(db)
      response.status(200).send({ boards, count: boards.length })
    },
  ),
)

// ────────────────────────────────
// previewMondayBoard — 보드 하나를 읽어 저장될 모양만 보여준다(DB에 안 씀).
//   GET ?boardId=5031196508&phoneColumnId=text_xxx&samples=3
// phoneColumnId를 생략하면 자동 추정, samples는 예시 문서 수(기본 3, 최대 50).
// ────────────────────────────────
export const previewMondayBoard = onRequest(
  { secrets: [mondayApiKey], timeoutSeconds: 120 },
  endpoint(
    {
      name: 'previewMondayBoard',
      admin: true,
      method: 'GET',
      onError: (error, response) => {
        // 확인용 엔드포인트라 원인(보드 id 오타, 권한, GraphQL 오류)을 그대로
        // 돌려준다.
        response.status(502).send({
          error: error instanceof Error ? error.message : String(error),
        })
      },
    },
    async ({ request, response }) => {
      const validationRes = validateRegisterMondayBoard(request.query)
      if (!validationRes.ok) {
        response.status(400).send({ error: validationRes.error })
        return
      }

      const { boardId, phoneColumnId } = validationRes.data
      const samples = Math.min(
        Math.max(Number(request.query.samples ?? 3) || 0, 0),
        50,
      )
      const preview = await previewBoard(
        mondayApiKey.value(),
        boardId,
        phoneColumnId,
        samples,
      )
      response.status(200).send(preview)
    },
  ),
)

// ────────────────────────────────
// listMondayWorkspaceBoards — 워크스페이스의 보드 전부를 Monday에서 바로 읽어
// 보여준다(DB에 안 씀). 등록 여부와 상관없이 본다.
//   GET                       → 워크스페이스 목록
//   GET ?workspace=기술팀&samples=3 → 이름에 '기술팀'이 들어간 워크스페이스의
//                               보드·컬럼·그룹·item 수·예시 item
//   workspaceId=123 으로 id를 직접 줘도 된다. samples 기본 3, 최대 20.
// ────────────────────────────────
export const listMondayWorkspaceBoards = onRequest(
  { secrets: [mondayApiKey], timeoutSeconds: 120 },
  endpoint(
    {
      name: 'listMondayWorkspaceBoards',
      admin: true,
      method: 'GET',
      onError: (error, response) => {
        response.status(502).send({
          error: error instanceof Error ? error.message : String(error),
        })
      },
    },
    async ({ request, response }) => {
      const apiKey = mondayApiKey.value()
      const workspaces = await listWorkspaces(apiKey)
      const id = String(request.query.workspaceId ?? '').trim()
      const name = String(request.query.workspace ?? '').trim()
      if (!id && !name) {
        response.status(200).send({ workspaces })
        return
      }

      const matched = workspaces.filter((w) =>
        id ? String(w.id) === id : w.name.includes(name),
      )
      if (matched.length !== 1) {
        response.status(matched.length ? 409 : 404).send({
          error: matched.length
            ? '워크스페이스가 여러 개 맞습니다 — workspaceId로 골라 주세요'
            : '맞는 워크스페이스가 없습니다',
          workspaces: matched.length ? matched : workspaces,
        })
        return
      }

      const samples = Math.min(
        Math.max(Number(request.query.samples ?? 3) || 0, 0),
        20,
      )
      const boards = await listWorkspaceBoards(apiKey, matched[0].id, samples)
      response
        .status(200)
        .send({ workspace: matched[0], boards, count: boards.length })
    },
  ),
)

// ────────────────────────────────
// registerMondayBoard — 보드를 동기화 대상으로 등록하고 바로 한 번 가져온다
// ────────────────────────────────
export const registerMondayBoard = onRequest(
  {
    secrets: [mondayApiKey],
    timeoutSeconds: MONDAY_SYNC_TIMEOUT_SECONDS,
    memory: MONDAY_SYNC_MEMORY,
  },
  endpoint(
    {
      name: 'registerMondayBoard',
      admin: true,
      method: 'POST',
      validate: validateRegisterMondayBoard,
    },
    async ({ response, data }) => {
      const { boardId, phoneColumnId } = data
      const board = await registerBoard(
        db,
        mondayApiKey.value(),
        boardId,
        phoneColumnId,
      )

      // 등록 자체는 됐지만 첫 동기화가 실패한 경우(보드 id 오타, 권한 없음
      // 등) — 보드 문서의 lastSync.error에 이유가 남아 있다.
      if (!board.lastSync?.ok) {
        response.status(502).send({ board })
        return
      }

      // 새 보드의 item을 통합 고객에 반영한다.
      const customers = await rebuildCustomersSafely(db)
      response.status(200).send({ board, customers })
    },
  ),
)

// ────────────────────────────────
// removeMondayBoard — 보드 등록을 해제하고 그 보드의 item을 전부 지운다
// ────────────────────────────────
export const removeMondayBoard = onRequest(
  { timeoutSeconds: 300, memory: MONDAY_SYNC_MEMORY },
  endpoint(
    {
      name: 'removeMondayBoard',
      admin: true,
      method: 'POST',
      validate: validateRemoveMondayBoard,
    },
    async ({ response, data }) => {
      const { boardId } = data
      const deletedItemCount = await deleteBoard(db, boardId)
      // 빠진 보드의 item을 통합 고객에서도 덜어낸다.
      const customers = await rebuildCustomersSafely(db)
      response.status(200).send({ boardId, deletedItemCount, customers })
    },
  ),
)

// ────────────────────────────────
// rebuildMondayCustomers — 저장된 item에서 통합 고객(mondayCustomers)만 다시
// 만든다. Monday를 부르지 않으므로, 통합 규칙을 고친 뒤 바로 반영할 때 쓴다.
// ────────────────────────────────
export const rebuildMondayCustomers = onRequest(
  { timeoutSeconds: 300, memory: MONDAY_SYNC_MEMORY },
  endpoint(
    { name: 'rebuildMondayCustomers', method: 'POST', admin: true },
    async ({ response }) => {
      response.status(200).send(await rebuildCustomers(db))
    },
  ),
)

// ────────────────────────────────
// syncMondayBoards — 수동 동기화. body.boardId가 있으면 그 보드만, 없으면 전부
// ────────────────────────────────
export const syncMondayBoards = onRequest(
  {
    secrets: [mondayApiKey],
    timeoutSeconds: MONDAY_SYNC_TIMEOUT_SECONDS,
    memory: MONDAY_SYNC_MEMORY,
  },
  endpoint(
    { name: 'syncMondayBoards', method: 'POST', admin: true },
    async ({ request, response }) => {
      const validationRes = validateSyncMondayBoards(request.body ?? {})
      if (!validationRes.ok) {
        response.status(400).send({ error: validationRes.error })
        return
      }

      const summary = await syncBoards(
        db,
        mondayApiKey.value(),
        validationRes.data.boardId,
      )
      response.status(200).send(summary)
    },
  ),
)

// ────────────────────────────────
// listMondayCustomers — 통합 고객 목록(요약만). 화면의 표가 쓴다.
// ────────────────────────────────
export const listMondayCustomers = onRequest(
  { memory: '512MiB' },
  endpoint(
    { name: 'listMondayCustomers', method: 'GET', member: true },
    async ({ response }) => {
      const customers = await listCustomerSummaries(db)
      response.status(200).send({ customers, count: customers.length })
    },
  ),
)

// ────────────────────────────────
// getMondayCustomer — 통합 고객 1명의 전체 기록. GET ?phone=01012345678
// ────────────────────────────────
export const getMondayCustomer = onRequest(
  endpoint(
    { name: 'getMondayCustomer', method: 'GET', member: true },
    async ({ request, response }) => {
      const phone = String(request.query.phone ?? '').replace(/\D/g, '')
      if (!phone) {
        response.status(400).send({ error: 'phone is required' })
        return
      }

      const customer = await getCustomer(db, phone)
      if (!customer) {
        response.status(404).send({ error: '고객을 찾을 수 없습니다' })
        return
      }
      response.status(200).send({ customer })
    },
  ),
)

// ────────────────────────────────
// listMondayMissingPhoneItems — 유효한 번호가 없어 통합에서 빠진 item들.
// 화면에서 경고로 보여주고 Monday로 가서 고치게 한다.
// ────────────────────────────────
export const listMondayMissingPhoneItems = onRequest(
  endpoint(
    { name: 'listMondayMissingPhoneItems', method: 'GET', member: true },
    async ({ response }) => {
      const items = await listMissingPhoneItems(db)
      response.status(200).send({ items, count: items.length })
    },
  ),
)

// ────────────────────────────────
// listMondayPaymentIssues — 확인이 필요한 결제 기록(계약을 못 찾는 납부,
// 금액을 알 수 없는 결제 건 등). 번호 확인 목록과 같이 화면에서 경고로 보여준다.
// ────────────────────────────────
export const listMondayPaymentIssues = onRequest(
  endpoint(
    { name: 'listMondayPaymentIssues', method: 'GET', member: true },
    async ({ response }) => {
      const issues = await listPaymentIssues(db)
      response.status(200).send({ issues, count: issues.length })
    },
  ),
)

// ────────────────────────────────
// getMondayDailyInflow — 날짜별 인입 건수 전체(통계 탭의 그래프). 기간으로
// 자르는 것은 화면이 한다 — 전체를 내려줘도 하루에 한 줄이라 작다.
// ────────────────────────────────
export const getMondayDailyInflow = onRequest(
  endpoint(
    { name: 'getMondayDailyInflow', method: 'GET', member: true },
    async ({ response }) => {
      response.status(200).send(await getDailyInflow(db))
    },
  ),
)

// ────────────────────────────────
// getMondayDailySales — 판매 통계용 줄 전체(날짜·채널·제품별 수량과 금액).
// 기간·채널로 거르고 제품별로 합치는 것은 화면이 한다.
// ────────────────────────────────
export const getMondayDailySales = onRequest(
  endpoint(
    { name: 'getMondayDailySales', method: 'GET', member: true },
    async ({ response }) => {
      response.status(200).send(await getDailySales(db))
    },
  ),
)

// ────────────────────────────────
// getMondayFollowUps — 진행 중인 상담·방문체험 기록 전체(통계 탭의 방치 현황).
// 기한이 지났는지(방치인지)는 화면이 오늘 날짜로 판단한다.
// ────────────────────────────────
export const getMondayFollowUps = onRequest(
  endpoint(
    { name: 'getMondayFollowUps', method: 'GET', member: true },
    async ({ response }) => {
      response.status(200).send(await getFollowUps(db))
    },
  ),
)

// ────────────────────────────────
// getMondayKpiFacts — 개인 KPI 재료(통계 탭). 기간·담당자별 집계는 화면이 한다.
// ────────────────────────────────
export const getMondayKpiFacts = onRequest(
  { memory: '512MiB' },
  endpoint(
    { name: 'getMondayKpiFacts', method: 'GET', member: true },
    async ({ response }) => {
      response.status(200).send(await getKpiFacts(db))
    },
  ),
)

// ────────────────────────────────
// getMondayItemUpdates — item 하나의 메모(업데이트)·댓글·첨부 파일과 파일
// 컬럼의 파일을 Monday에서 바로 읽는다(DB에 안 씀). 파일 주소는 한 시간쯤 뒤
// 만료되어, 화면이 기록을 열 때마다 부른다.
//   GET ?itemId=2883488878
// ────────────────────────────────
export const getMondayItemUpdates = onRequest(
  { secrets: [mondayApiKey], timeoutSeconds: 60 },
  endpoint(
    {
      name: 'getMondayItemUpdates',
      member: true,
      method: 'GET',
      onError: (error, response) => {
        response.status(502).send({
          error: error instanceof Error ? error.message : String(error),
        })
      },
    },
    async ({ request, response }) => {
      const itemId = String(request.query.itemId ?? '').trim()
      if (!/^\d+$/.test(itemId)) {
        response.status(400).send({ error: 'itemId는 숫자여야 합니다' })
        return
      }
      // 등록한 보드의 기록만 — API 키로는 등록하지 않은 보드의 메모·파일도
      // 보이므로, 동기화해 둔 아이템인지 먼저 본다.
      if (!(await hasSyncedItem(db, itemId))) {
        response.status(404).send({ error: '등록된 보드의 기록이 아닙니다' })
        return
      }
      const updates = await fetchItemUpdates(mondayApiKey.value(), itemId)
      if (!updates) {
        response
          .status(404)
          .send({ error: 'Monday에서 찾을 수 없는 기록입니다' })
        return
      }
      response.status(200).send(updates)
    },
  ),
)

// ────────────────────────────────
// getMondayTechFacts — 기술 통계 재료(통계 탭 기술 통계). 기술지원팀 기록 한
// 건이 한 줄이고, 기간·담당자별 집계는 화면이 한다.
// ────────────────────────────────
export const getMondayTechFacts = onRequest(
  endpoint(
    { name: 'getMondayTechFacts', method: 'GET', member: true },
    async ({ response }) => {
      response.status(200).send(await getTechFacts(db))
    },
  ),
)

// ────────────────────────────────
// getMondayRepeatRevenue — 날짜별 신규·재구매 구매 금액. cmip ROAS 탭이 매출에서
// 재구매를 빼 "신규 고객 ROAS"를 낼 때 쓴다(기간으로 거르는 것은 화면이 한다).
// ────────────────────────────────
export const getMondayRepeatRevenue = onRequest(
  endpoint(
    { name: 'getMondayRepeatRevenue', method: 'GET', member: true },
    async ({ response }) => {
      response.status(200).send(await getDailyRepeatRevenue(db))
    },
  ),
)

// ────────────────────────────────
// getMondayAttribution — 광고 기여 ROAS 재료(고객 1명당 한 줄). cmip ROAS 탭이
// 광고비와 맞춰 ROAS 하한(광고로 확인된 신규 고객 매출)과 고객 유입 월
// 코호트 ROAS를 계산한다.
// ────────────────────────────────
export const getMondayAttribution = onRequest(
  { memory: '512MiB' },
  endpoint(
    { name: 'getMondayAttribution', method: 'GET', member: true },
    async ({ response }) => {
      response.status(200).send(await getAttributionRows(db))
    },
  ),
)

// ────────────────────────────────
// getMondayLeadFeed — 리드 분석 탭. from(한국 날짜) 이후 Monday에 만들어진 상담
// 기록 한 건이 한 줄이고, 상담 보드 목록과 같이 준다. from이 없으면 상담 보드의
// 기록 전부("전체" 기간). 기간·보드로 거르고 같은 번호끼리 묶는 것은 화면이 한다.
//   GET ?from=2026-10-09 | GET (전체)
// ────────────────────────────────
const LEAD_FEED_MAX_DAYS = 92

export const getMondayLeadFeed = onRequest(
  // 전체를 고르면 상담 보드의 기록(수천 건)을 다 읽어 넉넉히 둔다. 기본 제한
  // 시간(60초)은 리드가 늘면 '전체'에서 넘을 수 있어 늘려 둔다.
  { memory: '1GiB', timeoutSeconds: 300 },
  endpoint(
    { name: 'getMondayLeadFeed', method: 'GET', member: true },
    async ({ request, response }) => {
      const from = String(request.query.from ?? '')
      if (from === '') {
        response.status(200).send(await readLeadFeed(db, null))
        return
      }
      const since = /^\d{4}-\d{2}-\d{2}$/.test(from)
        ? Date.parse(`${from}T00:00:00+09:00`)
        : NaN
      if (Number.isNaN(since)) {
        response.status(400).send({ error: 'from은 YYYY-MM-DD여야 합니다' })
        return
      }
      if (Date.now() - since > LEAD_FEED_MAX_DAYS * 86_400_000) {
        response
          .status(400)
          .send({ error: `최근 ${LEAD_FEED_MAX_DAYS}일까지만 볼 수 있습니다` })
        return
      }
      // 저장된 createdAt("2026-11-06T05:23:11Z")과 같은 꼴로 맞춰 비교한다.
      const sinceIso = new Date(since).toISOString().replace(/\.\d{3}Z$/, 'Z')
      response.status(200).send(await readLeadFeed(db, sinceIso))
    },
  ),
)

// ────────────────────────────────
// getMondayGaTracking — "오기입 추적" 탭. GA ClientId가 적힌 상담과, 배치가
// 모아 둔 그 id들의 GA4 이벤트(gaEvents)를 준다. BigQuery는 부르지 않는다 —
// 수집은 syncGaEvents(Monday 예약 동기화 직후, 또는 syncMondayGaEvents)가 한다.
// ────────────────────────────────
export const getMondayGaTracking = onRequest(
  { memory: '512MiB' },
  endpoint(
    { name: 'getMondayGaTracking', method: 'GET', member: true },
    async ({ response }) => {
      response.status(200).send(await readGaTracking(db))
    },
  ),
)

// ────────────────────────────────
// syncMondayGaEvents — GA4 이벤트 수집을 지금 바로 한 번(탭의 "지금 수집").
// 예약 실행과 같은 함수를 쓰고, /log에는 수동 실행으로 남는다.
// ────────────────────────────────
export const syncMondayGaEvents = onRequest(
  { memory: '512MiB', timeoutSeconds: 300 },
  endpoint(
    {
      name: 'syncMondayGaEvents',
      member: true,
      method: 'POST',
      onError: async (error, response) => {
        await saveGaSyncError(db, error)
        response.status(500).send({
          error: error instanceof Error ? error.message : '서버 오류',
        })
      },
    },
    async ({ response }) => {
      const result = await recordBatchRun(
        db,
        { job: 'ga-events', codebase: 'xtool', trigger: 'manual' },
        () => syncGaEvents(db),
      )
      response.status(200).send(result)
    },
  ),
)

// ────────────────────────────────
// syncMondayBoardsScheduled — 하루 여섯 번(09·11·13·15·17·22시 KST) 전체 동기화.
// HTTP 응답이 없는 트리거라 결과는 로그와 batchRuns(/log 화면)로 확인한다.
// ────────────────────────────────
export const syncMondayBoardsScheduled = onSchedule(
  {
    schedule: '0 9,11,13,15,17,22 * * *',
    timeZone: 'Asia/Seoul',
    secrets: [mondayApiKey],
    timeoutSeconds: MONDAY_SYNC_TIMEOUT_SECONDS,
    memory: MONDAY_SYNC_MEMORY,
  },
  traced('syncMondayBoardsScheduled', 'schedule', async (event) => {
    try {
      const summary = await recordBatchRun(
        db,
        {
          job: 'monday-sync',
          codebase: 'xtool',
          trigger: 'scheduled',
          scheduledAt: event.scheduleTime,
        },
        () => syncBoards(db, mondayApiKey.value()),
        // 보드 일부가 실패했거나 고객 통합 단계가 실패해도 함수는 끝까지
        // 돈다 — 그런 실행은 "일부 실패"로 남긴다.
        (result) => {
          const notes = [
            result.failedCount > 0
              ? `보드 ${result.failedCount}개 동기화 실패`
              : null,
            result.customers === null ? '고객 통합 실패' : null,
          ].filter(Boolean)
          return { partial: notes.length > 0, note: notes.join(', ') }
        },
      )
      logger.info(
        `Monday 자동 동기화 완료: 성공 ${summary.okCount}개, ` +
          `실패 ${summary.failedCount}개`,
        summary.customers,
      )
      // 단계별 시간 + 보드별 받기·쓰기 시간 — 실행 시간이 어디서 나오는지
      // (docs/cost-optimization).
      logger.info('Monday 동기화 단계별 시간:', {
        ...summary.timings,
        boards: summary.boards.map(({ name, itemCount, fetchMs, writeMs }) => ({
          name,
          itemCount,
          fetchMs,
          writeMs,
        })),
      })
    } catch (error) {
      logger.error('Monday 자동 동기화 실패:', error)
    }

    // 이어서 GA4 이벤트 수집 — 방금 동기화로 GA ClientId 상담 목록이 새로
    // 저장됐으므로 그 직후에 돈다. /log에는 별도 작업(ga-events)으로 남는다.
    try {
      const result = await recordBatchRun(
        db,
        {
          job: 'ga-events',
          codebase: 'xtool',
          trigger: 'scheduled',
          scheduledAt: event.scheduleTime,
        },
        () => syncGaEvents(db),
      )
      logger.info('GA4 이벤트 수집 완료:', result)
    } catch (error) {
      logger.error('GA4 이벤트 수집 실패:', error)
      await saveGaSyncError(db, error)
    }
  }),
)

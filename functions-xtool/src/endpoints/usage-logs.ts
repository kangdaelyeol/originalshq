import { getAuth } from 'firebase-admin/auth'
import { onRequest } from 'firebase-functions/https'
import {
  listUsageSegments,
  listUsageSegmentsUpdatedSince,
  memberNames,
  parseUsageSegments,
  saveUsageSegments,
  type UsageSegment,
} from '../usage'
import { listBatchRuns, readBatchRun } from '../batch-log'
import { db } from '../app'
import { endpoint, parseSince } from '../http'

// 이어 받기(?since=)의 겹침 — 저장 시각을 정한 뒤 실제로 쓰기까지의 틈과
// 시계 차이를 덮으려고 since보다 조금 앞부터 준다(겹친 것은 화면이 id로 합친다).
const UPDATE_OVERLAP_MS = 2 * 60_000
// 실행 기록은 시작할 때 쓰고 끝날 때 한 번 고친다 — 함수 제한 시간(최대 9분)
// 안에서만 바뀌므로, since보다 30분 앞부터 시작한 실행만 다시 주면 된다.
const RUN_OVERLAP_MS = 30 * 60_000
// 이어 받기 한 번에 이만큼 넘게 바뀌었으면 기간 전체를 다시 준다.
const MAX_UPDATED = 2_000

/** 본문의 로그인 토큰(idToken)으로 확인한 계정 메일 — beacon은 헤더를 못 붙여
 * 본문에 싣는다. 없거나 틀리면 null(기록은 그대로 받는다 — 계정만 빈다). */
const accountOf = async (body: unknown): Promise<string | null> => {
  const idToken = (body as { idToken?: unknown })?.idToken
  if (typeof idToken !== 'string' || idToken.length > 4096) return null
  const token = await getAuth()
    .verifyIdToken(idToken)
    .catch(() => null)
  return token?.email && token.email_verified === true
    ? token.email.toLowerCase()
    : null
}

// ────────────────────────────────
// logUsage — 사용 분석 수집(xtool-lead-manager·cmip·xtool-tech 화면이 보낸다).
// 창을 닫을 때도 빠지지 않도록 화면은 navigator.sendBeacon으로 보내는데,
// beacon은 text/plain 본문이라(JSON 형식은 CORS 사전 요청이 필요해 beacon으로
// 못 보낸다) 본문을 직접 JSON으로 푼다. 응답 본문은 쓰지 않는다. 로그인은
// 요구하지 않고(공개), 토큰이 맞을 때만 계정을 남긴다.
// ────────────────────────────────
export const logUsage = onRequest(
  endpoint(
    { name: 'logUsage', method: 'POST' },
    async ({ request, response }) => {
      let body: unknown = request.body
      if (typeof body === 'string' || !body || Buffer.isBuffer(body)) {
        try {
          body = JSON.parse(request.rawBody?.toString('utf8') ?? '')
        } catch {
          response.status(400).send({ error: '본문을 해석할 수 없습니다' })
          return
        }
      }
      const segments = parseUsageSegments(body, Date.now())
      if (segments.length === 0) {
        response.status(204).send()
        return
      }
      await saveUsageSegments(db, segments, await accountOf(body))
      response.status(204).send()
    },
  ),
)

// ────────────────────────────────
// getUsageSegments — 사용 분석 기록(/log). ?days=N(기본 7, 최대 90)일 안에
// 시작한 탭 방문을 최근 것부터 최대 20,000건. ?since=(지난 응답의 fetchedAt)를
// 주면 그 뒤에 저장된 방문만 준다(incremental: true — 1분마다 다시 받을 때
// 기간 전체 수백 건 대신 몇 건만 읽는다). 계정(email)이 있는 방문에는 구성원
// 이름(name)을 붙여 준다(지금 명단 기준 — 저장하지 않는다).
// ────────────────────────────────
export const getUsageSegments = onRequest(
  { memory: '512MiB' },
  endpoint(
    { name: 'getUsageSegments', method: 'GET', admin: true },
    async ({ request, response }) => {
      const days = Math.min(
        Math.max(Number(request.query.days) || 7, 1),
        90,
      )
      const now = Date.now()
      const windowStart = now - days * 86_400_000
      const since = parseSince(request.query.since, windowStart, now)
      const updated =
        since === null
          ? null
          : await listUsageSegmentsUpdatedSince(
              db,
              since - UPDATE_OVERLAP_MS,
              MAX_UPDATED,
            )
      const incremental = updated !== null && updated.length < MAX_UPDATED
      const listed = incremental
        ? updated
        : await listUsageSegments(db, windowStart, 20_000)
      const names = listed.some((s) => s.email)
        ? await memberNames(db)
        : new Map<string, string>()
      const segments = listed.map(
        (s): UsageSegment & { name?: string } => {
          const name = s.email ? names.get(s.email) : undefined
          return name ? { ...s, name } : s
        },
      )
      response
        .status(200)
        .send({ segments, days, fetchedAt: now, incremental })
    },
  ),
)

// ────────────────────────────────
// getBatchRuns — 배치(예약 실행) 함수들의 실행 기록(/log 화면). xtool과 cmip
// 두 코드베이스가 같은 batchRuns 컬렉션에 쌓으므로 여기 하나에서 같이 준다.
// ?days=N(기본 7, 최대 90)일 안의 기록을 최근 것부터 하루 200건꼴까지(지금
// 하루 130건 남짓 — 예전 2,000건 한도는 30일이면 앞 2주를 잘랐다). ?since=를
// 주면 그 뒤에 바뀌었을 수 있는 실행(30분 앞부터 시작한 것)만 준다. 결과는
// 큰 칸을 줄여서 준다(listBatchRuns) — 원본은 getBatchRun.
// ────────────────────────────────
export const getBatchRuns = onRequest(
  { memory: '512MiB' },
  endpoint(
    { name: 'getBatchRuns', method: 'GET', admin: true },
    async ({ request, response }) => {
      const days = Math.min(
        Math.max(Number(request.query.days) || 7, 1),
        90,
      )
      const now = Date.now()
      const windowStart = now - days * 86_400_000
      const since = parseSince(request.query.since, windowStart, now)
      const runs = await listBatchRuns(
        db,
        since === null
          ? windowStart
          : Math.max(windowStart, since - RUN_OVERLAP_MS),
        days * RUNS_PER_DAY_MAX,
      )
      response.status(200).send({
        runs,
        days,
        fetchedAt: now,
        incremental: since !== null,
        // 한도까지 찼으면 앞쪽이 잘렸을 수 있다.
        truncated: runs.length === days * RUNS_PER_DAY_MAX,
      })
    },
  ),
)

// 하루에 받는 실행 기록 수의 한도 — 지금 하루 130건 남짓(수동 실행 포함)에
// 여유를 둔다.
const RUNS_PER_DAY_MAX = 200

// ────────────────────────────────
// getBatchRun — 실행 1건 원본(?id=). 목록(getBatchRuns)은 결과의 큰 칸을
// 줄여서 주므로, /log에서 그런 실행을 펼칠 때 받는다.
// ────────────────────────────────
export const getBatchRun = onRequest(
  endpoint(
    { name: 'getBatchRun', method: 'GET', admin: true },
    async ({ request, response }) => {
      const id = String(request.query.id ?? '')
      if (!/^[A-Za-z0-9]{1,64}$/.test(id)) {
        response.status(400).send({ error: 'id가 올바르지 않습니다' })
        return
      }
      const run = await readBatchRun(db, id)
      if (!run) {
        response.status(404).send({ error: '실행 기록을 찾을 수 없습니다' })
        return
      }
      response.status(200).send({ run })
    },
  ),
)

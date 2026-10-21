import { Firestore, Timestamp } from 'firebase-admin/firestore'

// 사용 분석 — xtool-lead-manager·cmip 화면을 누가(익명 방문자) 얼마나 봤는지.
// 탭 한 번 방문(들어와서 다른 탭으로 가거나 창을 닫을 때까지)이 문서 하나다.
// 화면이 보는 동안 1분마다 같은 문서를 덮어써 "실제로 본 시간"을 늘린다.
// /log의 "사용 분석" 탭이 읽는다. 이름·IP 등 개인을 알아볼 값은 받지 않는다.

export const USAGE_SEGMENTS_COLLECTION = 'usageSegments'

// 보관 기간 — expireAt에 적어 두고, Firestore TTL 정책을
// usageSegments.expireAt에 걸면 자동으로 지워진다.
const RETENTION_DAYS = 90

const APPS = new Set(['xtool', 'cmip'])
// 한 번에 받는 최대 개수 — 화면은 보통 1~2개씩 보낸다.
const MAX_SEGMENTS_PER_REQUEST = 20
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/
const VIEW_PATTERN = /^[A-Za-z0-9_/-]{1,64}$/

export interface UsageSegment {
  /** 탭 방문 id — 문서 id. */
  id: string
  app: 'xtool' | 'cmip'
  /** 브라우저에 저장한 무작위 값 — 같은 브라우저면 같은 방문자. */
  visitorId: string
  /** 화면을 열 때마다 새로 만드는 값. */
  sessionId: string
  /** 탭 이름(예: "trend/kpi", "roas"). */
  view: string
  startedAt: number
  /** 이 탭을 실제로 보고 있던 시간(ms) — 브라우저 탭을 다른 데로 옮겨 둔
   * 시간은 빠진다. */
  visibleMs: number
  /** 다른 탭으로 갔거나 창을 닫아 끝난 방문인지. */
  closed: boolean
  updatedAt: number
}

/** 화면이 보낸 값을 검사해 저장할 모양으로 — 형식이 이상한 것은 버린다
 * (공개 API라 아무 값이나 들어올 수 있다). */
export const parseUsageSegments = (
  body: unknown,
  now: number,
): UsageSegment[] => {
  const list = (body as { segments?: unknown })?.segments
  if (!Array.isArray(list)) return []
  return list.slice(0, MAX_SEGMENTS_PER_REQUEST).flatMap((raw) => {
    const s = raw as Record<string, unknown>
    if (
      typeof s.id !== 'string' ||
      !ID_PATTERN.test(s.id) ||
      typeof s.app !== 'string' ||
      !APPS.has(s.app) ||
      typeof s.visitorId !== 'string' ||
      !ID_PATTERN.test(s.visitorId) ||
      typeof s.sessionId !== 'string' ||
      !ID_PATTERN.test(s.sessionId) ||
      typeof s.view !== 'string' ||
      !VIEW_PATTERN.test(s.view) ||
      typeof s.startedAt !== 'number' ||
      typeof s.visibleMs !== 'number'
    ) {
      return []
    }
    // 브라우저 시계가 크게 틀린 경우를 막는다 — 하루 넘게 어긋나면 지금으로.
    const startedAt =
      Math.abs(s.startedAt - now) > 86_400_000 ? now : s.startedAt
    // 한 방문이 12시간을 넘을 수는 없다고 본다(창을 켜 둔 채 잊은 경우 등).
    const visibleMs = Math.min(Math.max(s.visibleMs, 0), 12 * 3_600_000)
    return [
      {
        id: s.id,
        app: s.app as UsageSegment['app'],
        visitorId: s.visitorId,
        sessionId: s.sessionId,
        view: s.view,
        startedAt,
        visibleMs: Math.round(visibleMs),
        closed: s.closed === true,
        updatedAt: now,
      },
    ]
  })
}

export async function saveUsageSegments(
  db: Firestore,
  segments: UsageSegment[],
): Promise<void> {
  if (segments.length === 0) return
  const collection = db.collection(USAGE_SEGMENTS_COLLECTION)
  const batch = db.batch()
  for (const segment of segments) {
    batch.set(collection.doc(segment.id), {
      ...segment,
      expireAt: Timestamp.fromMillis(
        segment.startedAt + RETENTION_DAYS * 86_400_000,
      ),
    })
  }
  await batch.commit()
}

/** /log 사용 분석용 — since(ms) 이후에 시작한 방문, 최근 것부터. */
export async function listUsageSegments(
  db: Firestore,
  since: number,
  limit: number,
): Promise<UsageSegment[]> {
  const snapshot = await db
    .collection(USAGE_SEGMENTS_COLLECTION)
    .where('startedAt', '>=', since)
    .orderBy('startedAt', 'desc')
    .limit(limit)
    .get()
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    delete data.expireAt
    return data as UsageSegment
  })
}

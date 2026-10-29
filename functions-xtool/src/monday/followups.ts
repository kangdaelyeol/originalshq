import { koreaDate, pick } from './fields'
import { MondayBoardKind, MondayFollowUp, MondayItem } from './types'

// 끝난 상담 — 더 연락할 필요가 없는 상태. 그 밖의 상태(신규 상담 유입, 콜백
// n단계, 보류, 상태 없음 등)는 아직 진행 중이다.
const CLOSED_STATUS = /결제|미전환|오기입/

// 다음 연락 기한이 비어 있을 때 쓰는 간격 — CS팀이 상담 마감일을 "마지막
// 연락일 + 7일"로 잡고 있어서(실데이터의 대부분이 정확히 7일) 같은 값을 쓴다.
const DEFAULT_FOLLOW_UP_DAYS = 7

// 방문체험을 마쳤거나(체험 완료) 노쇼로 끝난 고객은 방문체험 단계에서 할
// 일이 끝난 것이라 방치로 보지 않는다. 그 밖(일정 연기, 체험 취소, 방문 대기)은
// 다시 일정을 잡거나 연락해야 해서 대상이다.
const VISIT_DONE = /체험\s*완료|노쇼/

// 응대를 마친 고객을 옮겨 두는 그룹 — 방문체험 보드는 여기 있으면 상태 칸이
// 아직 남아 있어도 방치가 아니다. 상담 보드(콜백)는 그룹이 아니라 상태와
// 방문체험 확정으로만 가린다(아래 buildFollowUps).
const DONE_GROUPS = new Set(['완료', '완료된 영업'])
// "보류" 그룹이나 보류 상태 — 고객이 고민 중이라 기다리는 것이지 방치가 아니다.
// 방치와 따로 센다.
const HOLD_GROUP = '보류'

const addDays = (date: string, days: number): string =>
  new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10)

const latest = (dates: (string | null)[]): string | null =>
  dates
    .map((date) => koreaDate(date))
    .filter((date): date is string => date !== null)
    .sort()
    .pop() ?? null

/** 마지막 연락일 — 접수일(방문체험은 방문일)과 콜백 진행일 중 가장 늦은 날. */
const lastTouchOf = (item: MondayItem, firstDate: string | null) =>
  latest([
    firstDate,
    ...[1, 2, 3, 4].map((step) => pick(item, new RegExp(`^콜백${step}단계`))),
  ])

/**
 * 다음 연락 기한 — 이 날이 지나도록 진행 중이면 "방치"다.
 *   · 보류 중이고 보류 종료일이 있으면 그 날(고객이 정한 고민 기간이 끝나는 날)
 *   · 아니면 CS팀이 적어 둔 상담 마감일
 *   · 그것도 없으면 마지막 연락일 + 7일
 */
const dueDateOf = (
  item: MondayItem,
  status: string | null,
  lastTouchAt: string | null,
): string | null => {
  const holdEnd = koreaDate(pick(item, /^보류종료일$/))
  if (status && /보류/.test(status) && holdEnd) return holdEnd
  const deadline = koreaDate(pick(item, /^상담마감일$/))
  if (deadline) return deadline
  return lastTouchAt ? addDays(lastTouchAt, DEFAULT_FOLLOW_UP_DAYS) : null
}

/** 담당자 칸의 첫 사람 — "최우향, 윤진영"처럼 여럿이면 처음 사람을 주
 * 담당자로 본다. */
const primaryAssignee = (item: MondayItem): string | null =>
  pick(item, /^담당자$/)
    ?.split(',')[0]
    .trim() || null

/**
 * 아직 끝나지 않은 상담·방문체험 기록을 뽑는다(순수 함수) — 통계 탭의
 * "방치 현황"이 쓴다. 방치인지(기한이 지났는지)는 화면이 오늘 날짜로 가린다
 * (여기서 정해 두면 하루만 지나도 값이 틀려지므로).
 *
 *   · 콜백 — 상담 보드의 진행 중 기록(상담 진행 상태가 결제·미전환·오기입이
 *     아닌 것) 가운데 방문체험이 확정되지 않은 것. 그룹은 보지 않는다.
 *   · 방문체험 — 방문체험 보드의 진행 중 기록 가운데 체험 완료·노쇼가 아니고
 *     완료 그룹(DONE_GROUPS)에 있지 않은 것.
 *   · 보류(보류 상태이거나 "보류" 그룹)는 onHold로 표시만 하고, 화면이 방치와
 *     따로 센다.
 */
export const buildFollowUps = (
  items: MondayItem[],
  kindByBoardId: Map<string, MondayBoardKind>,
): MondayFollowUp[] => {
  const followUps: MondayFollowUp[] = []

  for (const item of items) {
    const kind = kindByBoardId.get(item.boardId)
    if (kind !== 'consultation' && kind !== 'visit') continue

    const status = pick(item, /^상담진행상태$/)
    if (status && CLOSED_STATUS.test(status)) continue
    if (kind === 'consultation') {
      // 콜백 — 방문체험이 확정됐으면(확정일이 있거나 체크) 다음 단계는
      // 방문체험 쪽이라 콜백 미처리가 아니다. 그룹은 보지 않는다.
      if (
        pick(item, /^방문체험확정일$/) !== null ||
        pick(item, /^방문체험확정$/) !== null
      ) {
        continue
      }
    } else if (DONE_GROUPS.has(item.groupTitle?.trim() ?? '')) {
      continue
    }

    let visitStatus: string | null = null
    let firstDate: string | null
    if (kind === 'visit') {
      visitStatus = pick(item, /^체험상태$/)
      if (visitStatus && VISIT_DONE.test(visitStatus)) continue
      firstDate = pick(item, /^방문체험일자$/)
    } else {
      firstDate = pick(item, /^접수일$/)
    }

    const lastTouchAt = lastTouchOf(item, firstDate ?? item.createdAt)
    followUps.push({
      kind: kind === 'visit' ? 'visit' : 'callback',
      itemId: item.id,
      boardName: item.boardName,
      name: item.name,
      url: item.url,
      assignee: primaryAssignee(item),
      status,
      visitStatus,
      group: item.groupTitle,
      onHold:
        (status !== null && /보류/.test(status)) ||
        item.groupTitle?.trim() === HOLD_GROUP,
      lastTouchAt,
      dueAt: dueDateOf(item, status, lastTouchAt),
    })
  }

  return followUps
}

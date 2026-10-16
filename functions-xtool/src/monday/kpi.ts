import { buildPurchaseRecords } from './purchases'
import { koreaDate, pick } from './fields'
import { extractMondayPhones, isMobilePhone } from './helper'
import { MondayBoardKind, MondayItem, MondayKpiFacts } from './types'

// 개인 KPI(통계 탭)의 재료 — 기간·담당자별로 묶는 것은 화면이 한다. 여기서는
// 기록마다 "누가, 언제, 무엇을 했는지"만 짧게 뽑아 둔다(문서 하나에 다
// 들어가도록 객체가 아니라 짧은 배열로).

const assigneesOf = (item: MondayItem): string[] =>
  (pick(item, /^담당자$/) ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)

const phoneOf = (item: MondayItem): string | null => {
  const phones = extractMondayPhones(item.phoneRaw)
  return phones.find(isMobilePhone) ?? phones[0] ?? null
}

const isPaid = (item: MondayItem): boolean =>
  pick(item, /^상담진행상태$/) === '결제' || pick(item, /^결제일$/) !== null

/** 결제했다면 그 날 — 결제일이 비어 있으면 마지막 수정일로 대신한다. */
const paidDateOf = (item: MondayItem): string | null =>
  isPaid(item)
    ? (koreaDate(pick(item, /^결제일$/)) ?? koreaDate(item.updatedAt))
    : null

/**
 * 개인 KPI 재료를 만든다(순수 함수).
 *
 *   consultations — 상담 보드의 상담(오기입 제외):
 *     [주 담당자, 접수일, 방문체험 확정일(확정 안 했으면 ''), 결제일('')]
 *   visits — 방문체험 보드의 방문:
 *     [주 담당자, 방문일, 체험 완료 여부(1/0), 결제일('')]
 *   sales — 오프라인 결제(계약 기준, 취소 제외):
 *     [담당자들(쉼표로 이음), 결제일, 구매 금액, 방문체험 담당자('')]
 *     방문체험 담당자는 같은 번호의 고객이 결제일 이전에 마지막으로 체험을
 *     마친 방문의 담당자다 — 방문체험이 이끈 매출을 그 담당자에게 돌린다.
 */
export const buildKpiFacts = (
  items: MondayItem[],
  kindByBoardId: Map<string, MondayBoardKind>,
): MondayKpiFacts => {
  const of = (kind: MondayBoardKind) =>
    items.filter((item) => kindByBoardId.get(item.boardId) === kind)

  const consultations: MondayKpiFacts['consultations'] = []
  for (const item of of('consultation')) {
    if (pick(item, /^상담진행상태$/) === '오기입') continue
    const receivedAt =
      koreaDate(pick(item, /^접수일$/)) ?? koreaDate(item.createdAt)
    if (!receivedAt) continue
    const confirmed = pick(item, /^방문체험확정$/) !== null
    consultations.push([
      assigneesOf(item)[0] ?? '',
      receivedAt,
      confirmed
        ? (koreaDate(pick(item, /^방문체험확정일$/)) ?? receivedAt)
        : '',
      paidDateOf(item) ?? '',
    ])
  }

  // 번호별로, 체험을 마친 방문 — 매출을 방문체험 담당자에게 잇는 데 쓴다.
  const completedVisitsByPhone = new Map<
    string,
    { at: string; assignee: string }[]
  >()
  const visits: MondayKpiFacts['visits'] = []
  for (const item of of('visit')) {
    const visitAt = koreaDate(pick(item, /^방문체험일자$/))
    if (!visitAt) continue
    const assignee = assigneesOf(item)[0] ?? ''
    const completed = /체험\s*완료/.test(pick(item, /^체험상태$/) ?? '')
    visits.push([assignee, visitAt, completed ? 1 : 0, paidDateOf(item) ?? ''])

    const phone = phoneOf(item)
    if (completed && phone && assignee) {
      const list = completedVisitsByPhone.get(phone) ?? []
      list.push({ at: visitAt, assignee })
      completedVisitsByPhone.set(phone, list)
    }
  }

  const sales: MondayKpiFacts['sales'] = []
  for (const item of of('purchase')) {
    const [purchase] = buildPurchaseRecords([item]).purchases
    if (!purchase || purchase.cancelled || purchase.amount <= 0) continue
    const paidAt = koreaDate(purchase.paidAt)
    if (!paidAt) continue

    const phone = phoneOf(item)
    const visit = (phone ? (completedVisitsByPhone.get(phone) ?? []) : [])
      .filter((each) => each.at <= paidAt)
      .sort((a, b) => b.at.localeCompare(a.at))[0]

    sales.push([
      assigneesOf(item).join(','),
      paidAt,
      purchase.amount,
      visit?.assignee ?? '',
    ])
  }

  return { consultations, visits, sales }
}

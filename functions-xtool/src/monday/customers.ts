import { createHash } from 'crypto'
import { isValidEmail, normalizeEmail } from '../utils'
import {
  MondayBoardKind,
  MondayColumn,
  MondayConsultation,
  MondayCustomer,
  MondayDailyInflow,
  MondayItem,
  MondayPaymentIssue,
  MondaySampleTest,
  MondaySurvey,
  MondayVisit,
} from './types'
import {
  CAFE24_SOURCE_ID,
  CAFE24_SOURCE_NAME,
  Cafe24Order,
  toOnlinePurchase,
} from './cafe24'
import { checked, cleanName, koreaDate, pick, source, squash } from './fields'
import { extractMondayPhones, isMobilePhone } from './helper'
import { buildPurchaseRecords } from './purchases'

/** 보드의 컬럼 제목으로 그 보드가 어떤 기록을 담는지 추정한다. 위에서부터
 * 먼저 맞는 것으로 정한다 — 방문체험 보드에도 "상담 진행 상태"가 있어서
 * 상담 판정은 맨 뒤다. */
export const detectBoardKind = (columns: MondayColumn[]): MondayBoardKind => {
  const has = (pattern: RegExp) =>
    columns.some((column) => pattern.test(squash(column.title)))

  if (has(/^결제상태$|^결제수단$/)) return 'purchase'
  if (has(/^방문체험일자$|^체험상태$/)) return 'visit'
  if (columns.some((column) => column.type === 'rating')) return 'survey'
  if (has(/^샘플소재$|^테스트기기$/)) return 'sampleTest'
  if (has(/^상담진행상태$/)) return 'consultation'
  return 'other'
}

/** 콜백 1~4단계 진행일을 단계 순서대로 — 비어 있는 단계는 뺀다. */
const callbackDates = (item: MondayItem): string[] =>
  [1, 2, 3, 4]
    .map((step) => pick(item, new RegExp(`^콜백${step}단계`)))
    .filter((date): date is string => date !== null)

/** 콜백이 몇 단계까지 갔는지(0~4). CS팀이 단계를 순서대로 체크하지 않는
 * 경우가 있다 — 2단계부터 적거나, 1단계 다음에 3단계를 적거나. 그래서 "날짜가
 * 적힌 단계의 수"가 아니라 "날짜가 적힌 가장 높은 단계"를 도달 단계로 보고,
 * 그 아래 단계는 거친 것으로 친다. 상담 진행 상태가 "콜백n단계"인데 날짜를
 * 안 적은 경우도 있어 상태값도 같이 본다. */
const callbackStage = (item: MondayItem): number => {
  const dated = [4, 3, 2, 1].find(
    (step) => pick(item, new RegExp(`^콜백${step}단계`)) !== null,
  )
  const status = pick(item, /^상담진행상태$/)?.match(/콜백\s*(\d)\s*단계/)
  return Math.max(dated ?? 0, status ? Number(status[1]) : 0)
}

const toConsultation = (item: MondayItem): MondayConsultation => ({
  ...source(item),
  product: pick(item, /^관심기기$/),
  status: pick(item, /^상담진행상태$/),
  assignee: pick(item, /^담당자$/),
  receivedAt: pick(item, /^접수일$/),
  closedAt: pick(item, /^상담마감일$/),
  probability: pick(item, /^구매확률$/),
  notes: pick(item, /^상담내역$/),
  visitConfirmed: checked(item, /^방문체험확정$/),
  quoteIssued: checked(item, /^견적서발행$/),
  callbackDates: callbackDates(item),
  callbackStage: callbackStage(item),
  paidAt: pick(item, /^결제일$/),
  notConvertedAt: pick(item, /^미전환일$/),
  utmCampaign: pick(item, /^(광고)?utm$/i),
  utmMedium: pick(item, /utm_?medium$/i),
  utmSource: pick(item, /utm_?source$/i),
  fbc: pick(item, /^fbc/i),
  fbp: pick(item, /^fbp/i),
})

const toVisit = (item: MondayItem): MondayVisit => ({
  ...source(item),
  visitAt: pick(item, /^방문체험일자$/),
  reservedDevice: pick(item, /^\(예약\)체험기기$/),
  actualDevice: pick(item, /^\(실제\)체험기기$/),
  status: pick(item, /^체험상태$/),
  consultationStatus: pick(item, /^상담진행상태$/),
  probability: pick(item, /^구매가능성$/),
  assignee: pick(item, /^담당자$/),
  source: pick(item, /^유입경로$/),
  material: pick(item, /^소재$/),
  notes: pick(item, /^상담내역$/),
  memo: pick(item, /^메모$/),
  quoteIssued: checked(item, /^견적서발행여부$/),
  callbackDates: callbackDates(item),
  callbackStage: callbackStage(item),
  paidAt: pick(item, /^결제일$/),
  notConvertedAt: pick(item, /^미전환일$/),
})

const toSurvey = (item: MondayItem): MondaySurvey => ({
  ...source(item),
  createdAt: pick(item, /^생성일$/),
  rating: pick(item, /만족도를평가/),
  device: pick(item, /어떤기기를체험/),
  knownFrom: pick(item, /처음알게된경로/) ?? pick(item, /어떠한경로를통해/),
  importantFactor: pick(item, /가장중요하게생각하는요소/),
  liked: pick(item, /어떤부분이좋으셨/),
  disliked: pick(item, /어떤점이아쉬웠/),
  assignee: pick(item, /^담당자$/),
})

const toSampleTest = (item: MondayItem): MondaySampleTest => ({
  ...source(item),
  requestedAt: pick(item, /^요청일$/),
  completedAt: pick(item, /^완료일$/),
  status: pick(item, /^상태$/),
  device: pick(item, /^테스트기기$/),
  material: pick(item, /^샘플소재$/),
  address: pick(item, /^샘플받을주소$/),
  assignee: pick(item, /^담당자$/),
})

/** item에 적힌 이메일 — 'email' 타입 컬럼이거나 제목에 "이메일"이 든 컬럼. */
const emailsOf = (item: MondayItem): string[] =>
  Object.values(item.columns)
    .filter(
      (column) =>
        column.type === 'email' || /이메일|e-?mail/i.test(column.title),
    )
    .map((column) => normalizeEmail(column.text))
    .filter(isValidEmail)

/** 값들을 많이 나온 순으로(같으면 먼저 나온 순) 중복 없이 늘어놓는다. */
const byFrequency = (values: string[]): string[] => {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => value)
}

/** 같은 날 들어온 상담 신청이 2건 이상인 묶음 — 폼을 두 번 제출했거나
 * CS가 같은 문의를 두 번 적은 경우라 사람이 Monday에서 확인해야 한다. 이미
 * "오기입"으로 정리한 건은 세지 않는다. 묶음마다 1줄이고, 링크는 나중에
 * 만들어진 기록(지울 가능성이 높은 쪽)으로 건다. */
const duplicateConsultationIssues = (
  consultations: MondayConsultation[],
): MondayPaymentIssue[] => {
  const byDay = new Map<string, MondayConsultation[]>()
  for (const record of consultations) {
    const day = koreaDate(record.receivedAt)
    if (!day || record.status === '오기입') continue
    byDay.set(day, [...(byDay.get(day) ?? []), record])
  }
  return [...byDay.entries()]
    .filter(([, records]) => records.length >= 2)
    .map(([day, records]) => {
      const latest = [...records].sort((a, b) =>
        (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
      )[0]
      const detail = records
        .map((record) => `${record.boardName}(${record.status ?? '상태 없음'})`)
        .join(', ')
      return {
        type: 'duplicate-consultation' as const,
        message: `같은 날 상담 신청 ${records.length}건 — ${detail}`,
        itemId: latest.itemId,
        boardName: latest.boardName,
        name: latest.name,
        url: latest.url,
        date: day,
      }
    })
}

/** 최근 것이 앞에 오도록 — 날짜가 없는 기록은 맨 뒤로. */
const newestFirst = <T>(records: T[], dateOf: (record: T) => string | null) =>
  [...records].sort((a, b) => (dateOf(b) ?? '').localeCompare(dateOf(a) ?? ''))

const buildCustomer = (
  phone: string,
  items: MondayItem[],
  kindOf: (boardId: string) => MondayBoardKind,
  orders: Cafe24Order[],
  syncedAt: number,
): MondayCustomer => {
  const of = (kind: MondayBoardKind) =>
    items.filter((item) => kindOf(item.boardId) === kind)

  const consultations = newestFirst(
    of('consultation').map(toConsultation),
    (record) => record.receivedAt,
  )
  const visits = newestFirst(of('visit').map(toVisit), (r) => r.visitAt)
  const {
    purchases,
    payments,
    issues: paymentIssues,
    money,
  } = buildPurchaseRecords(of('purchase'), orders.map(toOnlinePurchase))
  const issues = [
    ...paymentIssues,
    ...duplicateConsultationIssues(consultations),
  ]
  const surveys = newestFirst(of('survey').map(toSurvey), (r) => r.createdAt)
  const sampleTests = newestFirst(
    of('sampleTest').map(toSampleTest),
    (record) => record.requestedAt,
  )

  const activePurchases = purchases.filter((purchase) => !purchase.cancelled)
  const onlineActive = activePurchases.filter((p) => p.origin === 'online')

  // ── 퍼널 통계용 파생값 ──────────────────────────────────────────────
  const day = koreaDate
  const earliest = (dates: (string | null)[]): string | null =>
    dates.filter((date): date is string => date !== null).sort()[0] ?? null

  // 최초 인입일 — 이 고객이 처음 기록에 나타난 날. 상담은 접수일, 방문체험은
  // 예약을 받은 날(Monday에 기록이 만들어진 날 — 방문일은 그보다 나중이다),
  // 샘플테스트는 요청일, 구매는 결제일.
  const firstContactAt = earliest([
    ...consultations.map((record) => day(record.receivedAt)),
    ...visits.map((record) =>
      earliest([day(record.createdAt), day(record.visitAt)]),
    ),
    ...sampleTests.map((record) => day(record.requestedAt)),
    ...activePurchases.map((record) => day(record.paidAt)),
  ])
  const oldestFirst = [...consultations].reverse()
  const funnel = {
    firstContactAt,
    firstPurchaseAt: earliest(activePurchases.map((p) => day(p.paidAt))),
    // 채널별 첫 구매일 — 통계를 오프라인/온라인으로 나눠 볼 때 쓴다.
    firstOfflinePurchaseAt: earliest(
      activePurchases
        .filter((p) => p.origin === 'offline')
        .map((p) => day(p.paidAt)),
    ),
    firstOnlinePurchaseAt: earliest(onlineActive.map((p) => day(p.paidAt))),
    callbackStage: Math.max(
      0,
      ...consultations.map((record) => record.callbackStage),
      ...visits.map((record) => record.callbackStage),
    ),
    // 방문체험 보드에 기록이 있거나, 상담 보드에서 "방문체험확정"이 체크됨.
    visitBooked:
      visits.length > 0 || consultations.some((r) => r.visitConfirmed),
    visitCompleted: visits.some((record) => /완료/.test(record.status ?? '')),
    // 상담이 전부 "오기입"이고 다른 기록이 없는 고객 — 실제 인입이 아니라
    // 통계의 모수에서 뺀다.
    misentry:
      consultations.length > 0 &&
      consultations.every((record) => record.status === '오기입') &&
      visits.length === 0 &&
      activePurchases.length === 0 &&
      sampleTests.length === 0,
    // 유입 경로 — 가장 이른 상담의 UTM source, 없으면 방문체험의 유입경로.
    source:
      oldestFirst.find((record) => record.utmSource)?.utmSource ??
      [...visits].reverse().find((record) => record.source)?.source ??
      null,
  }

  const body = {
    phone,
    otherPhones: [
      ...new Set(
        items.flatMap((item) => item.phones).filter((other) => other !== phone),
      ),
    ].sort(),
    // 온라인 주문은 주문자 정보만 쓴다 — 수령자는 선물 받는 사람처럼 다른
    // 사람일 수 있어 이 고객의 이름·번호로 넣지 않는다.
    names: byFrequency(
      [
        ...items.map((item) => cleanName(item.name)),
        ...orders.map((order) => order.buyerName?.trim() ?? ''),
      ].filter(Boolean),
    ),
    emails: byFrequency([
      ...items.flatMap(emailsOf),
      ...orders
        .map((order) => normalizeEmail(order.buyerEmail ?? ''))
        .filter(isValidEmail),
    ]),
    consultations,
    visits,
    purchases,
    payments,
    issues,
    surveys,
    sampleTests,
    summary: {
      consultationCount: consultations.length,
      visitCount: visits.length,
      // 구매 건수·최근 구매일은 취소되지 않은 계약만 센다.
      purchaseCount: activePurchases.length,
      surveyCount: surveys.length,
      sampleTestCount: sampleTests.length,
      latestConsultationStatus: consultations[0]?.status ?? null,
      latestConsultationAt: consultations[0]?.receivedAt ?? null,
      latestVisitAt: visits[0]?.visitAt ?? null,
      latestPurchaseAt: activePurchases[0]?.paidAt ?? null,
      paymentCount: payments.length,
      onlinePurchaseCount: onlineActive.length,
      onlinePurchaseAmount: onlineActive.reduce((sum, p) => sum + p.amount, 0),
      ...money,
      issueCount: issues.length,
      funnel,
      // "홍길동, 김철수"처럼 한 칸에 여러 명이 적힌 값은 사람별로 나눈다.
      assignees: byFrequency(
        [
          ...consultations,
          ...visits,
          ...purchases,
          ...payments,
          ...surveys,
          ...sampleTests,
        ]
          .flatMap((record) => (record.assignee ?? '').split(','))
          .map((assignee) => assignee.trim())
          .filter(Boolean),
      ),
      boardNames: [
        ...new Set([
          ...items.map((item) => item.boardName),
          ...(orders.length > 0 ? [CAFE24_SOURCE_NAME] : []),
        ]),
      ].sort(),
    },
    itemCount: items.length + orders.length,
    boardIds: [
      ...new Set([
        ...items.map((item) => item.boardId),
        ...(orders.length > 0 ? [CAFE24_SOURCE_ID] : []),
      ]),
    ].sort(),
    lastUpdatedAt:
      [
        ...items.map((item) => item.updatedAt),
        ...orders.map((o) => o.cancelDate ?? o.paymentDate ?? o.orderDate),
      ]
        .filter((at): at is string => at !== null)
        .sort()
        .pop() ?? null,
  }

  return {
    ...body,
    hash: createHash('sha1').update(JSON.stringify(body)).digest('hex'),
    syncedAt,
  }
}

/** mondayItems 전체를 번호별 통합 고객으로 묶는다(순수 함수 — DB를 건드리지
 * 않는다). 묶는 기준은 item의 대표 번호(phone)이고, 유효한 번호가 없는
 * item은 결측으로 보고 뺀다. 같은 입력이면 항상 같은 결과가 나오도록
 * item을 id 순으로 정렬해 놓고 시작한다(hash가 흔들리지 않게). */
export const buildCustomers = (
  items: MondayItem[],
  kindByBoardId: Map<string, MondayBoardKind>,
  syncedAt: number,
  /** Cafe24 온라인몰 주문 — 주문자 전화번호로 같은 고객에 묶는다. Monday에
   * 없는 번호면 그 주문만으로 고객이 하나 생긴다. */
  orders: Cafe24Order[] = [],
): {
  customers: MondayCustomer[]
  excludedItemCount: number
  onlineOrderCount: number
  excludedOrderCount: number
} => {
  const kindOf = (boardId: string) => kindByBoardId.get(boardId) ?? 'other'

  const itemsByPhone = new Map<string, MondayItem[]>()
  let excludedItemCount = 0
  for (const item of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    // 저장된 phone은 그 item을 동기화하던 때의 규칙으로 뽑은 값이라, 번호
    // 규칙이 바뀐 뒤에도 옛 값이 남아 있을 수 있다 — 원래 값에서 지금 규칙으로
    // 다시 뽑아 쓴다.
    const phones = extractMondayPhones(item.phoneRaw)
    const phone = phones.find(isMobilePhone) ?? phones[0]
    if (!phone) {
      excludedItemCount += 1
      continue
    }
    const current = { ...item, phone, phones }
    itemsByPhone.set(phone, [...(itemsByPhone.get(phone) ?? []), current])
  }

  const ordersByPhone = new Map<string, Cafe24Order[]>()
  let excludedOrderCount = 0
  for (const order of [...orders].sort((a, b) =>
    a.orderId.localeCompare(b.orderId),
  )) {
    const phones = extractMondayPhones(order.buyerPhone)
    const phone = phones.find(isMobilePhone) ?? phones[0]
    // 결제 전 주문(무통장 입금 대기 등)은 아직 구매가 아니다 — 입금되면 다음
    // 동기화 때 들어오고, 안 되면 자동 취소된다.
    if (!phone || !order.paid) {
      excludedOrderCount += 1
      continue
    }
    ordersByPhone.set(phone, [...(ordersByPhone.get(phone) ?? []), order])
  }

  const phones = [...new Set([...itemsByPhone.keys(), ...ordersByPhone.keys()])]
  const customers = phones.map((phone) =>
    buildCustomer(
      phone,
      itemsByPhone.get(phone) ?? [],
      kindOf,
      ordersByPhone.get(phone) ?? [],
      syncedAt,
    ),
  )
  return {
    customers,
    excludedItemCount,
    onlineOrderCount: orders.length - excludedOrderCount,
    excludedOrderCount,
  }
}

/** 저장된 item 전체에서 날짜별 인입 건수를 센다(순수 함수). 인입은 상담
 * 보드에 접수된 기록만이다(MondayDailyInflow 주석 참고). 날짜는 접수일이고,
 * 접수일이 비어 있으면 Monday에 기록이 만들어진 날을 쓴다. 결과는 날짜
 * 오름차순이고, 인입이 없던 날은 들어 있지 않다. */
export const buildDailyInflow = (
  items: MondayItem[],
  kindByBoardId: Map<string, MondayBoardKind>,
): MondayDailyInflow[] => {
  const byDate = new Map<string, MondayDailyInflow>()

  for (const item of items) {
    if (kindByBoardId.get(item.boardId) !== 'consultation') continue
    const date = koreaDate(pick(item, /^접수일$/)) ?? koreaDate(item.createdAt)
    if (!date) continue

    const day = byDate.get(date) ?? { date, total: 0, misentry: 0, boards: {} }
    day.total += 1
    day.boards[item.boardName] = (day.boards[item.boardName] ?? 0) + 1
    if (pick(item, /^상담진행상태$/) === '오기입') day.misentry += 1
    byDate.set(date, day)
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

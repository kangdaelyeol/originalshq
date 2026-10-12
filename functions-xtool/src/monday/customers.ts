import { createHash } from 'crypto'
import { isValidEmail, normalizeEmail } from '../utils'
import {
  MondayBoardKind,
  MondayColumn,
  MondayConsultation,
  MondayCustomer,
  MondayItem,
  MondaySampleTest,
  MondaySurvey,
  MondayVisit,
} from './types'
import { checked, cleanName, pick, source, squash } from './fields'
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

/** 최근 것이 앞에 오도록 — 날짜가 없는 기록은 맨 뒤로. */
const newestFirst = <T>(records: T[], dateOf: (record: T) => string | null) =>
  [...records].sort((a, b) => (dateOf(b) ?? '').localeCompare(dateOf(a) ?? ''))

const buildCustomer = (
  phone: string,
  items: MondayItem[],
  kindOf: (boardId: string) => MondayBoardKind,
  syncedAt: number,
): MondayCustomer => {
  const of = (kind: MondayBoardKind) =>
    items.filter((item) => kindOf(item.boardId) === kind)

  const consultations = newestFirst(
    of('consultation').map(toConsultation),
    (record) => record.receivedAt,
  )
  const visits = newestFirst(of('visit').map(toVisit), (r) => r.visitAt)
  const { purchases, payments, issues, money } = buildPurchaseRecords(
    of('purchase'),
  )
  const surveys = newestFirst(of('survey').map(toSurvey), (r) => r.createdAt)
  const sampleTests = newestFirst(
    of('sampleTest').map(toSampleTest),
    (record) => record.requestedAt,
  )

  const activePurchases = purchases.filter((purchase) => !purchase.cancelled)

  const body = {
    phone,
    otherPhones: [
      ...new Set(
        items.flatMap((item) => item.phones).filter((other) => other !== phone),
      ),
    ].sort(),
    names: byFrequency(
      items.map((item) => cleanName(item.name)).filter(Boolean),
    ),
    emails: byFrequency(items.flatMap(emailsOf)),
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
      ...money,
      issueCount: issues.length,
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
      boardNames: [...new Set(items.map((item) => item.boardName))].sort(),
    },
    itemCount: items.length,
    boardIds: [...new Set(items.map((item) => item.boardId))].sort(),
    lastUpdatedAt:
      items
        .map((item) => item.updatedAt)
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
): { customers: MondayCustomer[]; excludedItemCount: number } => {
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

  const customers = [...itemsByPhone.entries()].map(([phone, group]) =>
    buildCustomer(phone, group, kindOf, syncedAt),
  )
  return { customers, excludedItemCount }
}

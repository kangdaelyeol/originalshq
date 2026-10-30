import type { MondayKpiFacts } from '../entity'
import {
  periodKeyOf,
  periodsBetween,
  type KpiCell,
  type KpiRange,
  type KpiResult,
  type KpiUnit,
} from './monday-kpi'

/** CS팀 담당자 한 명의 기간 성과 — 접수일이 기간 안이고 상담 진행 상태가
 * "신규 상담 유입"이 아닌(처리된) 상담 기준(코호트). 결제·방문체험 확정은 그
 * 상담들 중 지금까지 된 것(확정·결제가 기간 뒤여도 센다). 방문체험 확정은
 * 확정일이 있는 것, 결제는 결제일이 있거나 상태가 "결제"인 것. */
export interface CsMemberStats {
  name: string
  /** 접수일이 기간 안이고 이 사람이 (주)담당자인 상담 — 오기입·신규 상담
   * 유입 제외. */
  intake: number
  /** 그 상담 중 결제된 수. */
  paid: number
  /** 그 상담 중 방문체험이 확정된 수. */
  visit: number
}

export interface CsTeamStats {
  members: CsMemberStats[]
  total: CsMemberStats
  /** 같은 기간 처리된 상담 전체(담당자 무관, 신규 상담 유입 제외) — CS팀이
   * 맡은 비중을 보여 주려고. */
  allIntake: number
}

/** 상담 기록에서 CS팀 담당자별 인입·구매 전환·방문체험 전환을 센다. 명단
 * 순서대로 돌려준다(기간에 상담이 없는 사람도 0으로). */
export const buildCsTeamStats = (
  consultations: MondayKpiFacts['consultations'],
  members: readonly string[],
  range: { start: string; end: string },
): CsTeamStats => {
  const byName = new Map<string, CsMemberStats>(
    members.map((name) => [name, { name, intake: 0, paid: 0, visit: 0 }]),
  )
  let allIntake = 0

  for (const [
    assignee,
    receivedAt,
    confirmedAt,
    paidAt,
    isNew,
  ] of consultations) {
    if (!receivedAt || receivedAt < range.start || receivedAt > range.end)
      continue
    // 아직 "신규 상담 유입"인 상담은 처리 전이라 세지 않는다.
    if (isNew === 1) continue
    allIntake += 1
    const stats = byName.get(assignee)
    if (!stats) continue
    stats.intake += 1
    if (paidAt) stats.paid += 1
    if (confirmedAt) stats.visit += 1
  }

  const list = [...byName.values()]
  const total = list.reduce(
    (sum, each) => ({
      name: '합계',
      intake: sum.intake + each.intake,
      paid: sum.paid + each.paid,
      visit: sum.visit + each.visit,
    }),
    { name: '합계', intake: 0, paid: 0, visit: 0 },
  )
  return { members: list, total, allIntake }
}

/** 명단 고를 때의 후보 — 상담 담당자로 한 번이라도 나온 이름, 최근 많이
 * 맡은 순. 담당자 없음·삭제된 팀원은 뺀다. */
export const csCandidates = (
  consultations: MondayKpiFacts['consultations'],
): { name: string; count: number }[] => {
  const counts = new Map<string, number>()
  for (const [assignee] of consultations) {
    if (!assignee || assignee === '삭제된 팀원') continue
    counts.set(assignee, (counts.get(assignee) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'))
}

/** 인입 처리 수 표 — 담당자 × 기간. 그 기간에 접수된 상담 중 처리된 것(신규
 * 상담 유입·오기입 제외)을 접수일 기준으로 센다. 위 카드의 "인입 처리 수"를
 * 기간별로 나눈 것이다. 명단에 있는 사람만, 명단 순서대로(건수 많은 순 정렬은
 * 표가 한다) — 기간에 상담이 없는 사람도 0으로 나온다. */
export const buildIntakeKpi = (
  consultations: MondayKpiFacts['consultations'],
  members: readonly string[],
  unit: KpiUnit,
  range: KpiRange,
): KpiResult => {
  const periods = periodsBetween(unit, range)
  const index = new Map(periods.map((key, i) => [key, i]))
  const blank = (): KpiCell => ({ value: 0 })
  const rows = new Map(
    members.map((name) => [
      name,
      { assignee: name, total: blank(), byPeriod: periods.map(blank) },
    ]),
  )
  const sum = { total: blank(), byPeriod: periods.map(blank) }

  for (const [assignee, receivedAt, , , isNew] of consultations) {
    if (isNew === 1 || !receivedAt) continue
    const row = rows.get(assignee)
    if (!row) continue
    const at = index.get(periodKeyOf(receivedAt, unit))
    if (at === undefined) continue
    row.total.value += 1
    row.byPeriod[at].value += 1
    sum.total.value += 1
    sum.byPeriod[at].value += 1
  }

  return {
    id: 'intake',
    title: '인입 처리 수',
    description:
      '그 기간에 접수된 상담 중 처리한(신규 상담 유입 아닌) 건수 — 접수일 기준, 오기입 제외.',
    format: 'count',
    rows: [...rows.values()].sort((a, b) => b.total.value - a.total.value),
    sum,
  }
}

/** 접수일 기준 전환 표 — 방문체험 확정 / 결제 전환. 담당자 × 기간. */
export type CsConversionId = 'confirm-rate' | 'paid-rate'

/** 방문체험 확정·결제 전환 표 — 담당자 × 기간, 접수일 기준(코호트). 그
 * 기간에 접수돼 처리된 상담(신규 상담 유입·오기입 제외)이 분모, 그중
 * 방문체험이 확정된(결제된) 것이 분자다. 확정·결제가 기간 뒤에 일어나도
 * 접수한 칸에 센다 — 그래서 어느 칸도 100%를 넘지 않고, 기간 전체 합은 위
 * 카드(buildCsTeamStats)의 방문체험 전환·구매 전환과 같다.
 *
 * 최근 접수분은 아직 전환될 시간이 없어 낮게 나온다 — 전환은 접수 뒤 한
 * 달은 지나야 거의 다 잡힌다. 명단에 있는 사람만, 명단 순서대로(정렬은
 * 표가 한다). */
export const buildCsConversionKpi = (
  id: CsConversionId,
  consultations: MondayKpiFacts['consultations'],
  members: readonly string[],
  unit: KpiUnit,
  range: KpiRange,
  dates: { start: string; end: string },
): KpiResult => {
  const periods = periodsBetween(unit, range)
  const index = new Map(periods.map((key, i) => [key, i]))
  const blank = (): KpiCell => ({ value: 0, num: 0, den: 0 })
  const rows = new Map(
    members.map((name) => [
      name,
      { assignee: name, total: blank(), byPeriod: periods.map(blank) },
    ]),
  )
  const sum = { total: blank(), byPeriod: periods.map(blank) }
  const add = (cell: KpiCell, hit: boolean) => {
    cell.den = (cell.den ?? 0) + 1
    if (hit) cell.num = (cell.num ?? 0) + 1
  }

  for (const [
    assignee,
    receivedAt,
    confirmedAt,
    paidAt,
    isNew,
  ] of consultations) {
    if (isNew === 1 || !receivedAt) continue
    if (receivedAt < dates.start || receivedAt > dates.end) continue
    const row = rows.get(assignee)
    if (!row) continue
    const at = index.get(periodKeyOf(receivedAt, unit))
    if (at === undefined) continue
    const hit = Boolean(id === 'confirm-rate' ? confirmedAt : paidAt)
    add(row.total, hit)
    add(row.byPeriod[at], hit)
    add(sum.total, hit)
    add(sum.byPeriod[at], hit)
  }

  const finish = (cell: KpiCell): KpiCell => ({
    ...cell,
    value: cell.den ? (cell.num ?? 0) / cell.den : 0,
  })
  return {
    id,
    title: '',
    description: '',
    format: 'percent',
    rows: [...rows.values()].map((row) => ({
      assignee: row.assignee,
      total: finish(row.total),
      byPeriod: row.byPeriod.map(finish),
    })),
    sum: { total: finish(sum.total), byPeriod: sum.byPeriod.map(finish) },
  }
}

/** 숫자 하나를 이룬 상담 한 건 — "어떤 고객이 센 건인지" 펼쳐 볼 때. */
export interface CsContributor {
  key: string
  name: string
  boardName: string
  /** Monday에서 이 상담을 여는 주소. */
  url: string | null
  receivedAt: string
  confirmedAt: string
  paidAt: string
}

/** 펼쳐 볼 숫자의 종류 — 전부 접수일 기준(기간에 접수돼 처리된 상담):
 *   intake  그 상담 전부(인입 처리 카드·인입 처리 수 표)
 *   paid    그중 결제된 것(구매 전환 카드·결제 전환 표 — 결제는 지금까지)
 *   visit   그중 방문체험이 확정된 것(방문체험 전환 카드·방문체험 확정 표) */
export type CsContributorKind = 'intake' | 'paid' | 'visit'

/** 한 담당자의 그 숫자를 이룬 상담들 — 최근 날짜 순. 고객명이 없는 예전
 * 데이터면 null(다음 Monday 동기화 뒤에 생긴다). */
export const csContributors = (
  facts: MondayKpiFacts,
  assignee: string,
  kind: CsContributorKind,
  range: { start: string; end: string },
): CsContributor[] | null => {
  if (!facts.boards || facts.consultations.some((row) => row[5] === undefined))
    return null
  const inRange = (date: string | undefined) =>
    Boolean(date) && date! >= range.start && date! <= range.end
  const out: CsContributor[] = []
  for (const [
    who,
    receivedAt,
    confirmedAt,
    paidAt,
    isNew,
    itemId = '',
    name = '',
    boardId = '',
  ] of facts.consultations) {
    if (who !== assignee) continue
    const cohort = inRange(receivedAt) && isNew !== 1
    const hit =
      kind === 'intake'
        ? cohort
        : kind === 'paid'
          ? cohort && Boolean(paidAt)
          : cohort && Boolean(confirmedAt)
    if (!hit) continue
    const board = facts.boards[boardId]
    out.push({
      key: itemId,
      name: name || '이름 없음',
      boardName: board?.name ?? '-',
      url: board?.url ? `${board.url}/pulses/${itemId}` : null,
      receivedAt,
      confirmedAt,
      paidAt,
    })
  }
  // 접수일 기준 숫자라 접수가 최근인 순.
  return out.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
}

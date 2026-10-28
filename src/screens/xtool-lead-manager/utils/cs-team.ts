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

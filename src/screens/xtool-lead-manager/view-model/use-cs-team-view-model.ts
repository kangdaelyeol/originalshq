import { useCallback, useMemo, useState } from 'react'
import type { MondayKpiFacts } from '@/screens/xtool-lead-manager/entity'
import {
  buildCsTeamStats,
  computeKpis,
  csCandidates,
  defaultKpiRange,
  firstKpiDate,
  kpiRangeDates,
  recentMonthsRange,
  sortKpiPairRows,
  type KpiRange,
  type KpiUnit,
  type NeglectRow,
  type TableSort,
} from '@/screens/xtool-lead-manager/utils'
import { usePersistentState } from '@/hooks/use-persistent-state'

/** 저장값 검사 — 이름(문자열) 배열이면 그대로(빈 이름·중복은 뺀다). */
const parseMembers = (stored: unknown): string[] | undefined =>
  Array.isArray(stored)
    ? [
        ...new Set(
          stored.filter(
            (name): name is string =>
              typeof name === 'string' && name.trim() !== '',
          ),
        ),
      ]
    : undefined

/** 개인 KPI에서 가져오는 지표(같은 계산 그대로) — 비율 지표 하나가 분자
 * (건수)·분모(상담 수)를 다 갖고 있어서, 건수와 비율을 한 표에 같이 그린다.
 * 그래서 "방문체험 확정 건수"는 "방문체험 확정율"의 분자로 대신한다. */
const CS_KPIS: Record<string, { title: string; description: string }> = {
  'confirm-rate': {
    title: '방문체험 확정',
    description:
      '위: 그 기간에 확정된 방문체험 수(방문체험 확정일 기준) · 아래: 그 기간에 들어온 상담 수 대비 비율(오기입 제외).',
  },
  'paid-rate': {
    title: '결제 전환',
    description:
      '위: 그 기간에 결제된 상담 수(결제일 기준) · 아래: 그 기간에 들어온 상담 수 대비 비율 — 상담 담당자 기준.',
  },
}

export type KpiPairSortBy = 'count' | 'rate'

/**
 * 인입통계 맨 아래 CS팀 섹션 — 위 인입통계 기간과 따로, 자기 기간(처음엔
 * 월별 최근 6개월)으로 본다.
 *   · 인입 처리·구매 전환·방문체험 전환 카드 — 그 기간에 접수된 상담 기준
 *   · 방문체험 확정·결제 전환(건수와 비율을 한 표에) — 개인 KPI와 같은 계산을
 *     CS팀 담당자 기록만으로(합계도 CS팀 합)
 *   · 콜백 방치 — 기간과 무관한 지금 현황, CS팀 담당자만
 * 명단은 이 브라우저(localStorage)에 두어 사람마다 따로 고를 수 있다.
 */
export const useCsTeamViewModel = ({
  facts,
  callbackNeglect,
  tableSorts,
}: {
  facts: MondayKpiFacts
  /** 통계 탭의 콜백 방치(담당자별, 정렬까지 된 것). */
  callbackNeglect: NeglectRow[]
  /** 표 정렬 상태 — 통계 탭과 같이 쓴다(키는 "cs-kpi:지표"). */
  tableSorts: Record<string, TableSort>
}) => {
  const [members, setMembers] = usePersistentState<string[]>(
    'xtool.csTeam.members',
    [],
    parseMembers,
  )
  const [editing, setEditing] = useState(false)
  // 표마다 정렬 기준 — 건수(기본) / 비율.
  const [sortBy, setSortBy] = useState<Record<string, KpiPairSortBy>>({})
  const [unit, setUnit] = useState<KpiUnit>('month')
  const [ranges, setRanges] = useState<Record<KpiUnit, KpiRange>>(() => ({
    day: defaultKpiRange('day'),
    week: defaultKpiRange('week'),
    month: recentMonthsRange(6),
  }))
  const range = ranges[unit]

  /** 지금 단위의 기간을 바꾼다 — 시작이 끝보다 늦으면 둘을 맞춘다. */
  const changeRange = useCallback(
    (next: Partial<KpiRange>) =>
      setRanges((prev) => {
        const merged = { ...prev[unit], ...next }
        if (merged.from > merged.to) {
          if (next.from) merged.to = merged.from
          else merged.from = merged.to
        }
        return { ...prev, [unit]: merged }
      }),
    [unit],
  )

  const memberSet = useMemo(() => new Set(members), [members])

  const stats = useMemo(
    () =>
      buildCsTeamStats(
        facts.consultations,
        members,
        kpiRangeDates(unit, range),
      ),
    [facts, members, unit, range],
  )

  // 개인 KPI와 같은 계산 — CS팀 담당자의 상담만 넣어서 합계도 CS팀 합이다.
  const kpi = useMemo(() => {
    const { periods, kpis } = computeKpis(
      {
        consultations: facts.consultations.filter(([assignee]) =>
          memberSet.has(assignee),
        ),
        visits: [],
        sales: [],
      },
      unit,
      range,
      false,
    )
    return {
      periods,
      kpis: kpis
        .filter((each) => each.id in CS_KPIS)
        .map((each) => {
          const by = sortBy[each.id] ?? 'count'
          return {
            ...each,
            ...CS_KPIS[each.id],
            sortBy: by,
            rows: sortKpiPairRows(
              each.rows,
              tableSorts[`cs-kpi:${each.id}`],
              periods,
              by,
            ),
          }
        }),
    }
  }, [facts, memberSet, unit, range, tableSorts, sortBy])

  const neglect = useMemo(
    () => callbackNeglect.filter((row) => memberSet.has(row.assignee)),
    [callbackNeglect, memberSet],
  )

  // 명단 편집 창의 후보 — 상담 담당자로 나온 이름들(많이 맡은 순).
  const candidates = useMemo(() => csCandidates(facts.consultations), [facts])
  const firstDate = useMemo(() => firstKpiDate(facts), [facts])

  return {
    state: {
      members,
      editing,
      candidates,
      period: { unit, range, firstDate },
      stats,
      kpi,
      neglect,
    },
    actions: {
      openEditor: () => setEditing(true),
      closeEditor: () => setEditing(false),
      /** 명단 저장(이 브라우저) — 저장하고 편집 창을 닫는다. */
      save: (next: string[]) => {
        setMembers(next)
        setEditing(false)
      },
      changeUnit: setUnit,
      changeRange,
      /** 표 하나의 정렬 기준(건수 / 비율)을 바꾼다. */
      changeSortBy: (id: string, by: KpiPairSortBy) =>
        setSortBy((prev) => ({ ...prev, [id]: by })),
    },
  }
}

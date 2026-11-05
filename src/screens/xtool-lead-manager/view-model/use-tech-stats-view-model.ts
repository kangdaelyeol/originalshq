import { useCallback, useMemo, useState } from 'react'
import { oneOf, usePersistentState } from '@/hooks/use-persistent-state'
import { mondayClient } from '@/screens/xtool-lead-manager/client'
import { useLoadWhenActive } from '@/screens/xtool-lead-manager/hooks/use-load-when-active'
import type { MondayTechFact } from '@/screens/xtool-lead-manager/entity'
import {
  TECH_KINGS,
  buildBoardTrends,
  buildTechAssignees,
  buildTechBacklog,
  buildTechBreakdowns,
  buildTechKing,
  inflowSeries,
  previousTechPeriod,
  summarizeInflow,
  summarizeTechRange,
  techDays,
  thisTechMonth,
  thisTechWeek,
  todayInKorea,
  type InflowUnit,
  type TechBasis,
  type TechPeriod,
} from '@/screens/xtool-lead-manager/utils'

const TECH_BASES: readonly TechBasis[] = ['received', 'done']

/** 왕 카드 묶음 — 이번 주(월~일)·이번 달. 바로 앞 기간의 1위도 같이 낸다
 * (이번 주·달이 막 시작해 비어 있을 때 견줘 보게). */
const kingsOf = (
  facts: MondayTechFact[],
  period: TechPeriod,
  span: 'week' | 'month',
) => {
  const previous = previousTechPeriod(period, span)
  return TECH_KINGS.map((def) => ({
    ...buildTechKing(facts, def, period),
    previousTop: buildTechKing(facts, def, previous).rows[0] ?? null,
  }))
}

/**
 * 통계 탭의 기술 통계 — 기술지원팀 기록(출장·AS·기술 문의·기타업무)으로 담당자
 * 순위(왕)·기간 요약·추이·진행 현황을 만든다. 기간과 묶는 단위는 통계 탭의
 * 공용 값(range·unit)을 그대로 쓰고, 왕 카드만 이번 주·이번 달로 고정이다.
 * `active`가 처음 true가 될 때 받아온다.
 */
const NO_TECH_FACTS: { facts: MondayTechFact[]; syncedAt: number | null } = {
  facts: [],
  syncedAt: null,
}

const fetchTechFacts = async () => {
  const res = await mondayClient.getTechFacts()
  if (!res.ok) {
    console.error('기술 통계 실패:', res)
    return null
  }
  return { facts: res.data.facts, syncedAt: res.data.syncedAt }
}

export const useTechStatsViewModel = (
  active: boolean,
  range: TechPeriod,
  unit: InflowUnit,
) => {
  const {
    status,
    data: { facts, syncedAt },
    reload,
  } = useLoadWhenActive(active, fetchTechFacts, NO_TECH_FACTS)
  // 추이 그래프를 접수일로 셀지, 끝난 날로 셀지 — 이 브라우저에 남긴다.
  const [basis, setBasis] = usePersistentState<TechBasis>(
    'xtool.tech.basis',
    'received',
    oneOf(TECH_BASES),
  )
  // 펼쳐 둔 줄 — "카드:담당자" 또는 "stale".
  const [openRows, setOpenRows] = useState<ReadonlySet<string>>(() => new Set())

  const kings = useMemo(
    () => ({
      week: kingsOf(facts, thisTechWeek(), 'week'),
      month: kingsOf(facts, thisTechMonth(), 'month'),
    }),
    [facts],
  )
  const summary = useMemo(
    () => summarizeTechRange(facts, range),
    [facts, range],
  )
  // 기간별 추이 — 인입통계와 같은 그래프·추이 목록을 쓰려고 같은 모양으로.
  const points = useMemo(
    () => inflowSeries(techDays(facts, basis), range.start, range.end, unit),
    [facts, basis, range, unit],
  )
  const pointSummary = useMemo(() => summarizeInflow(points), [points])
  const trends = useMemo(
    () => buildBoardTrends(points, pointSummary).boards,
    [points, pointSummary],
  )
  const assignees = useMemo(
    () => buildTechAssignees(facts, range),
    [facts, range],
  )
  const backlog = useMemo(
    () => buildTechBacklog(facts, todayInKorea()),
    [facts],
  )
  const breakdowns = useMemo(
    () => buildTechBreakdowns(facts, range),
    [facts, range],
  )

  const toggleRow = useCallback((key: string) => {
    setOpenRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  return {
    state: {
      status,
      syncedAt,
      basis,
      kings,
      summary,
      points,
      pointSummary,
      trends,
      assignees,
      backlog,
      breakdowns,
      openRows,
    },
    actions: {
      reload,
      changeBasis: setBasis,
      toggleRow,
    },
  }
}

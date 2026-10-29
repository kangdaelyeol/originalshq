import { useMemo, useState } from 'react'
import type { MondayKpiFacts } from '@/screens/xtool-lead-manager/entity'
import {
  buildCsTeamStats,
  buildIntakeKpi,
  computeKpis,
  periodKeyOf,
  csCandidates,
  sortKpiPairRows,
  sortKpiRows,
  type KpiRange,
  type KpiUnit,
  type NeglectRow,
  type TableSort,
} from '@/screens/xtool-lead-manager/utils'
import {
  oneOf,
  recordOf,
  usePersistentState,
} from '@/hooks/use-persistent-state'

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
    description: '설정 기간동안 확정된 방문체험 수와 전체 상담수 대비 비율',
  },
  'paid-rate': {
    title: '결제 전환',
    description:
      '설정 기간동안 결제된 상담 수(결제일 기준), 전체 상담수 대비 비율',
  },
}

export type KpiPairSortBy = 'count' | 'rate'

/** 카드마다 보기 — 그래프 / 표. 키: 인입 처리(intake), 방문체험 확정
 * (confirm-rate), 결제 전환(paid-rate), 콜백 미처리(neglect). */
export type CsCardView = 'chart' | 'table'
export type CsCardKey = 'intake' | 'confirm-rate' | 'paid-rate' | 'neglect'
const DEFAULT_VIEWS: Record<CsCardKey, CsCardView> = {
  intake: 'chart',
  'confirm-rate': 'chart',
  'paid-rate': 'chart',
  neglect: 'chart',
}

/**
 * 인입통계 맨 아래 CS팀 섹션 — 위 인입통계와 같은 기간·단위(내비 줄)로 본다.
 *   · 인입 처리·구매 전환·방문체험 전환 카드 — 그 기간에 접수된 상담 기준
 *   · 인입 처리 수(담당자 × 기간) — 위 카드와 같은 기준을 기간별로
 *   · 방문체험 확정·결제 전환(건수와 비율을 한 표에) — 개인 KPI와 같은 계산을
 *     CS팀 담당자 기록만으로(합계도 CS팀 합)
 *   · 콜백 미처리 — 기간과 무관한 지금 현황, CS팀 담당자만
 * 명단은 이 브라우저(localStorage)에 두어 사람마다 따로 고를 수 있다.
 */
export const useCsTeamViewModel = ({
  facts,
  callbackNeglect,
  tableSorts,
  unit,
  dates,
}: {
  facts: MondayKpiFacts
  /** 통계 탭의 콜백 미처리(담당자별, 정렬까지 된 것). */
  callbackNeglect: NeglectRow[]
  /** 표 정렬 상태 — 통계 탭과 같이 쓴다(키는 "cs-kpi:지표"). */
  tableSorts: Record<string, TableSort>
  /** 인입통계의 묶는 단위(일별·주차별·월별) — 표의 칸이 된다. */
  unit: KpiUnit
  /** 인입통계의 조회 기간(양 끝 포함). */
  dates: { start: string; end: string }
}) => {
  const [members, setMembers] = usePersistentState<string[]>(
    'xtool.csTeam.members',
    [],
    parseMembers,
  )
  const [editing, setEditing] = useState(false)
  // 카드마다 그래프 / 표 — 이 브라우저에 남긴다.
  const [views, setViews] = usePersistentState<Record<CsCardKey, CsCardView>>(
    'xtool.csTeam.views',
    DEFAULT_VIEWS,
    recordOf(DEFAULT_VIEWS, oneOf<CsCardView>(['chart', 'table'])),
  )
  // 표마다 정렬 기준 — 건수(기본) / 비율.
  const [sortBy, setSortBy] = useState<Record<string, KpiPairSortBy>>({})

  // 표의 칸(기간 키) 범위 — 조회 기간이 걸친 일·주(월요일 시작)·월.
  const range = useMemo<KpiRange>(
    () => ({
      from: periodKeyOf(dates.start, unit),
      to: periodKeyOf(dates.end, unit),
    }),
    [dates, unit],
  )

  // 조회 기간 밖의 날짜는 지운다 — 주·월 칸이 기간보다 넓어도(기간이 달
  // 중간에서 시작하는 등) 기간 안에 일어난 것만 센다. 위 인입통계와 같다.
  const inRangeFacts = useMemo<MondayKpiFacts>(() => {
    const clip = (date: string) =>
      date && date >= dates.start && date <= dates.end ? date : ''
    return {
      ...facts,
      consultations: facts.consultations.map(
        ([assignee, receivedAt, confirmedAt, paidAt, isNew]) => [
          assignee,
          clip(receivedAt),
          clip(confirmedAt),
          clip(paidAt),
          isNew,
        ],
      ),
    }
  }, [facts, dates])

  const memberSet = useMemo(() => new Set(members), [members])

  const stats = useMemo(
    () => buildCsTeamStats(facts.consultations, members, dates),
    [facts, members, dates],
  )

  // 개인 KPI와 같은 계산 — CS팀 담당자의 상담만 넣어서 합계도 CS팀 합이다.
  const kpi = useMemo(() => {
    const { periods, kpis } = computeKpis(
      {
        consultations: inRangeFacts.consultations.filter(([assignee]) =>
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
      // 인입 처리 수 — 건수만 있는 표(방문체험 확정·결제 전환 위에 둔다).
      intake: (() => {
        const intake = buildIntakeKpi(
          inRangeFacts.consultations,
          members,
          unit,
          range,
        )
        return {
          ...intake,
          rows: sortKpiRows(intake.rows, tableSorts['cs-kpi:intake'], periods),
        }
      })(),
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
  }, [inRangeFacts, members, memberSet, unit, range, tableSorts, sortBy])

  const neglect = useMemo(
    () => callbackNeglect.filter((row) => memberSet.has(row.assignee)),
    [callbackNeglect, memberSet],
  )

  // 명단 편집 창의 후보 — 상담 담당자로 나온 이름들(많이 맡은 순).
  const candidates = useMemo(() => csCandidates(facts.consultations), [facts])

  return {
    state: {
      members,
      editing,
      candidates,
      unit,
      stats,
      kpi,
      neglect,
      views,
    },
    actions: {
      openEditor: () => setEditing(true),
      closeEditor: () => setEditing(false),
      /** 명단 저장(이 브라우저) — 저장하고 편집 창을 닫는다. */
      save: (next: string[]) => {
        setMembers(next)
        setEditing(false)
      },
      /** 표 하나의 정렬 기준(건수 / 비율)을 바꾼다. */
      changeSortBy: (id: string, by: KpiPairSortBy) =>
        setSortBy((prev) => ({ ...prev, [id]: by })),
      /** 카드 하나의 보기(그래프 / 표)를 바꾼다. */
      changeView: (key: CsCardKey, view: CsCardView) =>
        setViews((prev) => ({ ...prev, [key]: view })),
    },
  }
}

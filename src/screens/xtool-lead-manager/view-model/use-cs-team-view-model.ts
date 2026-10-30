import { useMemo, useState } from 'react'
import type { MondayKpiFacts } from '@/screens/xtool-lead-manager/entity'
import {
  buildCsConversionKpi,
  buildCsTeamStats,
  buildIntakeKpi,
  csContributors,
  type CsContributorKind,
  type CsConversionId,
  periodKeyOf,
  periodsBetween,
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

/** 전환 표 — 접수일 기준(buildCsConversionKpi). 비율 하나가 분자(전환 건수)·
 * 분모(접수 상담 수)를 다 갖고 있어서, 건수와 비율을 한 표에 같이 그린다.
 * 개인 KPI 탭의 같은 이름 지표는 "그 기간에 일어난 일" 기준이라 다르다. */
const CS_KPIS: Record<CsConversionId, { title: string; description: string }> =
  {
    'confirm-rate': {
      title: '방문체험 확정',
      description:
        '설정 기간에 접수된 상담 중 방문체험이 확정된 수와 비율 — 접수일 기준, 확정은 지금까지. 최근 접수분은 아직 확정 전이라 낮게 나온다(한 달은 지나야 정확).',
    },
    'paid-rate': {
      title: '결제 전환',
      description:
        '설정 기간에 접수된 상담 중 결제된 수와 비율 — 접수일 기준, 결제는 지금까지. 최근 접수분은 아직 결제 전이라 낮게 나온다(한 달은 지나야 정확).',
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
  // 펼친 줄("카드:담당자") — 그 숫자를 이룬 상담 목록을 보여준다.
  const [openRows, setOpenRows] = useState<ReadonlySet<string>>(() => new Set())
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

  // 인입 처리 수 + 전환 표(방문체험 확정·결제 전환) — 전부 접수일 기준이라
  // 기간 합계가 위 카드(stats)와 같다. 전환은 기간 뒤에 일어난 것도 세야 해서
  // 날짜를 자르지 않은 원본(facts)으로 센다.
  const kpi = useMemo(() => {
    const periods = periodsBetween(unit, range)
    const kpis = (Object.keys(CS_KPIS) as CsConversionId[]).map((id) =>
      buildCsConversionKpi(
        id,
        facts.consultations,
        members,
        unit,
        range,
        dates,
      ),
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
      kpis: kpis.map((each) => {
        const by = sortBy[each.id] ?? 'count'
        return {
          ...each,
          ...CS_KPIS[each.id as CsConversionId],
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
  }, [facts, inRangeFacts, members, unit, range, dates, tableSorts, sortBy])

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
      openRows,
      /** 한 담당자의 그 숫자를 이룬 상담들(최근 순) — 예전 데이터면 null. */
      contributorsOf: (assignee: string, kind: CsContributorKind) =>
        csContributors(facts, assignee, kind, dates),
    },
    actions: {
      /** 줄 하나를 펼치거나 접는다. */
      toggleRow: (key: string) =>
        setOpenRows((prev) => {
          const next = new Set(prev)
          if (next.has(key)) next.delete(key)
          else next.add(key)
          return next
        }),
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

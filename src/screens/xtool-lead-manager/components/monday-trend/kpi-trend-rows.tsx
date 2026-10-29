import type { TrendListColumns, TrendListRow } from '@/components/glass'
import { formatKpi, type KpiResult } from '@/screens/xtool-lead-manager/utils'

type Cell = KpiResult['sum']['total']

const share = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '-'

/**
 * 지표 하나(KpiResult)를 담당자별 추이 목록 줄로 — 개인 KPI 카드와 CS팀 인입
 * 처리 수가 같이 쓴다. 지표 모양에 따라:
 *   · 건수·금액 — 그래프는 기간별 값, 합계 칸은 값, 막대는 모두 합 대비 비중
 *   · 비율      — 그래프는 기간별 비율, 합계 칸은 분자(건수), 막대는 비율
 *     (가장 높은 사람 = 가득)
 * 줄은 값이 큰 순(비율은 비율 순).
 */
export const kpiTrendRows = (
  each: KpiResult,
  labels: string[],
): TrendListRow[] => {
  const isRate = each.format === 'percent'
  const max = Math.max(0, ...each.rows.map((row) => row.total.value))
  const text = (cell: Cell) =>
    isRate
      ? `${formatKpi(cell, 'percent')} · ${(cell.num ?? 0).toLocaleString('ko-KR')}건`
      : formatKpi(cell, each.format) + (each.format === 'count' ? '건' : '')

  return [...each.rows]
    .sort((a, b) => b.total.value - a.total.value)
    .map((row) => {
      const series = row.byPeriod.map((cell) => cell.value)
      const peak = series.indexOf(Math.max(...series))
      return {
        key: row.assignee,
        name: row.assignee,
        series,
        seriesText: row.byPeriod.map(text),
        value: isRate ? (
          <>
            {(row.total.num ?? 0).toLocaleString('ko-KR')}
            <small>건</small>
          </>
        ) : each.format === 'won' ? (
          formatKpi(row.total, 'won')
        ) : (
          <>
            {row.total.value.toLocaleString('ko-KR')}
            <small>건</small>
          </>
        ),
        bar: {
          ratio: max > 0 ? row.total.value / max : 0,
          text: isRate
            ? formatKpi(row.total, 'percent')
            : share(row.total.value, each.sum.total.value),
        },
        peak:
          series[peak] > 0
            ? {
                index: peak,
                text: (
                  <>
                    {labels[peak]} ·{' '}
                    <strong>{text(row.byPeriod[peak]).split(' · ')[0]}</strong>
                  </>
                ),
              }
            : null,
        ariaLabel: `${row.assignee} ${text(row.total)}`,
      }
    })
}

/** 그 지표에 맞는 추이 목록 머리글. noun은 "날/주/달". */
export const kpiTrendColumns = (
  each: KpiResult,
  noun: string,
  name = '담당자',
): TrendListColumns =>
  each.format === 'percent'
    ? { name, value: '건수', bar: '비율', peak: `가장 높은 ${noun}` }
    : {
        name,
        value: each.format === 'won' ? '금액' : '합계',
        bar: '비중',
        peak: `가장 많은 ${noun}`,
      }

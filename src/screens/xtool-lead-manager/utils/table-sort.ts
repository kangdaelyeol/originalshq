import type { SortDirection } from '../types'
import type { KpiRow } from './monday-kpi'
import type { NeglectRow } from './monday-neglect'
import type { PipelineRow, PipelineStage } from './monday-pipeline'
import { shortBoardName } from './monday-trend'

/** 표 하나의 정렬 상태 — 아직 머리글을 누르지 않은 표는 정렬 상태가 없고,
 * 계산된 순서(지표가 큰 순 등) 그대로 보인다. */
export interface TableSort {
  key: string
  direction: SortDirection
}

/** 값 하나를 꺼내는 함수로 줄을 정렬한다. 글자는 가나다순, 숫자는 크기순. */
const sortRows = <T>(
  rows: T[],
  sort: TableSort | undefined,
  valueOf: (row: T, key: string) => string | number,
): T[] => {
  if (!sort) return rows
  const sign = sort.direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = valueOf(a, sort.key)
    const y = valueOf(b, sort.key)
    const diff =
      typeof x === 'string' || typeof y === 'string'
        ? String(x).localeCompare(String(y), 'ko')
        : x - y
    return diff * sign
  })
}

/** 방치 표 — 칸 키는 NeglectRow의 필드 이름(assignee, open, rate …). */
export const sortNeglectRows = (
  rows: NeglectRow[],
  sort: TableSort | undefined,
): NeglectRow[] =>
  sortRows(rows, sort, (row, key) => {
    const value = row[key as keyof NeglectRow]
    return typeof value === 'number' || typeof value === 'string' ? value : 0
  })

/** 개인 KPI 표 — 칸 키는 'assignee', 'total', 또는 기간 키. 값이 없는 비율
 * 칸('-', 모수 0)은 0%보다도 아래로 보낸다. */
export const sortKpiRows = (
  rows: KpiRow[],
  sort: TableSort | undefined,
  periods: string[],
): KpiRow[] =>
  sortRows(rows, sort, (row, key) => {
    if (key === 'assignee') return row.assignee
    const cell =
      key === 'total' ? row.total : row.byPeriod[periods.indexOf(key)]
    if (!cell) return -1
    return cell.den === 0 && cell.num !== undefined && cell.value === 0
      ? -1
      : cell.value
  })

/** 건수·비율을 한 칸에 같이 보이는 KPI 표(인입통계 CS팀 섹션) — by가
 * 'count'면 건수(분자)로, 'rate'면 비율로 정렬한다. 비율의 빈 칸(모수 0)은
 * 0%보다도 아래로. */
export const sortKpiPairRows = (
  rows: KpiRow[],
  sort: TableSort | undefined,
  periods: string[],
  by: 'count' | 'rate',
): KpiRow[] =>
  by === 'rate'
    ? sortKpiRows(rows, sort, periods)
    : sortRows(rows, sort, (row, key) => {
        if (key === 'assignee') return row.assignee
        const cell =
          key === 'total' ? row.total : row.byPeriod[periods.indexOf(key)]
        return cell?.num ?? 0
      })

/** 현재 파이프라인 표 — 칸 키는 'board', 'total', 또는 단계 이름. */
export const sortPipelineRows = (
  rows: PipelineRow[],
  sort: TableSort | undefined,
): PipelineRow[] =>
  sortRows(rows, sort, (row, key) =>
    key === 'board'
      ? shortBoardName(row.board)
      : key === 'total'
        ? row.total
        : row.counts[key as PipelineStage],
  )

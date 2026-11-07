import type { CSSProperties } from 'react'
import type { TechCellValue, TechColumn } from '@xtool-core/tech-boards'
import { labelColor } from '@xtool-core/monday-colors'
import { LEFT_TYPES } from '@xtool-core/monday-values'
import { cx } from '@/ohq-ui/lib/cx'

// Monday 표 칸의 값 다루기 — 값·너비·정렬·날짜 글자는 웹·앱이 같이 쓰도록 공용 패키지(xtool-core/monday-values)로
// 옮겼다. 여기에는 웹 화면에만 쓰는 클래스·스타일만 남긴다.
export * from '@xtool-core/monday-values'

/** 칸 정렬·모양 클래스 */
export const cellClass = (column: TechColumn): string =>
  cx('mon-cell', `mon-cell--${column.type}`, LEFT_TYPES.has(column.type) && 'is-left')

/** 상태 칸은 칸 전체를 라벨 색으로 칠한다. */
export const cellStyle = (column: TechColumn, cell: TechCellValue | undefined): CSSProperties | undefined =>
  column.type === 'status' ? ({ '--label': labelColor(cell?.text) } as CSSProperties) : undefined

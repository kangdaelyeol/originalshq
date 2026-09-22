export type IndexSeriesType = 'line' | 'bar'

export interface IndexSeries {
  key: string
  label: string
  color: string
  /** 'line'(꺾은선) / 'bar'(막대). 생략하면 'line'. */
  type?: IndexSeriesType
  /** 그래프 좌상단 단위 표기용("지표명(단위)"). */
  unit: string
  /** 카테고리(x) 순서에 맞춘 원본 값. */
  raw: readonly number[]
  /** 툴팁에 원본 값을 보여줄 때 쓰는 포맷터(단위 포함). */
  format: (v: number) => string
  /** y축 눈금용 — 단위 없이 간결하게. */
  formatCompact: (v: number) => string
}

export type ChartTheme = 'dark' | 'light'

/** "대비 표시" 드롭다운 — 포커스(호버/범례)된 지표에 한해 켠다.
 * 'off': 끄기(기본). 'minmax': 그 지표의 최저·최고 값 지점에만, 최근일(마지막
 * 유효 지점) 값 대비 증감을 표시. 'all': 그 지표의 모든 지점에 직전 지점 대비
 * 증감을 표시. */
export type CompareMode = 'off' | 'minmax' | 'all'

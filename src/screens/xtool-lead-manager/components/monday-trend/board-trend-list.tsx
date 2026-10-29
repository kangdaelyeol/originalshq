import { TrendList, type TrendListRow } from '@/components/glass'
import {
  shortBoardName,
  type BoardTrend,
  type InflowPoint,
} from '@/screens/xtool-lead-manager/utils'

const percent = (share: number) => `${(share * 100).toFixed(1)}%`

/** 항목 하나(BoardTrend — 보드·제품)를 추이 목록 한 줄로. 막대는 비중(가장
 * 큰 항목 = 가득, 따로 둔 줄도 같은 기준이라 길이를 견줄 수 있다). */
const trendRow = (
  trend: BoardTrend,
  maxShare: number,
  unit: string,
): TrendListRow => ({
  key: trend.name,
  name: shortBoardName(trend.name),
  title: trend.name,
  series: trend.series,
  seriesText: trend.series.map((value) => `${value}${unit}`),
  value: (
    <>
      {trend.total.toLocaleString('ko-KR')}
      <small>{unit}</small>
    </>
  ),
  bar: {
    ratio: maxShare > 0 ? trend.share / maxShare : 0,
    text: percent(trend.share),
  },
  peak: trend.peak && {
    index: trend.peak.index,
    text: (
      <>
        {trend.peak.label} ·{' '}
        <strong>
          {trend.peak.count}
          {unit}
        </strong>
      </>
    ),
  },
  ariaLabel: `${trend.name} ${trend.total}${unit}, 전체의 ${percent(trend.share)}`,
})

/**
 * 항목별 추이 — 기간 × 항목(보드·제품) 표를 항목 쪽으로 돌린 것. extra는 맨
 * 아래 따로(주의색) 두는 줄(인입통계의 오기입). limit을 주면 많은 순으로 그만큼만
 * 그리고 나머지 수를 알려 준다(판매통계 제품처럼 항목이 많을 때). 날짜별 정확한
 * 숫자는 "표" 보기에서.
 */
export const BoardTrendList = ({
  trends,
  extra,
  points,
  columns,
  unit = '건',
  limit,
  empty = '이 기간에 기록이 없습니다.',
  wideName,
}: {
  trends: BoardTrend[]
  extra?: BoardTrend
  points: InflowPoint[]
  /** 머리글 — { name: '보드', peak: '가장 많은 날' } 등. */
  columns: { name: string; peak: string }
  unit?: string
  limit?: number
  empty?: string
  /** 이름이 긴 항목(제품명) — 이름 칸을 넓힌다. */
  wideName?: boolean
}) => {
  const maxShare = Math.max(0, ...trends.map((each) => each.share))
  const shown = limit ? trends.slice(0, limit) : trends
  const hidden = trends.length - shown.length
  return (
    <>
      <TrendList
        rows={shown.map((each) => trendRow(each, maxShare, unit))}
        extra={extra && [trendRow(extra, maxShare, unit)]}
        labels={points.map((point) => point.label)}
        columns={{
          name: columns.name,
          value: '합계',
          bar: '비중',
          peak: columns.peak,
        }}
        empty={empty}
        wideName={wideName}
      />
      {hidden > 0 && (
        <p className="board_trend_more">
          수량 상위 {shown.length}개만 보여 줍니다 · 나머지 {hidden}개는 표에서
        </p>
      )}
    </>
  )
}

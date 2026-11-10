import { Fragment, useState } from 'react'
import { GlassLine, useElementSize } from '@/components/glass'
import {
  niceTicks,
  shortBoardName,
  type InflowPoint,
} from '@/screens/xtool-lead-manager/utils'

/** 툴팁에 적는 항목 수 — 판매통계처럼 제품이 많아도 툴팁이 화면을 덮지 않게. */
const TOOLTIP_ROWS = 10

/** 툴팁 항목을 무리(채널)로 가르는 법 — 판매통계가 온라인·오프라인을 가를 때.
 * keyOf는 칸 이름을 항목 이름과 무리로 나누고, tags는 무리를 적는 순서다. */
export type InflowSplit = {
  keyOf: (key: string) => { name: string; tag: string }
  tags: readonly string[]
}

type TooltipRow = { name: string; total: number; parts: Map<string, number> }

/** 툴팁 항목 — 무리로 가르면 같은 이름을 한 줄로 합치고 무리별 수를 단다. */
const tooltipRows = (
  boards: Record<string, number>,
  split?: InflowSplit,
): TooltipRow[] => {
  const byName = new Map<string, TooltipRow>()
  for (const [key, value] of Object.entries(boards)) {
    const { name, tag } = split ? split.keyOf(key) : { name: key, tag: '' }
    const row = byName.get(name) ?? { name, total: 0, parts: new Map() }
    row.total += value
    if (split) row.parts.set(tag, (row.parts.get(tag) ?? 0) + value)
    byName.set(name, row)
  }
  return [...byName.values()].sort((a, b) => b.total - a.total)
}

/** x축 날짜 표기를 몇 칸마다 하나씩 보일지 — 많아야 10개쯤 보이게. */
const labelEvery = (count: number): number => Math.max(1, Math.ceil(count / 10))

/**
 * 인입 건수 선 그래프 — 점 하나가 하루, 한 주, 또는 한 달이다.
 *
 * 선 하나(전체 인입)와 그 기간의 평균선을 그린다 — 한 계열이라 범례가 필요
 * 없고(평균선은 선 끝에 이름을 직접 적는다), 제목이 무엇을 그렸는지 말해 준다. 값은 축과 툴팁으로 읽고, 표(아래 InflowTable)가 같은
 * 숫자를 전부 보여준다.
 *
 * 선·면은 그래프 상자의 실제 크기(px)로 그린 유리 선(GlassLine)이고, 글자와
 * 점은 그 위에 %로 얹은 HTML이다. 마우스를 올린 날의 세로선·점·툴팁은 날짜 칸의
 * :hover / :focus로만 띄워서 상태를 두지 않는다.
 */
export const InflowChart = ({
  points,
  average,
  metric = { name: '인입', unit: '건' },
  split,
}: {
  points: InflowPoint[]
  /** 기간 평균 — 가로 기준선으로 그린다. */
  average: number
  /** 툴팁의 이름·단위 — 판매통계는 { name: '판매', unit: '개' }. 툴팁의
   * 항목(보드·제품)은 많은 순으로 TOOLTIP_ROWS개까지, 나머지는 "외 n개". */
  metric?: { name: string; unit: string }
  /** 주면 툴팁의 항목마다 무리(예: 오프라인·온라인) 표시를 달고, 합계 밑에
   * 무리별 합계를 적는다. */
  split?: InflowSplit
}) => {
  // 선은 그래프 상자의 실제 크기(px)로 그린다 — 늘려 맞추면 곡선이 찌그러진다.
  const [plotRef, plot] = useElementSize<HTMLDivElement>()
  // 마우스를 올린(초점이 간) 날 — 그 칸의 툴팁만 그린다.
  const [hover, setHover] = useState<number | null>(null)
  const ticks = niceTicks(Math.max(...points.map((point) => point.total), 0))
  const top = ticks[ticks.length - 1]
  const count = points.length

  // 날짜 칸의 한가운데에 점이 오도록 — 호버 칸(같은 너비로 n등분)과 맞춘다.
  const xOf = (index: number) => ((index + 0.5) / count) * 100
  const yOf = (value: number) => 100 - (value / top) * 100

  const every = labelEvery(count)
  // 점은 날짜가 많으면 서로 붙어 선을 가리므로, 한 달 이내일 때만 늘 보인다.
  const showMarkers = count <= 31

  return (
    <div className="inflow_chart">
      <div className="inflow_y_axis" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick} style={{ bottom: `${(tick / top) * 100}%` }}>
            {tick.toLocaleString('ko-KR')}
          </span>
        ))}
      </div>

      <div ref={plotRef} className="inflow_plot">
        {ticks.map((tick) => (
          <span
            key={tick}
            className="inflow_grid"
            style={{ bottom: `${(tick / top) * 100}%` }}
          />
        ))}

        {/* 평균선 — 각 점이 평균보다 위인지 아래인지 한눈에 보이게 하는
            기준선. 눈금선과 헷갈리지 않게 점선으로, 이름과 값을 끝에 적는다. */}
        {count > 1 && average > 0 && (
          <span
            className="inflow_average"
            style={{ bottom: `${(average / top) * 100}%` }}
          >
            <em>
              평균 {(Math.round(average * 10) / 10).toLocaleString('ko-KR')}
            </em>
          </span>
        )}

        <div className="inflow_svg">
          <GlassLine
            width={plot.width}
            height={plot.height}
            points={points.map((point, index) => [
              (xOf(index) / 100) * plot.width,
              (yOf(point.total) / 100) * plot.height,
            ])}
          />
        </div>

        {/* 날짜마다 한 칸 — 그 칸 전체가 호버 대상이라, 가느다란 선이나 작은
            점을 정확히 겨누지 않아도 된다. */}
        <div className="inflow_columns">
          {points.map((point, index) => (
            <div
              key={point.date}
              className={['inflow_column', showMarkers ? 'has_marker' : '']
                .join(' ')
                .trim()}
              tabIndex={0}
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
              aria-label={`${point.label} ${metric.name} ${point.total}${metric.unit}`}
            >
              <span
                className="inflow_marker"
                style={{ top: `${yOf(point.total)}%` }}
              />
              {/* 툴팁은 마우스를 올린(초점이 간) 칸 하나만 그린다 — 칸마다 미리
                  만들면 기간이 길 때 수천 개가 된다. */}
              {hover === index && (
                <div
                  className={[
                    'inflow_tooltip',
                    // 오른쪽 끝에서는 툴팁이 그래프 밖으로 나가지 않게 왼쪽으로 편다.
                    index > count * 0.6 ? 'to_left' : '',
                  ]
                    .join(' ')
                    .trim()}
                  style={{ top: `${yOf(point.total)}%` }}
                >
                  <strong>{point.label}</strong>
                  <span className="total">
                    {metric.name} {point.total.toLocaleString('ko-KR')}
                    {metric.unit}
                  </span>
                  {(() => {
                    const rows = tooltipRows(point.boards ?? {}, split)
                    const rest = rows.length - TOOLTIP_ROWS
                    // 무리별 합계 — 그 칸에 있던 무리만, 정해진 순서로.
                    const tagTotals = split
                      ? split.tags
                          .map((tag) => ({
                            tag,
                            value: rows.reduce(
                              (sum, row) => sum + (row.parts.get(tag) ?? 0),
                              0,
                            ),
                          }))
                          .filter((part) => part.value > 0)
                      : []
                    const tagClass = (tag: string) =>
                      `inflow_tag tag_${split?.tags.indexOf(tag) ?? 0}`
                    return (
                      <>
                        {tagTotals.length > 0 && (
                          <span className="inflow_tag_totals">
                            {tagTotals.map(({ tag, value }) => (
                              <span key={tag}>
                                <i className={tagClass(tag)}>{tag}</i>
                                {value.toLocaleString('ko-KR')}
                              </span>
                            ))}
                          </span>
                        )}
                        <dl>
                          {/* 그 칸에 있던 항목(보드·제품)만, 많은 순으로. */}
                          {rows.slice(0, TOOLTIP_ROWS).map((row) => {
                            const parts = (split?.tags ?? []).filter((tag) =>
                              row.parts.has(tag),
                            )
                            return (
                              <Fragment key={row.name}>
                                <dt>
                                  <span className="inflow_tip_name">
                                    {shortBoardName(row.name)}
                                  </span>
                                  {/* 무리 하나면 이름만, 둘 이상이면 수까지. */}
                                  {parts.map((tag) => (
                                    <i key={tag} className={tagClass(tag)}>
                                      {tag}
                                      {parts.length > 1 &&
                                        ` ${(row.parts.get(tag) ?? 0).toLocaleString('ko-KR')}`}
                                    </i>
                                  ))}
                                </dt>
                                <dd>{row.total.toLocaleString('ko-KR')}</dd>
                              </Fragment>
                            )
                          })}
                          {rest > 0 && (
                            <>
                              <dt className="sub">외 {rest}개</dt>
                              <dd className="sub" />
                            </>
                          )}
                          {point.misentry > 0 && (
                            <>
                              <dt className="sub">오기입</dt>
                              <dd className="sub">{point.misentry}</dd>
                            </>
                          )}
                        </dl>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="inflow_x_axis" aria-hidden="true">
        {points.map((point, index) => (
          <span key={point.date}>
            {index % every === 0 ? point.axisLabel : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

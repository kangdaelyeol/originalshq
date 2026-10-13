import { Fragment } from 'react'
import {
  niceTicks,
  shortBoardName,
  type InflowPoint,
} from '@/screens/xtool-lead-manager/utils'

/** x축 날짜 표기를 몇 칸마다 하나씩 보일지 — 많아야 10개쯤 보이게. */
const labelEvery = (count: number): number => Math.max(1, Math.ceil(count / 10))

/**
 * 인입 건수 선 그래프 — 점 하나가 하루, 한 주, 또는 한 달이다.
 *
 * 선 하나(전체 인입)와 그 기간의 평균선을 그린다 — 한 계열이라 범례가 필요
 * 없고(평균선은 선 끝에 이름을 직접 적는다), 제목이 무엇을 그렸는지 말해 준다. 값은 축과 툴팁으로 읽고, 표(아래 InflowTable)가 같은
 * 숫자를 전부 보여준다.
 *
 * 크기에 맞춰 늘어나도록 선·면만 SVG(가로세로 0~100, 비율 무시)로 그리고,
 * 글자와 점은 그 위에 %로 얹은 HTML이다 — SVG를 늘리면 글자와 점까지
 * 찌그러지기 때문이다. 마우스를 올린 날의 세로선·점·툴팁은 날짜 칸의
 * :hover / :focus로만 띄워서 상태를 두지 않는다.
 */
export const InflowChart = ({
  points,
  average,
}: {
  points: InflowPoint[]
  /** 기간 평균 — 가로 기준선으로 그린다. */
  average: number
}) => {
  const ticks = niceTicks(Math.max(...points.map((point) => point.total), 0))
  const top = ticks[ticks.length - 1]
  const count = points.length

  // 날짜 칸의 한가운데에 점이 오도록 — 호버 칸(같은 너비로 n등분)과 맞춘다.
  const xOf = (index: number) => ((index + 0.5) / count) * 100
  const yOf = (value: number) => 100 - (value / top) * 100

  const line = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${xOf(index)},${yOf(point.total)}`,
    )
    .join(' ')
  const area =
    count > 0 ? `${line} L${xOf(count - 1)},100 L${xOf(0)},100 Z` : ''

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

      <div className="inflow_plot">
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

        <svg
          className="inflow_svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path className="inflow_area" d={area} />
          <path className="inflow_line" d={line} />
        </svg>

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
              aria-label={`${point.label} 인입 ${point.total}건`}
            >
              <span
                className="inflow_marker"
                style={{ top: `${yOf(point.total)}%` }}
              />
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
                  인입 {point.total.toLocaleString('ko-KR')}건
                </span>
                <dl>
                  {/* 그날 인입이 있던 보드만, 많은 순으로. */}
                  {Object.entries(point.boards ?? {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, boardCount]) => (
                      <Fragment key={name}>
                        <dt>{shortBoardName(name)}</dt>
                        <dd>{boardCount}</dd>
                      </Fragment>
                    ))}
                  {point.misentry > 0 && (
                    <>
                      <dt className="sub">오기입</dt>
                      <dd className="sub">{point.misentry}</dd>
                    </>
                  )}
                </dl>
              </div>
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

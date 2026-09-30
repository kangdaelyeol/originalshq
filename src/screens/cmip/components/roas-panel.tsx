import { useState } from 'react'
import type {
  Cafe24RevenueSummary,
  CombinedInsight,
  OfflineRevenueSummary,
} from '../client'
import { SingleSelectDropdown } from './single-select-dropdown'
import {
  RoasGrouping,
  useRoasViewModel,
  type RoasMetrics,
  type RoasRow,
} from '../view-model/use-roas-view-model'
import { useRoasTrendChartViewModel } from '../view-model/use-roas-trend-chart-view-model'

const GROUPING_OPTIONS: readonly { value: RoasGrouping; label: string }[] = [
  { value: RoasGrouping.DATE, label: '일별' },
  { value: RoasGrouping.DAY_OF_WEEK, label: '요일별' },
  { value: RoasGrouping.WEEK, label: '주차별' },
  { value: RoasGrouping.MONTH, label: '월별' },
]

const num2 = (v: number): string =>
  v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const won = (v: number): string => `${Math.round(v).toLocaleString()}원`
const pct2 = (v: number): string => `${num2(v)}%`

interface RoasField {
  /** React key용 — RoasMetrics의 실제 필드일 수도(예: 'roas'), 여러 필드를
   * 합친 파생값일 수도 있다(예: 'offlineTotalRevenue') — 그래서 getValue로
   * 값을 뽑고 key는 식별자로만 쓴다. */
  key: string
  label: string
  getValue: (m: RoasMetrics) => number
  format: (v: number) => string
  formatCompact: (v: number) => string
  /** 있으면 라벨 옆에 "?" 아이콘을 달아 호버 시 설명을 보여준다 —
   * metric-fields.ts의 MetricField.note, channel-insight.tsx의
   * SortableMetricHeader와 같은 패턴. */
  note?: string
}

// "ROAS 요약"과 "기간별 추이" 표가 공유하는 핵심 지표 — ROAS 계산에 직접
// 쓰이는 것들만 남긴다(광고비 대비 매출을 보는 화면이라, 배송비/적립금/
// 쿠폰할인/할부이자 같은 세부 항목은 아래 OFFLINE_FIELDS/ONLINE_FIELDS의
// 전용 표로 옮겼다).
const ROAS_FIELDS: readonly RoasField[] = [
  { key: 'roas', label: 'ROAS', getValue: (m) => m.roas, format: pct2, formatCompact: pct2 },
  {
    key: 'totalRevenue',
    label: '총 매출',
    getValue: (m) => m.totalRevenue,
    format: won,
    formatCompact: won,
  },
  { key: 'spend', label: '광고비', getValue: (m) => m.spend, format: won, formatCompact: won },
  {
    key: 'onlineRevenue',
    label: '온라인 매출',
    getValue: (m) => m.onlineRevenue,
    format: won,
    formatCompact: won,
    note: 'ROAS 계산용 온라인 매출 = 카페24 매출액(관리자 화면 순매출, 배송비 포함) - 배송비 - 순 적립금 사용액. 배송비는 택배사로 나가는 실비 통과항목, 적립금 결제는 광고로 새로 유입된 매출이 아니라 이미 쌓여있던 포인트를 쓴 것뿐이라 ROAS에서는 둘 다 빼서 봅니다. 카페24 화면과 똑같은 숫자는 아래 "카페24 온라인 매출" 표의 "카페24 매출액"에 있습니다.',
  },
  {
    key: 'offlineRevenue',
    label: '오프라인 매출',
    getValue: (m) => m.offlineRevenue,
    format: won,
    formatCompact: won,
  },
]

// "오프라인 매출" 전용 표 — Monday CRM 매장 결제 내역의 총매출/순매출/할부이자
// 구성을 따로 보여준다. offlineTotalRevenue는 저장된 필드가 아니라
// offlineRevenue(할부이자 제외 순매출)+installmentInterest를 더해 되돌린
// 파생값이다.
const OFFLINE_FIELDS: readonly RoasField[] = [
  {
    key: 'offlineTotalRevenue',
    label: '오프라인 총매출',
    getValue: (m) => m.offlineRevenue + m.installmentInterest,
    format: won,
    formatCompact: won,
    note: '오프라인 매출 + 할부이자 — 할부이자를 다시 더한 총액입니다.',
  },
  {
    key: 'offlineRevenue',
    label: '오프라인 매출',
    getValue: (m) => m.offlineRevenue,
    format: won,
    formatCompact: won,
  },
  {
    key: 'installmentInterest',
    label: '할부이자',
    getValue: (m) => m.installmentInterest,
    format: won,
    formatCompact: won,
    note: '고객이 장기 할부(12/24/36개월)로 결제하면서 카드사에 낸 이자입니다. 매장 매출이 아니라 오프라인 매출·ROAS 계산에서 이미 제외되어 있고, 이 칸은 참고용으로 얼마가 빠졌는지만 보여줍니다.',
  },
]

// "카페24 온라인 매출" 전용 표 — 팀 전체가 보는 표라 결제/환불 원본부터
// ROAS용 순매출까지 계산 과정을 전부 순서대로 보여준다:
//  1. 매출액(ROAS용) — 광고 성과를 볼 때 쓰는 값(배송비·적립금 결제까지 제외)
//  2~3. 총 결제액/환불액 — 그 둘의 원본 재료(Cafe24RevenueMetrics.
//       grossPayment/refundAmount 그대로)
//  4. 카페24 매출액 — 관리자 화면과 맞춘 순매출(총 결제액 - 환불액, 배송비·
//     적립금 포함) = 예전에 "매출액"으로 부르던 값
//  5. 총매출 — 카페24 매출액에 쿠폰할인·상품할인을 다시 더한 총액(배송비는
//     카페24 매출액에 이미 포함돼 있어 안 더함)
//  6~9. 배송비/적립금 사용/쿠폰할인/상품할인 — 각 구성요소
const ONLINE_FIELDS: readonly RoasField[] = [
  {
    key: 'onlineRevenue',
    label: '매출액(ROAS용)',
    getValue: (m) => m.onlineRevenue,
    format: won,
    formatCompact: won,
    note: 'ROAS 계산에 쓰는 값 — 카페24 매출액(배송비 포함)에서 배송비와 순 적립금 사용액(적립금 결제 - 환불된 적립금)을 뺐습니다. 배송비는 택배사로 나가는 실비 통과항목, 적립금 결제는 광고로 새로 들어온 매출이 아니라서 ROAS 성과에서는 둘 다 제외합니다.',
  },
  {
    key: 'onlineGrossPayment',
    label: '총 결제액',
    getValue: (m) => m.onlineGrossPayment,
    format: won,
    formatCompact: won,
    note: '그 기간에 결제로 귀속된 금액 합계(배송비·적립금 포함, 환불 반영 전).',
  },
  {
    key: 'onlineRefundAmount',
    label: '환불액',
    getValue: (m) => m.onlineRefundAmount,
    format: won,
    formatCompact: won,
    note: '그 기간에 환불 완료 처리된 금액 합계(적립금/예치금 환불분 포함).',
  },
  {
    key: 'onlineRevenueCafe24',
    label: '카페24 매출액',
    getValue: (m) => m.onlineRevenueCafe24,
    format: won,
    formatCompact: won,
    note: '카페24 관리자 "일별 매출내역"과 원 단위까지 맞춘 순매출 = 총 결제액 - 환불액(배송비·적립금 포함).',
  },
  {
    key: 'onlineTotalRevenue',
    label: '총매출',
    getValue: (m) =>
      m.onlineRevenueCafe24 + m.onlineCouponDiscount + m.onlineItemDiscount,
    format: won,
    formatCompact: won,
    note: '카페24 매출액 + 쿠폰할인 + 상품할인 — 카페24 매출액 계산에서 뺀 할인 항목들을 다시 더한 총액입니다(배송비·적립금은 카페24 매출액에 이미 포함돼 있어 안 더함).',
  },
  {
    key: 'onlineShippingFee',
    label: '배송비',
    getValue: (m) => m.onlineShippingFee,
    format: won,
    formatCompact: won,
  },
  {
    key: 'onlinePointsSpent',
    label: '적립금 사용',
    getValue: (m) => m.onlinePointsSpent - m.onlinePointsRefunded,
    format: won,
    formatCompact: won,
    note: '참고용 — 카페24 매출액에 이미 포함된 적립금 결제 금액에서, 나중에 환불된 적립금(취소 등으로 되돌아간 금액)을 뺀 순 적립금 사용액입니다.',
  },
  {
    key: 'onlineCouponDiscount',
    label: '쿠폰할인',
    getValue: (m) => m.onlineCouponDiscount,
    format: won,
    formatCompact: won,
  },
  {
    key: 'onlineItemDiscount',
    label: '상품할인',
    getValue: (m) => m.onlineItemDiscount,
    format: won,
    formatCompact: won,
    note: '쿠폰과 별도로 적용된 상품 할인 금액입니다(구조화된 할인 필드에는 안 잡히고 상품구매금액과 실결제금액의 차이로만 드러남). 처음엔 스마트스토어 채널에서만 발견했는데, 자체몰/모바일 채널에서도 같은 패턴이 나와 전 채널로 넓혔습니다.',
  },
]

// channel-insight.tsx의 InfoIcon과 같은 모양 — roas-panel.tsx 전용으로 따로
// 둔다(single-select-dropdown.tsx의 ChevronIcon과 같은 모듈 독립성 이유).
function InfoIcon() {
  return (
    <svg
      className="channel-insight__info-icon"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth={1.3} />
      <path
        d="M8 7.2v4"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      <circle cx="8" cy="4.8" r="0.9" fill="currentColor" />
    </svg>
  )
}

/** 필드 라벨 — note가 있으면(현재 installmentInterest만) 옆에 "?" 아이콘을
 * 달아 호버(또는 포커스)하면 설명을 보여준다. ROAS 요약 카드·기간별 추이 표
 * 헤더가 공유한다. */
function RoasFieldLabel({ field }: { field: RoasField }) {
  if (!field.note) return <>{field.label}</>
  return (
    <>
      {field.label}
      <span className="channel-insight__info" tabIndex={0}>
        <InfoIcon />
        <span className="channel-insight__info-tooltip" role="tooltip">
          {field.note}
        </span>
      </span>
    </>
  )
}

type DeltaDir = 'up' | 'down' | 'flat'

const DELTA_ARROW: Record<DeltaDir, string> = { up: '▲', down: '▼', flat: '—' }

/** period-test-panel.tsx의 computeDelta와 같은 계산(바로 앞 행 대비 증감) —
 * 이 표 전용으로 다시 작게 둔다(모듈 독립성 우선, 이 코드베이스 여러 곳이
 * 같은 계산을 각자 갖고 있는 것과 같은 패턴). */
function computeDelta(
  now: number,
  prev: number,
): { delta: number; pct: number | null; dir: DeltaDir } {
  const delta = now - prev
  const pct = prev !== 0 ? (delta / Math.abs(prev)) * 100 : null
  const dir: DeltaDir = delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'
  return { delta, pct, dir }
}

function MetricValueCell({
  value,
  prevValue,
  field,
}: {
  value: number
  prevValue: number | null
  field: RoasField
}) {
  if (prevValue == null) {
    return <td>{field.formatCompact(value)}</td>
  }
  const { delta, pct, dir } = computeDelta(value, prevValue)
  return (
    <td>
      <span className="channel-insight__metric-cell">
        <span className={`channel-insight__metric-delta is-${dir}`}>
          {DELTA_ARROW[dir]} {field.formatCompact(Math.abs(delta))}
          {pct != null &&
            ` (${delta >= 0 ? '+' : '-'}${Math.abs(pct).toFixed(1)}%)`}
        </span>
        <span className="channel-insight__metric-value">
          {field.formatCompact(value)}
        </span>
      </span>
    </td>
  )
}

// ------------------------------------------------------------------ ROAS 추이 시각화
// viewBox를 고정 논리 크기로 두고 preserveAspectRatio="none"으로 컨테이너에
// 맞춰 늘리면, 실제 렌더 비율이 그 논리 크기의 가로세로 비율과 달라 좌표계
// 전체가 가로/세로로 다르게 늘어난다(폰트·선이 옆으로 퍼져 보임) — 그래서
// index-line-chart.tsx와 같은 방식(useRoasTrendChartViewModel)으로 실제 렌더
// 픽셀 크기를 측정해 viewBox로 그대로 쓴다(1 유닛 = 1px). top을 다른 여백보다
// 넉넉히 둔 건 막대마다 지푯값+대비 두 줄 라벨이 막대 위에 쌓이기 때문 —
// 좁으면 가장 높은 막대의 라벨이 플롯 밖(y<0)으로 잘려 나간다.
const CHART_MARGIN = { top: 34, right: 12, bottom: 26, left: 46 }

// 값·대비 라벨에 까는 halo(텍스트 뒤 배경색 stroke)용 — index-line-chart.tsx의
// PALETTE.dark.surface와 같은 값(다크 테마 표면색)이다. CSS 변수가 아니라 SVG
// stroke 속성에 리터럴로 넣어야 해서 여기 그대로 상수로 둔다.
const CHART_SURFACE = '#161b22'

/** y축 최댓값을 100 단위로 올림 — 150%면 200까지, 480%면 500까지처럼 눈금이
 * 딱 떨어지게 한다. ROAS가 전부 낮아도(예: 40%) 100% 기준선은 항상 보이도록
 * 최소 100은 보장한다. */
function roundUpToHundred(value: number): number {
  return Math.max(100, Math.ceil(value / 100) * 100)
}

/** "기간별 추이" 표 바로 아래에 두는 간단한 ROAS 막대 그래프 — 표의 숫자를
 * 한눈에 훑어볼 수 있도록 그래프 하나만 곁들인다(엑셀 다운로드용 상세 차트인
 * IndexLineChart와 달리 호버·범례·지표 여러 개 겹쳐보기 같은 기능은 없다).
 * 막대 색은 이 앱 전역에서 "증가/양호"를 뜻하는 초록(#3fb950)과 "감소/부진"을
 * 뜻하는 빨강(#ff7b72)을 그대로 재사용한다(channel-insight.scss의
 * __metric-delta.is-up/is-down과 같은 색) — ROAS 100%(광고비만큼 매출이 났는지)
 * 기준으로 갈린다. 평균 점선은 표의 "평균" 행(useRoasViewModel의 average)과
 * 같은 값을 그대로 써서, 표와 그래프가 서로 다른 평균을 보여주지 않게 한다.
 * 막대마다 지푯값과 바로 앞 막대 대비 증감(퍼센트 포인트)을 항상 표시한다 —
 * 표의 MetricValueCell과 같은 계산(computeDelta)을 그대로 쓴다. */
function RoasTrendChart({
  rows,
  average,
}: {
  rows: readonly RoasRow[]
  average: RoasMetrics
}) {
  const { ref, vbWidth, vbHeight } = useRoasTrendChartViewModel()
  const n = rows.length
  const plotW = vbWidth - CHART_MARGIN.left - CHART_MARGIN.right
  const plotH = vbHeight - CHART_MARGIN.top - CHART_MARGIN.bottom
  const plotBottom = CHART_MARGIN.top + plotH
  const maxValue = roundUpToHundred(
    Math.max(100, average.roas, ...rows.map((r) => r.metrics.roas)) * 1.25,
  )
  const bandW = plotW / n
  const barW = Math.min(bandW * 0.56, 34)
  const yOf = (v: number) => plotBottom - (v / maxValue) * plotH
  const xOf = (i: number) => CHART_MARGIN.left + bandW * i + (bandW - barW) / 2
  const labelStride = Math.max(1, Math.ceil(n / 8))
  const ticks = [0, maxValue / 2, maxValue]
  const avgY = yOf(average.roas)

  return (
    <div className="channel-insight__roas-chart" ref={ref}>
      <svg
        className="channel-insight__roas-chart-svg"
        viewBox={`0 0 ${vbWidth} ${vbHeight}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="기간별 ROAS 추이 그래프"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={CHART_MARGIN.left}
              x2={vbWidth - CHART_MARGIN.right}
              y1={yOf(t)}
              y2={yOf(t)}
              className="channel-insight__roas-chart-grid"
            />
            <text
              x={CHART_MARGIN.left - 8}
              y={yOf(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="channel-insight__roas-chart-axis"
            >
              {Math.round(t)}%
            </text>
          </g>
        ))}

        {rows.map((row, i) => {
          const barY = yOf(row.metrics.roas)
          const h = Math.max(0, plotBottom - barY)
          const prevRow = i > 0 ? rows[i - 1] : null
          const delta = prevRow
            ? computeDelta(row.metrics.roas, prevRow.metrics.roas)
            : null
          const cx = xOf(i) + barW / 2
          return (
            <g key={row.key}>
              <rect
                x={xOf(i)}
                y={barY}
                width={barW}
                height={h}
                rx={2}
                className={`channel-insight__roas-chart-bar${
                  row.metrics.roas < 100 ? ' is-negative' : ''
                }`}
              >
                <title>{`${row.label}: ${row.metrics.roas.toFixed(1)}%`}</title>
              </rect>
              {delta && (
                <text
                  x={cx}
                  y={barY - 20}
                  textAnchor="middle"
                  stroke={CHART_SURFACE}
                  strokeWidth={3}
                  paintOrder="stroke"
                  className={`channel-insight__roas-chart-delta is-${delta.dir}`}
                >
                  {DELTA_ARROW[delta.dir]}{' '}
                  {delta.delta >= 0 ? '+' : '-'}
                  {Math.abs(delta.delta).toFixed(1)}%p
                </text>
              )}
              <text
                x={cx}
                y={barY - 6}
                textAnchor="middle"
                stroke={CHART_SURFACE}
                strokeWidth={3}
                paintOrder="stroke"
                className="channel-insight__roas-chart-value"
              >
                {row.metrics.roas.toFixed(1)}%
              </text>
              {(i % labelStride === 0 || i === n - 1) && (
                <text
                  x={cx}
                  y={vbHeight - 8}
                  textAnchor="middle"
                  className="channel-insight__roas-chart-axis"
                >
                  {row.label}
                </text>
              )}
            </g>
          )
        })}

        {/* 평균 점선 — 표의 "평균" 행과 같은 값. 막대보다 먼저 그리면 막대에
            가려지므로 맨 뒤(막대 다음)에 그린다. */}
        <line
          x1={CHART_MARGIN.left}
          x2={vbWidth - CHART_MARGIN.right}
          y1={avgY}
          y2={avgY}
          className="channel-insight__roas-chart-avg-line"
        />
        <text
          x={vbWidth - CHART_MARGIN.right}
          y={avgY - 6}
          textAnchor="end"
          stroke={CHART_SURFACE}
          strokeWidth={3}
          paintOrder="stroke"
          className="channel-insight__roas-chart-avg-label"
        >
          평균 {average.roas.toFixed(1)}%
        </text>
      </svg>
    </div>
  )
}

/** OFFLINE_FIELDS/ONLINE_FIELDS 전용 소표 — 항상 전체 필드를 보여주고(토글
 * 없음), "기간별 추이" 표와 같은 구조(기간별 행 + 합계 + 평균, 앞 행 대비
 * 증감 표시)를 그대로 재사용한다. 별도 그래프는 없다(ROAS 그래프만 이 화면의
 * 유일한 시각화로 충분하다고 판단). */
function RoasSubTable({
  title,
  fields,
  rows,
  total,
  average,
}: {
  title: string
  fields: readonly RoasField[]
  rows: readonly RoasRow[]
  total: RoasMetrics
  average: RoasMetrics
}) {
  return (
    <section className="channel-insight__section">
      <div className="channel-insight__section-head">
        <h3 className="channel-insight__section-title">{title}</h3>
      </div>

      {rows.length === 0 ? (
        <p className="channel-insight__result-empty">데이터 없음</p>
      ) : (
        <div className="channel-insight__table-wrap">
          <table className="channel-insight__table channel-insight__table--roas">
            <thead>
              <tr>
                <th>기간</th>
                {fields.map((f) => (
                  <th key={f.key}>
                    <RoasFieldLabel field={f} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const prevRow = i > 0 ? rows[i - 1] : null
                return (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    {fields.map((f) => (
                      <MetricValueCell
                        key={f.key}
                        value={f.getValue(row.metrics)}
                        prevValue={prevRow ? f.getValue(prevRow.metrics) : null}
                        field={f}
                      />
                    ))}
                  </tr>
                )
              })}
              <tr className="channel-insight__table-row--total">
                <td>합계</td>
                {fields.map((f) => (
                  <td key={f.key}>{f.formatCompact(f.getValue(total))}</td>
                ))}
              </tr>
              <tr className="channel-insight__table-row--average">
                <td>평균</td>
                {fields.map((f) => (
                  <td key={f.key}>{f.formatCompact(f.getValue(average))}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** "ROAS" 탭 — 광고비(combinedInsight, Meta+Google+Naver 합산)와 오프라인
 * 매출(offlineRevenue, Monday CRM 매장 결제액) + 온라인 매출(onlineRevenue,
 * Cafe24 자사몰 결제액)을 같은 기간 기준으로 짝지어 광고비 대비 매출(ROAS)을
 * 보여준다. 온라인/오프라인을 합치지 않고 별도 컬럼으로 나눠 어느 채널의
 * 매출인지 구분해서 볼 수 있게 한다. 두 매출 모두 광고 전환매출
 * (MetricsSummary.revenue)이 아니라 실제로 결제된 금액 기준이라, 전환 추적이
 * 부정확한 채널(예: 문의 목적 캠페인)에서도 실제 성과를 볼 수 있다. */
export function RoasPanel({
  combinedInsight,
  offlineRevenue,
  onlineRevenue,
}: {
  combinedInsight: CombinedInsight | null
  offlineRevenue: OfflineRevenueSummary | null
  onlineRevenue: Cafe24RevenueSummary | null
}) {
  const { grouping, setGrouping, total, average, rows } = useRoasViewModel(
    combinedInsight,
    offlineRevenue,
    onlineRevenue,
  )

  // 지표 표시/숨김 — channel-insight.tsx의 FullListTable "컬럼 표시" 토글과
  // 같은 패턴. 기본은 전부 표시. ROAS_FIELDS(요약 카드+기간별 추이 표가 공유)
  // 에만 적용하고, 아래 OFFLINE_FIELDS/ONLINE_FIELDS 전용 표는 이미 각자
  // 3~5개로 정리돼 있어 토글 없이 항상 전부 보여준다.
  const [visibleKeys, setVisibleKeys] = useState<ReadonlySet<string>>(
    () => new Set(ROAS_FIELDS.map((f) => f.key)),
  )
  const toggleMetric = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (!combinedInsight || !offlineRevenue || !onlineRevenue) {
    return <p className="channel-insight__result-empty">데이터 없음</p>
  }

  const visibleFields = ROAS_FIELDS.filter((f) => visibleKeys.has(f.key))

  return (
    <div className="channel-insight__result">
      <section className="channel-insight__summary">
        <div className="channel-insight__summary-head">
          <span className="channel-insight__summary-label">ROAS 요약</span>
        </div>

        <div
          className="channel-insight__full-list-toggles"
          role="group"
          aria-label="지표 표시"
        >
          {ROAS_FIELDS.map((f) => {
            const active = visibleKeys.has(f.key)
            return (
              <button
                key={f.key}
                type="button"
                className={`channel-insight__full-list-toggle-btn${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => toggleMetric(f.key)}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        <div className="channel-insight__summary-grid">
          {visibleFields.map((f) => (
            <div key={f.key} className="channel-insight__kpi">
              <span className="channel-insight__kpi-label">
                <RoasFieldLabel field={f} />
              </span>
              <span className="channel-insight__kpi-value">
                {f.format(f.getValue(total))}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="channel-insight__section">
        <div className="channel-insight__section-head">
          <h3 className="channel-insight__section-title">기간별 추이</h3>
          <div className="channel-insight__section-head-actions">
            <span className="channel-insight__section-head-hint">보기</span>
            <SingleSelectDropdown<RoasGrouping>
              options={GROUPING_OPTIONS}
              value={grouping}
              onChange={setGrouping}
              ariaLabel="보기"
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="channel-insight__result-empty">데이터 없음</p>
        ) : (
          <>
            <div className="channel-insight__table-wrap">
              <table className="channel-insight__table channel-insight__table--roas">
                <thead>
                  <tr>
                    <th>기간</th>
                    {visibleFields.map((f) => (
                      <th key={f.key}>
                        <RoasFieldLabel field={f} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const prevRow = i > 0 ? rows[i - 1] : null
                    return (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        {visibleFields.map((f) => (
                          <MetricValueCell
                            key={f.key}
                            value={f.getValue(row.metrics)}
                            prevValue={
                              prevRow ? f.getValue(prevRow.metrics) : null
                            }
                            field={f}
                          />
                        ))}
                      </tr>
                    )
                  })}
                  <tr className="channel-insight__table-row--total">
                    <td>합계</td>
                    {visibleFields.map((f) => (
                      <td key={f.key}>{f.formatCompact(f.getValue(total))}</td>
                    ))}
                  </tr>
                  <tr className="channel-insight__table-row--average">
                    <td>평균</td>
                    {visibleFields.map((f) => (
                      <td key={f.key}>{f.formatCompact(f.getValue(average))}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <RoasTrendChart rows={rows} average={average} />
          </>
        )}
      </section>

      <RoasSubTable
        title="오프라인 매출"
        fields={OFFLINE_FIELDS}
        rows={rows}
        total={total}
        average={average}
      />

      <RoasSubTable
        title="카페24 온라인 매출"
        fields={ONLINE_FIELDS}
        rows={rows}
        total={total}
        average={average}
      />
    </div>
  )
}

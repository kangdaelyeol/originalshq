import { useMemo, useState } from 'react'
import type {
  Cafe24RevenueSummary,
  CombinedInsight,
  OfflineRevenueSummary,
} from '../client'
import { SingleSelectDropdown } from './single-select-dropdown'
import {
  RoasGrouping,
  RoasTable,
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
  v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
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
  {
    key: 'roas',
    label: 'ROAS',
    getValue: (m) => m.roas,
    format: pct2,
    formatCompact: pct2,
  },
  {
    key: 'totalRevenue',
    label: '총 매출',
    getValue: (m) => m.totalRevenue,
    format: won,
    formatCompact: won,
  },
  {
    key: 'spend',
    label: '광고비',
    getValue: (m) => m.spend,
    format: won,
    formatCompact: won,
  },
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
// ROAS용 순매출까지 계산 과정을 전부 순서대로 보여준다. 순서는 "매출액
// (ROAS용) → 총매출(할인 반영 전) → 상품할인 → 쿠폰할인 → 카페24 매출액
// (할인·환불 반영 후 순매출) → 배송비 → 적립금 사용 → 총 결제액(할인 반영
// 전 원본) → 환불액" — 사용자가 보기 편한 순서로 직접 지정했다(9/30).
//
// 환불액은 카페24 화면에 실제로 잡히는 환불(refundAmount)과 NCHECKOUT(네이버
// 페이) 등 폴백 환불(unrecordedRefundAmount)을 예전엔 따로 노출했는데,
// "통계적으로는 똑같다"는 판단으로 한 컬럼에 합쳤다 — 각각 얼마인지 감사가
// 필요하면 Cafe24RevenueMetrics.refundAmount/unrecordedRefundAmount를 API
// 응답에서 직접 봐야 한다(이 표에서는 합계만 보여준다).
const ONLINE_FIELDS: readonly RoasField[] = [
  {
    key: 'onlineRevenue',
    label: '매출액(ROAS용)',
    getValue: (m) => m.onlineRevenue,
    format: won,
    formatCompact: won,
    note: '카페24 매출액 - (배송비 + 적립금 사용액)',
  },
  {
    key: 'onlineTotalRevenue',
    label: '총매출',
    getValue: (m) =>
      m.onlineRevenueCafe24 + m.onlineCouponDiscount + m.onlineItemDiscount,
    format: won,
    formatCompact: won,
    note: '카페24 매출액 + 쿠폰할인 + 상품할인',
  },
  {
    key: 'onlineItemDiscount',
    label: '상품할인',
    getValue: (m) => m.onlineItemDiscount,
    format: won,
    formatCompact: won,
    note: '기타 상품 할인 금액(시즌 한정 쿠폰 등)',
  },
  {
    key: 'onlineCouponDiscount',
    label: '쿠폰할인',
    getValue: (m) => m.onlineCouponDiscount,
    format: won,
    formatCompact: won,
  },
  {
    key: 'onlineRevenueCafe24',
    label: '카페24 매출액',
    getValue: (m) => m.onlineRevenueCafe24,
    format: won,
    formatCompact: won,
    note: '총 결제액 - 상품할인 - 환불액(배송비·적립금 포함, 즉 실제로 나간 돈을 모두 제외)',
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
    note: '카페24 순 적립금 사용액',
  },
  {
    key: 'onlineGrossPayment',
    label: '총 결제액',
    getValue: (m) => m.onlineGrossPayment,
    format: won,
    formatCompact: won,
    note: '결제 금액으로 귀속된 금액 합계(배송비, 적립금 포함 / 상품할인, 환불 반영 전). 카페24 관리자 "총결제액"과 같음',
  },
  {
    key: 'onlineTotalRefund',
    label: '환불액',
    getValue: (m) => m.onlineRefundAmount + m.onlineUnrecordedRefundAmount,
    format: won,
    formatCompact: won,
    note: '네이버페이와 같은 환불건은 카페24 통계시스템에서 집계되지 않음. 따라서 통계에서 잡히는 환불과 카페24에서 안 잡히는 환불을 합친 값',
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

// single-select-dropdown.tsx의 ChevronIcon과 같은 모양 — roas-panel.tsx
// 전용으로 따로 둔다(모듈 독립성, 위 InfoIcon과 같은 이유).
function ChevronIcon() {
  return (
    <svg
      className="channel-insight__chevron"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** ROAS 탭의 표 섹션들(기간별 추이/오프라인 매출/카페24 온라인 매출) 제목을
 * 감싸는 접기/펼치기 버튼 — 부모(<h3 className="channel-insight__section-title">
 * 등)의 글자 스타일을 font: inherit로 그대로 물려받아서, 버튼 자체엔 텍스트
 * 스타일 클래스를 따로 안 넣어도 된다(9/30 요청 — 제목을 누르면 그 섹션
 * 본문을 접고 편다). "ROAS 요약"(<span className="channel-insight__summary-label">)
 * 도 이 버튼을 그대로 그 안에 넣어서 같은 방식으로 쓴다. */
function SectionCollapseToggle({
  title,
  open,
  onToggle,
}: {
  title: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`channel-insight__section-collapse-toggle${open ? '' : ' is-collapsed'}`}
      onClick={onToggle}
      aria-expanded={open}
    >
      <ChevronIcon />
      {title}
    </button>
  )
}

/** 필드 라벨 — note가 있으면 옆에 "?" 아이콘을 달아 호버(또는 포커스)하면
 * 설명을 보여준다. ROAS 요약 카드(정렬이 필요 없는 KPI 카드)에서만 쓴다 —
 * 표 헤더는 전부 정렬 버튼이 있는 SortableRoasFieldHeader를 쓴다. */
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

type SortDir = 'asc' | 'desc'

/** channel-insight.tsx의 SortArrows/__sort-arrow(s) 클래스를 그대로 재사용 —
 * 이 화면도 channel-insight__* 클래스를 이미 쓰고 있어서(RoasFieldLabel의
 * __info 등) 별도 CSS 추가 없이 그대로 붙는다. */
function SortArrows({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="channel-insight__sort-arrows">
      <span
        className={`channel-insight__sort-arrow${active && dir === 'asc' ? ' is-active' : ''}`}
      >
        ▲
      </span>
      <span
        className={`channel-insight__sort-arrow${active && dir === 'desc' ? ' is-active' : ''}`}
      >
        ▼
      </span>
    </span>
  )
}

/** "기간별 추이"/RoasSubTable(오프라인 매출/카페24 온라인 매출) 표 헤더가
 * 공유 — 클릭하면 그 컬럼 기준으로 행을 정렬한다. "?" 정보 아이콘은 정렬
 * 버튼 바깥의 형제 엘리먼트로 둬서, 아이콘을 호버/클릭해도 정렬이 같이 안
 * 눌리게 한다(channel-insight.tsx의 SortableMetricHeader와 같은 이유). */
function SortableRoasFieldHeader({
  field,
  active,
  dir,
  onSort,
}: {
  field: RoasField
  active: boolean
  dir: SortDir
  onSort: () => void
}) {
  return (
    <>
      <button
        type="button"
        className="channel-insight__sort-head"
        onClick={onSort}
      >
        {field.label}
        <SortArrows active={active} dir={dir} />
      </button>
      {field.note && (
        <span className="channel-insight__info" tabIndex={0}>
          <InfoIcon />
          <span className="channel-insight__info-tooltip" role="tooltip">
            {field.note}
          </span>
        </span>
      )}
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
                  {DELTA_ARROW[delta.dir]} {delta.delta >= 0 ? '+' : '-'}
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

/** "기간" 컬럼용 정렬 키 — RoasField.key와 겹치지 않는 별도 문자열이라 굳이
 * 유니온으로 안 좁히고 필드 key와 같은 string 타입을 그대로 쓴다. */
const PERIOD_SORT_KEY = 'period'

/** "기간별 추이"/"오프라인 매출"/"카페24 온라인 매출" 표 세 곳이 전부 같은
 * 정렬 동작(컬럼 헤더 클릭 → 그 지표 기준 오름/내림차순, 같은 컬럼 다시
 * 누르면 방향만 뒤집기)을 쓰게 돼서 로직을 훅 하나로 뺐다 — 표마다 각자
 * useState를 갖고 있어서(훅을 호출하는 컴포넌트 인스턴스별로 독립) 한쪽
 * 표의 정렬이 다른 표에 안 번진다. 기본은 "기간" 오름차순(원래 시간 순서),
 * 다른 컬럼을 처음 누르면 "큰 값부터"가 보통 더 유용해서 내림차순을 기본으로
 * 한다(channel-insight.tsx의 toggleSort와 같은 규칙). 합계/평균 행은 호출부가
 * 항상 별도로 그려서(rows에 안 섞여 들어옴) 정렬 대상에서 자동으로 빠진다. */
function useRoasTableSort(
  rows: readonly RoasRow[],
  fields: readonly RoasField[],
) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({
    key: PERIOD_SORT_KEY,
    dir: 'asc',
  })

  const toggleSort = (key: string) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === PERIOD_SORT_KEY ? 'asc' : 'desc' },
    )
  }

  const sortedRows = useMemo(() => {
    if (sort.key === PERIOD_SORT_KEY) {
      return sort.dir === 'asc' ? rows : [...rows].slice().reverse()
    }
    const field = fields.find((f) => f.key === sort.key)
    if (!field) return rows
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort(
      (a, b) => (field.getValue(a.metrics) - field.getValue(b.metrics)) * dir,
    )
  }, [rows, fields, sort])

  return { sort, toggleSort, sortedRows }
}

/** "기간별 추이"/"오프라인 매출"/"카페24 온라인 매출" 표 셋 다 자기만의 "지표
 * 표시" 토글이 있어야 해서(9/30 요청 전에는 ROAS_FIELDS만, 그것도 표가 아니라
 * "ROAS 요약" 카드 쪽에 있었다) 컬럼 표시/숨김 상태 관리를 훅으로 뺐다 —
 * useRoasTableSort와 같은 이유로 표 인스턴스별 독립 상태. 기본은 전부 표시.
 * fields 매개변수는 채널 인사이트의 FullListTable "컬럼 표시" 토글과 같은
 * 패턴을 그대로 쓴다(channel-insight.tsx). */
function useFieldVisibility(fields: readonly RoasField[]) {
  const [visibleKeys, setVisibleKeys] = useState<ReadonlySet<string>>(
    () => new Set(fields.map((f) => f.key)),
  )
  const toggle = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const visibleFields = fields.filter((f) => visibleKeys.has(f.key))
  return { visibleKeys, toggle, visibleFields }
}

/** useFieldVisibility와 짝을 이루는 토글 버튼 로우 — "기간별 추이"/
 * "오프라인 매출"/"카페24 온라인 매출" 세 표가 공유한다. */
function FieldVisibilityToggles({
  fields,
  visibleKeys,
  onToggle,
}: {
  fields: readonly RoasField[]
  visibleKeys: ReadonlySet<string>
  onToggle: (key: string) => void
}) {
  return (
    <div
      className="channel-insight__full-list-toggles"
      role="group"
      aria-label="지표 표시"
    >
      {fields.map((f) => {
        const active = visibleKeys.has(f.key)
        return (
          <button
            key={f.key}
            type="button"
            className={`channel-insight__full-list-toggle-btn${active ? ' is-active' : ''}`}
            aria-pressed={active}
            onClick={() => onToggle(f.key)}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}

/** OFFLINE_FIELDS/ONLINE_FIELDS 전용 소표 — "기간별 추이" 표와 같은 구조
 * (지표 표시 토글 + 기간별 행 + 합계 + 평균, 앞 행 대비
 * 증감 표시)를 그대로 재사용한다. 별도 그래프는 없다(ROAS 그래프만 이 화면의
 * 유일한 시각화로 충분하다고 판단). */
function RoasSubTable({
  title,
  fields,
  rows,
  total,
  average,
  grouping,
  onGroupingChange,
}: {
  title: string
  fields: readonly RoasField[]
  rows: readonly RoasRow[]
  total: RoasMetrics
  average: RoasMetrics
  /** 이 표만의 보기 단위(일별/요일별/주차별/월별) — "기간별 추이" 표와
   * 독립적으로 바뀐다(9/30 요청 전에는 표 하나(전역)만 있었다). */
  grouping: RoasGrouping
  onGroupingChange: (grouping: RoasGrouping) => void
}) {
  const { sort, toggleSort, sortedRows } = useRoasTableSort(rows, fields)
  const {
    visibleKeys,
    toggle: toggleMetric,
    visibleFields,
  } = useFieldVisibility(fields)
  const [open, setOpen] = useState(true)

  return (
    <section className="channel-insight__section">
      <div className="channel-insight__section-head">
        <h3 className="channel-insight__section-title">
          <SectionCollapseToggle
            title={title}
            open={open}
            onToggle={() => setOpen((o) => !o)}
          />
        </h3>
        <div className="channel-insight__section-head-actions">
          <span className="channel-insight__section-head-hint">보기</span>
          <SingleSelectDropdown<RoasGrouping>
            options={GROUPING_OPTIONS}
            value={grouping}
            onChange={onGroupingChange}
            ariaLabel={`${title} 보기 단위`}
          />
        </div>
      </div>

      {open && (
        <>
          <FieldVisibilityToggles
            fields={fields}
            visibleKeys={visibleKeys}
            onToggle={toggleMetric}
          />

          {rows.length === 0 ? (
            <p className="channel-insight__result-empty">데이터 없음</p>
          ) : (
            <div className="channel-insight__table-wrap">
              <table className="channel-insight__table channel-insight__table--roas">
                <thead>
                  <tr>
                    <th>
                      <button
                        type="button"
                        className="channel-insight__sort-head"
                        onClick={() => toggleSort(PERIOD_SORT_KEY)}
                      >
                        기간
                        <SortArrows
                          active={sort.key === PERIOD_SORT_KEY}
                          dir={sort.dir}
                        />
                      </button>
                    </th>
                    {visibleFields.map((f) => (
                      <th key={f.key}>
                        <SortableRoasFieldHeader
                          field={f}
                          active={sort.key === f.key}
                          dir={sort.dir}
                          onSort={() => toggleSort(f.key)}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, i) => {
                    const prevRow = i > 0 ? sortedRows[i - 1] : null
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
                      <td key={f.key}>
                        {f.formatCompact(f.getValue(average))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
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
  const {
    groupings,
    globalGrouping,
    setGroupingFor,
    setGroupingForAll,
    total,
    trend,
    offline,
    online,
  } = useRoasViewModel(combinedInsight, offlineRevenue, onlineRevenue)
  const { rows, average } = trend

  // 지표 표시/숨김 — "기간별 추이" 표 전용이다(9/30 요청 전에는 "ROAS 요약"
  // 카드까지 같이 숨겼는데, 요약 카드는 항상 전체를 보여주는 쪽으로
  // 바꿨다 — 아래 ROAS 요약 section 참고).
  const {
    visibleKeys,
    toggle: toggleMetric,
    visibleFields,
  } = useFieldVisibility(ROAS_FIELDS)

  // "기간별 추이" 표 전용 정렬 — RoasSubTable과 같은 훅을 쓰지만, 필드
  // 목록은 ROAS_FIELDS 전체로 둔다(지금 숨겨진 컬럼 기준으로 정렬 중이었다가
  // 그 컬럼을 다시 켜도 정렬이 안 끊기게). 정렬은 이 표에만 적용하고, 바로
  // 아래 RoasTrendChart는 그대로 원래 rows(시간순)를 쓴다 — 그래프는 막대
  // 위치가 곧 날짜이고 "이전 막대 대비 증감"을 보여주는 시계열 그래프라,
  // 표를 다른 지표로 정렬해도 그래프까지 같이 뒤섞이면 그래프 자체의 의미가
  // 없어진다. useFieldVisibility와 마찬가지로 이 훅도 아래 조기 return보다
  // 먼저 호출해야 한다(리액트 훅 규칙 — 렌더마다 훅 호출 순서/개수가
  // 같아야 하는데, return 뒤에 두면 combinedInsight가 null인 렌더에서는
  // 이 훅 호출 자체가 건너뛰어져 버린다).
  const {
    sort: trendSort,
    toggleSort: toggleTrendSort,
    sortedRows: sortedTrendRows,
  } = useRoasTableSort(rows, ROAS_FIELDS)

  // "ROAS 요약"/"기간별 추이" 섹션 접기·펼치기(9/30 요청) — 오프라인 매출/
  // 카페24 온라인 매출은 RoasSubTable이 각자 자기 인스턴스 안에서 따로
  // 갖고 있다(이 두 상태와 독립적으로 동작).
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [trendOpen, setTrendOpen] = useState(true)

  if (!combinedInsight || !offlineRevenue || !onlineRevenue) {
    return <p className="channel-insight__result-empty">데이터 없음</p>
  }

  return (
    <div className="channel-insight__result">
      {/* 예전엔 이 요약 카드도 "지표 표시" 토글로 같이 숨겨졌는데, 그 토글은
          사실 "기간별 추이" 표의 컬럼을 고르는 용도라 요약 카드와는 목적이
          다르다 — 요약 카드는 토글 없이 항상 ROAS_FIELDS 전체를 보여주고,
          토글 자체는 "기간별 추이" section으로 옮겼다(9/30 요청). */}
      <section className="channel-insight__summary">
        <div className="channel-insight__summary-head">
          <SectionCollapseToggle
            title="ROAS 요약"
            open={summaryOpen}
            onToggle={() => setSummaryOpen((o) => !o)}
          />
        </div>

        {summaryOpen && (
          <div className="channel-insight__summary-grid">
            {ROAS_FIELDS.map((f) => (
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
        )}
      </section>

      {/* 예전엔 "기간별 추이" 표 헤더에만 보기 단위(일별/요일별/주차별/월별)
          컨트롤이 있었는데, 실제로는 세 표(기간별 추이/오프라인 매출/카페24
          온라인 매출) 전부에 적용되는 것처럼 보였다 — 표 하나 소속이 아니라
          전역 컨트롤이라는 게 더 분명하도록 밖으로 뺐다(9/30 요청). 여기서
          바꾸면 세 표 전부 한 번에 같은 보기 단위로 맞춰지고, 그 아래 각 표
          section-head에도 자기만의 보기 단위 컨트롤이 따로 있어서 개별로도
          바꿀 수 있다. */}
      <section className="channel-insight__section">
        <div className="channel-insight__section-head">
          <h3 className="channel-insight__section-title">전체 보기 단위</h3>
          <div className="channel-insight__section-head-actions">
            <span className="channel-insight__section-head-hint">
              아래 세 표 모두 적용
            </span>
            <SingleSelectDropdown<RoasGrouping>
              options={GROUPING_OPTIONS}
              value={globalGrouping}
              onChange={setGroupingForAll}
              ariaLabel="전체 보기 단위"
            />
          </div>
        </div>
      </section>

      <section className="channel-insight__section">
        <div className="channel-insight__section-head">
          <h3 className="channel-insight__section-title">
            <SectionCollapseToggle
              title="기간별 추이"
              open={trendOpen}
              onToggle={() => setTrendOpen((o) => !o)}
            />
          </h3>
          <div className="channel-insight__section-head-actions">
            <span className="channel-insight__section-head-hint">보기</span>
            <SingleSelectDropdown<RoasGrouping>
              options={GROUPING_OPTIONS}
              value={groupings[RoasTable.TREND]}
              onChange={(g) => setGroupingFor(RoasTable.TREND, g)}
              ariaLabel="기간별 추이 보기 단위"
            />
          </div>
        </div>

        {trendOpen && (
          <>
            <FieldVisibilityToggles
              fields={ROAS_FIELDS}
              visibleKeys={visibleKeys}
              onToggle={toggleMetric}
            />

            {rows.length === 0 ? (
              <p className="channel-insight__result-empty">데이터 없음</p>
            ) : (
              <>
                <div className="channel-insight__table-wrap">
                  <table className="channel-insight__table channel-insight__table--roas">
                    <thead>
                      <tr>
                        <th>
                          <button
                            type="button"
                            className="channel-insight__sort-head"
                            onClick={() => toggleTrendSort(PERIOD_SORT_KEY)}
                          >
                            기간
                            <SortArrows
                              active={trendSort.key === PERIOD_SORT_KEY}
                              dir={trendSort.dir}
                            />
                          </button>
                        </th>
                        {visibleFields.map((f) => (
                          <th key={f.key}>
                            <SortableRoasFieldHeader
                              field={f}
                              active={trendSort.key === f.key}
                              dir={trendSort.dir}
                              onSort={() => toggleTrendSort(f.key)}
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTrendRows.map((row, i) => {
                        const prevRow = i > 0 ? sortedTrendRows[i - 1] : null
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
                          <td key={f.key}>
                            {f.formatCompact(f.getValue(total))}
                          </td>
                        ))}
                      </tr>
                      <tr className="channel-insight__table-row--average">
                        <td>평균</td>
                        {visibleFields.map((f) => (
                          <td key={f.key}>
                            {f.formatCompact(f.getValue(average))}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <RoasTrendChart rows={rows} average={average} />
              </>
            )}
          </>
        )}
      </section>

      <RoasSubTable
        title="오프라인 매출"
        fields={OFFLINE_FIELDS}
        rows={offline.rows}
        total={total}
        average={offline.average}
        grouping={groupings[RoasTable.OFFLINE]}
        onGroupingChange={(g) => setGroupingFor(RoasTable.OFFLINE, g)}
      />

      <RoasSubTable
        title="카페24 온라인 매출"
        fields={ONLINE_FIELDS}
        rows={online.rows}
        total={total}
        average={online.average}
        grouping={groupings[RoasTable.ONLINE]}
        onGroupingChange={(g) => setGroupingFor(RoasTable.ONLINE, g)}
      />
    </div>
  )
}

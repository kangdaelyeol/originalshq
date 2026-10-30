import {
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type {
  Cafe24RevenueSummary,
  CombinedInsight,
  OfflineRevenueSummary,
  RepeatRevenueByDate,
  AttributionRow,
} from '../client'
import { SingleSelectDropdown } from './single-select-dropdown'
import { oneOf, setOf, usePersistentState } from '@/hooks/use-persistent-state'
import { RoasAttribution } from './roas-attribution'
import {
  Segmented,
  Sparkline,
  TrendGrid,
  type TrendSeries,
} from '@/components/glass'
import {
  DisplayToggle,
  PeriodStackChart,
  RatioChips,
  RoasTrendChart,
  Waterfall,
  type StackGroup,
  type WaterfallStep,
} from './roas-charts'
import { useDisplayMode } from '../view-model/use-display-mode'
import {
  computeRoasRows,
  RoasGrouping,
  RoasTable,
  useRoasViewModel,
  type RoasMetrics,
  type RoasRow,
} from '../view-model/use-roas-view-model'
import { ChevronIcon, InfoIcon, SortArrows, type SortDir } from './icons'

const GROUPING_OPTIONS: readonly { value: RoasGrouping; label: string }[] = [
  { value: RoasGrouping.DATE, label: '일별' },
  { value: RoasGrouping.DAY_OF_WEEK, label: '요일별' },
  { value: RoasGrouping.WEEK, label: '주차별' },
  { value: RoasGrouping.MONTH, label: '월별' },
]

const GROUPING_LABEL = Object.fromEntries(
  GROUPING_OPTIONS.map((o) => [o.value, o.label]),
) as Record<RoasGrouping, string>

type RevenueSplit = 'newRepeat' | 'channel'
const REVENUE_SPLIT_LABEL: Record<RevenueSplit, string> = {
  newRepeat: '신규 · 재구매',
  channel: '오프라인 · 온라인',
}

// 그래프 색 — 광고비는 중립, 매출은 데이터색(신규·오프라인)과 그 옅은 색·링크색.
const COLOR = {
  spend: 'color-mix(in srgb, var(--glass-text) 36%, transparent)',
  main: 'var(--glass-accent)',
  sub: 'color-mix(in srgb, var(--glass-accent) 42%, transparent)',
  online: 'var(--glass-link)',
  minus: 'color-mix(in srgb, var(--glass-danger) 55%, transparent)',
  interest: 'color-mix(in srgb, var(--glass-warn) 70%, transparent)',
}

/** 기간별 [광고비] [매출] 막대 묶음 — 매출은 신규·재구매 또는 오프라인·온라인으로
 * 쌓는다. 재구매를 모르면(NaN) 매출을 한 덩어리로. */
const revenueGroups = (
  rows: readonly RoasRow[],
  split: RevenueSplit,
): StackGroup[] => {
  const values = (get: (m: RoasMetrics) => number) =>
    rows.map((row) => finite(get(row.metrics)))
  const knowsRepeat = rows.every((row) =>
    Number.isFinite(row.metrics.repeatRevenue),
  )
  return [
    {
      key: 'spend',
      label: '광고비',
      series: [
        {
          key: 'spend',
          label: '광고비',
          color: COLOR.spend,
          values: values((m) => m.spend),
        },
      ],
    },
    {
      key: 'revenue',
      label: '매출',
      series:
        split === 'channel'
          ? [
              {
                key: 'offline',
                label: '오프라인 매출',
                color: COLOR.main,
                values: values((m) => m.offlineRevenue),
              },
              {
                key: 'online',
                label: '온라인 매출',
                color: COLOR.online,
                values: values((m) => m.onlineRevenue),
              },
            ]
          : knowsRepeat
            ? [
                {
                  key: 'new',
                  label: '신규 고객 매출',
                  color: COLOR.main,
                  values: values((m) => m.newCustomerRevenue),
                },
                {
                  key: 'repeat',
                  label: '재구매 매출',
                  color: COLOR.sub,
                  values: values((m) => m.repeatRevenue),
                },
              ]
            : [
                {
                  key: 'total',
                  label: '총 매출',
                  color: COLOR.main,
                  values: values((m) => m.totalRevenue),
                },
              ],
    },
  ]
}

/** ROAS 추이 그래프의 재료 — 신규 고객 ROAS를 그리고, 재구매 금액을 모르면
 * 광고비 대비 매출로 대신한다. */
const trendChartProps = (rows: readonly RoasRow[], average: RoasMetrics) => {
  const metric = Number.isFinite(average.newCustomerRoas)
    ? 'newCustomerRoas'
    : 'roas'
  return {
    label: metric === 'newCustomerRoas' ? '신규 고객 ROAS' : '광고비 대비 매출',
    average: average[metric],
    points: rows.map((row) => ({
      key: row.key,
      label: row.label,
      value: row.metrics[metric],
      spend: row.metrics.spend,
      revenue: row.metrics.totalRevenue,
    })),
  }
}

/** 카페24 온라인 매출의 계산 과정 — 총 주문 금액에서 할인·환불·배송비·적립금이
 * 빠져 ROAS용 매출이 된다. 중간 합계는 실제 값으로 다시 맞추고, 앞 단계로
 * 설명되지 않는 차이가 있으면 "기타 조정"으로 드러낸다. */
const onlineWaterfall = (m: RoasMetrics): WaterfallStep[] => {
  const refund = m.onlineRefundAmount + m.onlineUnrecordedRefundAmount
  const points = m.onlinePointsSpent - m.onlinePointsRefunded
  const steps: WaterfallStep[] = [
    {
      key: 'gross',
      label: '총 주문 금액',
      kind: 'total',
      value: m.onlineGrossPayment,
      note: '배송비·적립금 포함, 상품할인·환불 반영 전(쿠폰은 이미 빠짐). 카페24 통계의 총결제액',
    },
    {
      key: 'item',
      label: '상품할인',
      kind: 'minus',
      value: m.onlineItemDiscount,
    },
    {
      key: 'refund',
      label: '환불',
      kind: 'minus',
      value: refund,
      note: `스마트스토어·네이버페이 환불 ${won(m.onlineUnrecordedRefundAmount)} 포함`,
    },
  ]
  const afterRefund = m.onlineGrossPayment - m.onlineItemDiscount - refund
  if (Math.abs(afterRefund - m.onlineRevenueCafe24) >= 1) {
    const diff = m.onlineRevenueCafe24 - afterRefund
    steps.push({
      key: 'adj1',
      label: '기타 조정',
      kind: diff < 0 ? 'minus' : 'plus',
      value: Math.abs(diff),
    })
  }
  steps.push(
    {
      key: 'cafe24',
      label: '최종 카페24 매출액',
      kind: 'total',
      value: m.onlineRevenueCafe24,
      note: '할인·환불(스마트스토어 포함)을 뺀 순매출. 배송비·적립금 포함',
    },
    {
      key: 'ship',
      label: '배송비',
      kind: 'minus',
      value: m.onlineShippingFee,
      note: '택배사로 나가는 실비라 ROAS에서 뺍니다',
    },
    {
      key: 'points',
      label: '적립금 사용',
      kind: 'minus',
      value: points,
      note: '이미 쌓인 포인트를 쓴 것이라 새 매출이 아닙니다(순 사용액)',
    },
  )
  const afterPoints = m.onlineRevenueCafe24 - m.onlineShippingFee - points
  if (Math.abs(afterPoints - m.onlineRevenue) >= 1) {
    const diff = m.onlineRevenue - afterPoints
    steps.push({
      key: 'adj2',
      label: '기타 조정',
      kind: diff < 0 ? 'minus' : 'plus',
      value: Math.abs(diff),
    })
  }
  steps.push({
    key: 'roas',
    label: '매출액 (ROAS용)',
    kind: 'total',
    value: m.onlineRevenue,
    note: 'ROAS 계산에 쓰는 온라인 매출',
  })
  return steps
}

const num2 = (v: number): string =>
  v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
// NaN은 "모름"(재구매 금액을 불러오지 못한 신규 고객 지표) — '-'로 보인다.
const won = (v: number): string =>
  Number.isFinite(v) ? `${Math.round(v).toLocaleString()}원` : '-'
const pct2 = (v: number): string => (Number.isFinite(v) ? `${num2(v)}%` : '-')
/** a ÷ b(퍼센트) — b가 0이면 0, 둘 중 모르는 값(NaN)이 있으면 NaN. */
const ratio = (a: number, b: number): number =>
  !Number.isFinite(a) || !Number.isFinite(b) ? NaN : b > 0 ? (a / b) * 100 : 0
const finite = (v: number) => (Number.isFinite(v) ? v : 0)

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
    key: 'newCustomerRoas',
    label: '신규 고객 ROAS',
    getValue: (m) => m.newCustomerRoas,
    format: pct2,
    formatCompact: pct2,
    note: '신규 고객 매출 ÷ 광고비. 이미 산 적 있는 고객의 재구매는 광고 성과로 보지 않아 뺍니다. 자연유입·소개·매장 방문 신규 고객은 아직 섞여 있어, 광고가 기여한 최대치로 읽어야 합니다.',
  },
  {
    key: 'lowerBoundRoas',
    label: '하한 ROAS',
    getValue: (m) => m.lowerBoundRoas,
    format: pct2,
    formatCompact: pct2,
    note: 'UTM 광고 매출 ÷ 광고비. UTM이 광고 채널(Meta·Google·Naver)인 상담 뒤 90일 안에 처음 산 고객의 구매만 광고 성과로 센 값이라, 진짜 광고 ROAS보다 작거나 같습니다. 매출은 고객 통합(계약 금액) 기준입니다.',
  },
  {
    key: 'roas',
    label: '광고비 대비 매출',
    getValue: (m) => m.roas,
    format: pct2,
    formatCompact: pct2,
    note: '총 매출 ÷ 광고비(예전 이름 "ROAS"). 재구매 매출까지 모두 넣은 회사 전체 효율이라, 광고 성과만 볼 때는 신규 고객 ROAS를 봅니다.',
  },
  {
    key: 'totalRevenue',
    label: '총 매출',
    getValue: (m) => m.totalRevenue,
    format: won,
    formatCompact: won,
  },
  {
    key: 'newCustomerRevenue',
    label: '신규 고객 매출',
    getValue: (m) => m.newCustomerRevenue,
    format: won,
    formatCompact: won,
    note: '총 매출 - 재구매 매출.',
  },
  {
    key: 'repeatRevenue',
    label: '재구매 매출',
    getValue: (m) => m.repeatRevenue,
    format: won,
    formatCompact: won,
    note: '전화번호로 묶은 고객(Monday 오프라인 결제 + 카페24 주문)이 첫 구매일 이후에 다시 산 금액입니다. 첫 구매일에 여러 건을 샀으면 모두 신규로 봅니다. 데이터가 2026년 1월부터라 그 전에 산 고객의 올해 첫 구매는 신규로 잡힙니다. 금액은 고객 통합 기준이라 위 매출과 원 단위까지 같은 기준은 아닙니다.',
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
    note: 'ROAS 계산용 온라인 매출 = 최종 카페24 매출액(스마트스토어 환불까지 뺀 순매출, 배송비 포함) - 배송비 - 순 적립금 사용액. 배송비는 택배사로 나가는 실비 통과항목, 적립금 결제는 광고로 새로 유입된 매출이 아니라 이미 쌓여있던 포인트를 쓴 것뿐이라 ROAS에서는 둘 다 빼서 봅니다. 카페24 화면과 같은 기준의 숫자는 아래 "카페24 온라인 매출" 표의 "카페24 매출액"에, 스마트스토어 환불까지 뺀 숫자는 "최종 카페24 매출액"에 있습니다.',
  },
  {
    key: 'offlineRevenue',
    label: '오프라인 매출',
    getValue: (m) => m.offlineRevenue,
    format: won,
    formatCompact: won,
  },
  // 분석용 비율 — 위 금액들에서 바로 나오는 값이라 기간마다 같은 식으로 계산한다.
  {
    key: 'spendRatio',
    label: '매출 대비 광고비',
    getValue: (m) => ratio(m.spend, m.totalRevenue),
    format: pct2,
    formatCompact: pct2,
    note: '광고비 ÷ 총 매출. 매출 100원을 내는 데 광고비를 몇 원 썼는지(광고비 대비 매출의 역수) — 마진율보다 높으면 광고가 이익을 깎고 있다는 뜻입니다.',
  },
  {
    key: 'repeatShare',
    label: '재구매 비중',
    getValue: (m) => ratio(m.repeatRevenue, m.totalRevenue),
    format: pct2,
    formatCompact: pct2,
    note: '재구매 매출 ÷ 총 매출. 높을수록 광고 없이도 돌아오는 매출이 많고, 광고비 대비 매출이 광고 성과보다 부풀려져 보입니다.',
  },
  {
    key: 'onlineShare',
    label: '온라인 매출 비중',
    getValue: (m) => ratio(m.onlineRevenue, m.totalRevenue),
    format: pct2,
    formatCompact: pct2,
    note: '온라인 매출(카페24) ÷ 총 매출.',
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
// (화면 기준) → 최종 카페24 매출액(할인·환불 반영 후 순매출) → 배송비 → 적립금 사용 → 총 결제액(할인 반영
// 전 원본) → 환불액" — 사용자가 보기 편한 순서로 직접 지정했다(9/30).
// 10/8에 카페24 통계 대조용으로 "상품 구매금액"(총 결제액 앞)과 "스마트스토어
// 환불"(환불액 뒤) 두 컬럼을 추가했다.
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
    note: '최종 카페24 매출액 - (배송비 + 적립금 사용액)',
  },
  {
    key: 'onlineTotalRevenue',
    label: '총매출',
    getValue: (m) =>
      m.onlineRevenueCafe24 + m.onlineCouponDiscount + m.onlineItemDiscount,
    format: won,
    formatCompact: won,
    note: '최종 카페24 매출액 + 쿠폰할인 + 상품할인',
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
  // 카페24 매출액 — 카페24 관리자 화면이 보여주는 기준. 그 화면은 스마트
  // 스토어·네이버페이 환불(카페24 환불 기록에 없는 몫)을 모르기 때문에, 아래
  // "최종 카페24 매출액"에 그 환불을 다시 더해야 화면 숫자와 같아진다(10/8
  // 요청으로 두 컬럼으로 나눔 — 예전엔 아래 컬럼 하나가 "카페24 매출액"이었다).
  {
    key: 'onlineRevenueCafe24Screen',
    label: '카페24 통계 매출액',
    getValue: (m) => m.onlineRevenueCafe24 + m.onlineUnrecordedRefundAmount,
    format: won,
    formatCompact: won,
    note: '카페24 관리자 화면 기준 매출액. 스마트스토어·네이버페이 환불은 카페24 통계에 잡히지 않아 여기서는 빠지지 않음. 최종 카페24 매출액 + 스마트스토어 환불',
  },
  {
    key: 'onlineRevenueCafe24',
    label: '최종 카페24 매출액(카페24 매출액 + 누락건)',
    getValue: (m) => m.onlineRevenueCafe24,
    format: won,
    formatCompact: won,
    note: '총 결제액 - 상품할인 - 환불액(배송비·적립금 포함, 스마트스토어 환불까지 실제로 나간 돈을 모두 제외). 카페24 매출액 - 스마트스토어 환불',
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
  // 상품 구매금액 — 카페24 통계의 "상품구매금액"과 맞춘 값. 총 결제액은
  // 상품가에 배송비를 더하고 쿠폰을 뺀 금액이라, 거꾸로 배송비를 빼고 쿠폰을
  // 더하면 상품가 합계가 나온다(1월 대조: 51,541,550 - 60,000 + 150,000 =
  // 51,631,550, 카페24 통계와 일치). 서버 응답에 따로 없는 값이라 여기서
  // 계산한다.
  {
    key: 'onlineProductAmount',
    label: '상품 구매금액',
    getValue: (m) =>
      m.onlineGrossPayment - m.onlineShippingFee + m.onlineCouponDiscount,
    format: won,
    formatCompact: won,
    note: '상품 가격 합계(배송비 제외, 쿠폰·상품할인 차감 전). 총 주문 금액 - 배송비 + 쿠폰할인. 카페24 통계의 "상품구매금액"',
  },
  {
    key: 'onlineGrossPayment',
    label: '총 주문 금액',
    getValue: (m) => m.onlineGrossPayment,
    format: won,
    formatCompact: won,
    note: '귀속 주문금액 합계(배송비, 적립금 포함 / 상품할인, 환불 반영 전). 카페24 통계의 "총결제액"',
  },
  {
    key: 'onlineTotalRefund',
    label: '총 환불액',
    getValue: (m) => m.onlineRefundAmount + m.onlineUnrecordedRefundAmount,
    format: won,
    formatCompact: won,
    note: '네이버페이와 같은 환불건은 카페24 통계시스템에서 집계되지 않음. 따라서 통계에서 잡히는 환불과 카페24에서 안 잡히는 환불을 합친 값',
  },
  // 위 환불액 중 카페24 환불 기록(/admin/refunds)에 없는 몫만 따로 — 스마트
  // 스토어(shopn)·네이버페이(NCHECKOUT)처럼 네이버 쪽에서 환불이 처리되는
  // 주문이 여기 해당한다. 한때 환불액 한 컬럼으로 합쳤었는데(위 주석),
  // 카페24 통계와 대조할 때 "얼마가 카페24엔 안 보이는 환불인지"가 필요해서
  // 다시 따로 보여준다. 환불액에 이미 포함된 값이라 더하면 안 된다.
  {
    key: 'onlineUnrecordedRefund',
    label: '스마트스토어 환불',
    getValue: (m) => m.onlineUnrecordedRefundAmount,
    format: won,
    formatCompact: won,
    note: '환불액 중 카페24 통계에 잡히지 않는 몫(스마트스토어·네이버페이 등 네이버 쪽에서 처리된 환불). 환불액에 이미 포함된 금액. 환불액 - 이 값 = 카페24 통계의 환불 금액',
  },
]

/** "카페24 온라인 매출" 표의 컬럼 하나 — 평소엔 대표 지표(representative)
 * 하나만 보여주고, members가 있으면 헤더의 펼침 버튼으로 그 칸 안에 관련
 * 지표를 전부 세로로 쌓아 보여준다(10/8 요청). 컬럼이 14개까지 늘어나 한눈에
 * 안 들어와서, 성격이 같은 것끼리(매출/환불/할인) 묶었다. 정렬과 "지표
 * 표시" 토글은 컬럼 단위(대표 지표 기준)로 동작한다. */
interface OnlineColumn {
  key: string
  representative: RoasField
  /** 펼쳤을 때 세로로 나열할 지표 — 대표 지표도 포함해서 보여줄 순서대로.
   * 없으면 묶음이 아닌 평범한 컬럼이다. */
  members?: readonly RoasField[]
}

const onlineField = (key: string): RoasField => {
  const field = ONLINE_FIELDS.find((f) => f.key === key)
  if (!field) throw new Error(`ONLINE_FIELDS에 없는 key: ${key}`)
  return field
}

const ONLINE_COLUMNS: readonly OnlineColumn[] = [
  {
    key: 'revenue',
    representative: onlineField('onlineRevenue'),
    members: [
      onlineField('onlineRevenue'),
      onlineField('onlineTotalRevenue'),
      onlineField('onlineRevenueCafe24Screen'),
      onlineField('onlineRevenueCafe24'),
      onlineField('onlineProductAmount'),
      onlineField('onlineGrossPayment'),
    ],
  },
  {
    key: 'refund',
    representative: onlineField('onlineTotalRefund'),
    members: [
      onlineField('onlineTotalRefund'),
      onlineField('onlineUnrecordedRefund'),
    ],
  },
  {
    key: 'discount',
    // 할인은 대표로 쓸 기존 컬럼이 없어서 합계를 대표 지표로 새로 둔다.
    // 적립금 사용도 여기 넣는다(10/8 요청) — 고객이 현금 대신 쓴 금액이라
    // 매출에서 빠지는 성격이 할인과 같다. 적립금은 환불로 되돌아간 몫을 뺀
    // 순 사용액('적립금 사용' 컬럼과 같은 값)으로 더한다.
    representative: {
      key: 'onlineTotalDiscount',
      label: '총 할인액',
      getValue: (m) =>
        m.onlineItemDiscount +
        m.onlineCouponDiscount +
        (m.onlinePointsSpent - m.onlinePointsRefunded),
      format: won,
      formatCompact: won,
      note: '상품할인 + 쿠폰할인 + 적립금 사용',
    },
    members: [
      onlineField('onlineItemDiscount'),
      onlineField('onlineCouponDiscount'),
      onlineField('onlinePointsSpent'),
    ],
  },
  { key: 'shipping', representative: onlineField('onlineShippingFee') },
]

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

/** 값 + (있으면) 바로 앞 행 대비 증감 — <td> 없이 내용만. 평범한 칸
 * (MetricValueCell)과 묶음 컬럼을 펼친 칸의 각 줄이 같이 쓴다. */
function MetricValue({
  value,
  prevValue,
  field,
}: {
  value: number
  prevValue: number | null
  field: RoasField
}) {
  if (prevValue == null) return <>{field.formatCompact(value)}</>
  const { delta, pct, dir } = computeDelta(value, prevValue)
  return (
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
  )
}

function MetricValueCell(props: {
  value: number
  prevValue: number | null
  field: RoasField
}) {
  return (
    <td>
      <MetricValue {...props} />
    </td>
  )
}

/** "기간" 컬럼용 정렬 키 — RoasField.key와 겹치지 않는 별도 문자열이라 굳이
 * 유니온으로 안 좁히고 필드 key와 같은 string 타입을 그대로 쓴다. */
const PERIOD_SORT_KEY = 'period'

/** "기간별 추이"/"오프라인 매출"/"카페24 온라인 매출" 표 세 곳이 전부 같은
 * 정렬 동작(컬럼 헤더 클릭 → 그 지표 기준 오름/내림차순, 같은 컬럼 다시
 * 누르면 방향만 뒤집기)을 쓰게 돼서 로직을 훅 하나로 뺐다 — 표마다 각자
 * useState를 갖고 있어서(훅을 호출하는 컴포넌트 인스턴스별로 독립) 한쪽
 * 표의 정렬이 다른 표에 안 번진다. 기본은 "기간" 내림차순(최신이 위),
 * 다른 컬럼을 처음 누르면 "큰 값부터"가 보통 더 유용해서 내림차순을 기본으로
 * 한다(channel-insight.tsx의 toggleSort와 같은 규칙). 합계/평균 행은 호출부가
 * 항상 별도로 그려서(rows에 안 섞여 들어옴) 정렬 대상에서 자동으로 빠진다. */
function useRoasTableSort(
  rows: readonly RoasRow[],
  fields: readonly RoasField[],
) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({
    key: PERIOD_SORT_KEY,
    dir: 'desc',
  })

  const toggleSort = (key: string) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'desc' },
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

  // 증감 비교 대상 — 지표로 정렬했으면 화면상 바로 윗 줄, 기간 순서면 시간상
  // 이전 기간(최신이 위인 기본 순서에서는 바로 아랫줄).
  const compareRowAt = (index: number): RoasRow | null => {
    if (sort.key === PERIOD_SORT_KEY && sort.dir === 'desc') {
      return sortedRows[index + 1] ?? null
    }
    return index > 0 ? sortedRows[index - 1] : null
  }

  return { sort, toggleSort, sortedRows, compareRowAt }
}

/** "기간별 추이"/"오프라인 매출"/"카페24 온라인 매출" 표 셋 다 자기만의 "지표
 * 표시" 토글이 있어야 해서(9/30 요청 전에는 ROAS_FIELDS만, 그것도 표가 아니라
 * "ROAS 요약" 카드 쪽에 있었다) 컬럼 표시/숨김 상태 관리를 훅으로 뺐다 —
 * useRoasTableSort와 같은 이유로 표 인스턴스별 독립 상태. 기본은 전부 표시.
 * fields 매개변수는 채널 인사이트의 FullListTable "컬럼 표시" 토글과 같은
 * 패턴을 그대로 쓴다(channel-insight.tsx). */
function useFieldVisibility(fields: readonly RoasField[], storageKey: string) {
  // 이 브라우저에 남겨 다음에 들어와도 그대로 — 저장은 "끈 지표"로 한다
  // (나중에 지표가 새로 생기면 기본으로 보이도록).
  const [hiddenKeys, setHiddenKeys] = usePersistentState<ReadonlySet<string>>(
    storageKey,
    () => new Set(),
    setOf(fields.map((f) => f.key)),
    (value) => [...value],
  )
  const visibleKeys = useMemo(
    () =>
      new Set(fields.filter((f) => !hiddenKeys.has(f.key)).map((f) => f.key)),
    [fields, hiddenKeys],
  )
  const toggle = (key: string) => {
    setHiddenKeys((prev) => {
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

/** "카페24 온라인 매출" 전용 표 — RoasSubTable과 같은 뼈대(보기 단위, 지표
 * 표시 토글, 정렬, 합계/평균, 앞 행 대비 증감)에 컬럼 묶음(ONLINE_COLUMNS)을
 * 얹었다. 묶음 컬럼은 헤더의 펼침 버튼을 누르면 그 칸이 세로로 늘어나며
 * 묶음 안의 지표를 전부 보여준다 — 펼침 상태는 묶음별로 독립이다. */
function OnlineRevenueTable({
  title,
  rows,
  total,
  average,
  grouping,
  onGroupingChange,
  visual,
}: {
  title: string
  /** 그래프 보기 — 있으면 머리에 [그래프 | 표]. */
  visual?: ReactNode
  rows: readonly RoasRow[]
  total: RoasMetrics
  average: RoasMetrics
  grouping: RoasGrouping
  onGroupingChange: (grouping: RoasGrouping) => void
}) {
  // 정렬·표시 토글은 컬럼의 대표 지표 기준 — 기존 훅을 그대로 쓴다.
  const representatives = useMemo(
    () => ONLINE_COLUMNS.map((c) => c.representative),
    [],
  )
  const { sort, toggleSort, sortedRows, compareRowAt } = useRoasTableSort(
    rows,
    representatives,
  )
  const { visibleKeys, toggle: toggleMetric } = useFieldVisibility(
    representatives,
    'cmip.roas.online.hiddenFields',
  )
  const visibleColumns = ONLINE_COLUMNS.filter((c) =>
    visibleKeys.has(c.representative.key),
  )
  const [open, setOpen] = useState(true)
  const [display, setDisplay] = useDisplayMode('cmip.roas.online.display')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /** 한 칸의 내용 — 접혀 있으면 대표 지표 하나, 펼쳐져 있으면 묶음의 지표를
   * "이름  값" 줄로 세로로 쌓는다. prev가 null이면(합계/평균 행, 첫 행)
   * 증감 없이 값만 나온다. */
  const renderCell = (
    column: OnlineColumn,
    metrics: RoasMetrics,
    prev: RoasMetrics | null,
  ) => {
    const isExpanded = column.members && expanded.has(column.key)
    if (!isExpanded) {
      const field = column.representative
      return (
        <td key={column.key}>
          <MetricValue
            value={field.getValue(metrics)}
            prevValue={prev ? field.getValue(prev) : null}
            field={field}
          />
        </td>
      )
    }
    return (
      <td key={column.key} className="channel-insight__group-cell">
        <span className="channel-insight__group-lines">
          {column.members!.map((field) => (
            <span key={field.key} className="channel-insight__group-line">
              <span
                className="channel-insight__group-line-label"
                title={field.note}
              >
                {field.label}
              </span>
              <MetricValue
                value={field.getValue(metrics)}
                prevValue={prev ? field.getValue(prev) : null}
                field={field}
              />
            </span>
          ))}
        </span>
      </td>
    )
  }

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
          {visual && <DisplayToggle value={display} onChange={setDisplay} />}
        </div>
      </div>

      {open && visual && display === 'chart' && visual}
      {open && (!visual || display === 'table') && (
        <>
          <FieldVisibilityToggles
            fields={representatives}
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
                    {visibleColumns.map((column) => {
                      const isExpanded = expanded.has(column.key)
                      return (
                        <th key={column.key}>
                          <SortableRoasFieldHeader
                            field={column.representative}
                            active={sort.key === column.representative.key}
                            dir={sort.dir}
                            onSort={() => toggleSort(column.representative.key)}
                          />
                          {column.members && (
                            <button
                              type="button"
                              className={`channel-insight__group-toggle${isExpanded ? ' is-open' : ''}`}
                              aria-expanded={isExpanded}
                              aria-label={`${column.representative.label} 세부 항목 ${isExpanded ? '접기' : '펼치기'}`}
                              onClick={() => toggleExpanded(column.key)}
                            >
                              <ChevronIcon />
                              {isExpanded
                                ? '접기'
                                : `+${column.members.length - (column.members.includes(column.representative) ? 1 : 0)}`}
                            </button>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, i) => {
                    const prevRow = compareRowAt(i)
                    return (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        {visibleColumns.map((column) =>
                          renderCell(
                            column,
                            row.metrics,
                            prevRow ? prevRow.metrics : null,
                          ),
                        )}
                      </tr>
                    )
                  })}
                  <tr className="channel-insight__table-row--total">
                    <td>합계</td>
                    {visibleColumns.map((column) =>
                      renderCell(column, total, null),
                    )}
                  </tr>
                  <tr className="channel-insight__table-row--average">
                    <td>평균</td>
                    {visibleColumns.map((column) =>
                      renderCell(column, average, null),
                    )}
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

/** OFFLINE_FIELDS/ONLINE_FIELDS 전용 소표 — "기간별 추이" 표와 같은 구조
 * (지표 표시 토글 + 기간별 행 + 합계 + 평균, 앞 행 대비
 * 증감 표시)를 그대로 재사용한다. 별도 그래프는 없다(ROAS 그래프만 이 화면의
 * 유일한 시각화로 충분하다고 판단). */
function RoasSubTable({
  title,
  storageKey,
  fields,
  rows,
  total,
  average,
  grouping,
  onGroupingChange,
  visual,
}: {
  title: string
  /** 지표 표시 설정을 이 브라우저에 남길 이름(그래프/표 고른 것도 이 이름 뒤에). */
  storageKey: string
  /** 그래프 보기 — 있으면 머리에 [그래프 | 표]. */
  visual?: ReactNode
  fields: readonly RoasField[]
  rows: readonly RoasRow[]
  total: RoasMetrics
  average: RoasMetrics
  /** 이 표만의 보기 단위(일별/요일별/주차별/월별) — "기간별 추이" 표와
   * 독립적으로 바뀐다(9/30 요청 전에는 표 하나(전역)만 있었다). */
  grouping: RoasGrouping
  onGroupingChange: (grouping: RoasGrouping) => void
}) {
  const { sort, toggleSort, sortedRows, compareRowAt } = useRoasTableSort(
    rows,
    fields,
  )
  const {
    visibleKeys,
    toggle: toggleMetric,
    visibleFields,
  } = useFieldVisibility(fields, storageKey)
  const [open, setOpen] = useState(true)
  const [display, setDisplay] = useDisplayMode(`${storageKey}.display`)

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
          {visual && <DisplayToggle value={display} onChange={setDisplay} />}
        </div>
      </div>

      {open && visual && display === 'chart' && visual}
      {open && (!visual || display === 'table') && (
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
                    const prevRow = compareRowAt(i)
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
  repeatRevenue,
  adRevenue,
  attribution,
}: {
  combinedInsight: CombinedInsight | null
  offlineRevenue: OfflineRevenueSummary | null
  onlineRevenue: Cafe24RevenueSummary | null
  /** 날짜별 재구매 금액(xtool) — 불러오지 못했으면 null이고, 신규 고객 지표가
   * '-'로 보인다. */
  repeatRevenue: RepeatRevenueByDate | null
  /** 날짜별 UTM 광고 매출(하한 ROAS의 분자) — 못 불러왔으면 null이고 하한
   * ROAS가 '-'로 보인다. */
  adRevenue: RepeatRevenueByDate | null
  /** 광고 기여 ROAS 재료(xtool) — 불러오지 못했으면 null이고 그 섹션만
   * 안내 문구로 바뀐다. */
  attribution: AttributionRow[] | null
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
  } = useRoasViewModel(
    combinedInsight,
    offlineRevenue,
    onlineRevenue,
    repeatRevenue,
    adRevenue,
  )
  const { rows, average } = trend

  // 지표 표시/숨김 — "기간별 추이" 표 전용이다(9/30 요청 전에는 "ROAS 요약"
  // 카드까지 같이 숨겼는데, 요약 카드는 항상 전체를 보여주는 쪽으로
  // 바꿨다 — 아래 ROAS 요약 section 참고).
  const {
    visibleKeys,
    toggle: toggleMetric,
    visibleFields,
  } = useFieldVisibility(ROAS_FIELDS, 'cmip.roas.trend.hiddenFields')

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
    compareRowAt: compareTrendRowAt,
  } = useRoasTableSort(rows, ROAS_FIELDS)

  // "ROAS 요약"/"기간별 추이" 섹션 접기·펼치기(9/30 요청) — 오프라인 매출/
  // 카페24 온라인 매출은 RoasSubTable이 각자 자기 인스턴스 안에서 따로
  // 갖고 있다(이 두 상태와 독립적으로 동작).
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [trendOpen, setTrendOpen] = useState(true)
  const [trendDisplay, setTrendDisplay] = useDisplayMode(
    'cmip.roas.trend.display',
  )
  // 기간별 매출 막대를 무엇으로 나눌지 — 신규·재구매 / 오프라인·온라인.
  const [revenueSplit, setRevenueSplit] = usePersistentState<RevenueSplit>(
    'cmip.roas.trend.revenueSplit',
    'newRepeat',
    oneOf<RevenueSplit>(['newRepeat', 'channel']),
  )

  // ROAS 요약 칸의 작은 추이 — 아래 표의 보기 단위와 무관하게 늘 일별(날짜마다
  // 같은 계산). 칸을 누르면 이 묶음 안에서 커지며 자세히 보여 주고, 거기서
  // 주별·월별(표의 주차별·월별과 같은 계산)로 바꿔 볼 수 있다. 데이터가 바뀔
  // 때만 다시 계산한다(훅이라 아래 조기 return보다 먼저).
  const groupedRows = useMemo(() => {
    const rowsOf = (grouping: RoasGrouping) =>
      computeRoasRows(
        grouping,
        combinedInsight,
        offlineRevenue,
        onlineRevenue,
        repeatRevenue,
        adRevenue,
      )
    return {
      day: rowsOf(RoasGrouping.DATE),
      week: rowsOf(RoasGrouping.WEEK),
      month: rowsOf(RoasGrouping.MONTH),
    }
  }, [combinedInsight, offlineRevenue, onlineRevenue, repeatRevenue, adRevenue])
  const daily = groupedRows.day
  const periodLabel =
    daily.length > 0 ? `${daily[0].key} ~ ${daily[daily.length - 1].key}` : ''
  const seriesOf = (field: RoasField): TrendSeries[] =>
    (
      [
        ['day', '일별', '일'],
        ['week', '주별', '주'],
        ['month', '월별', '월'],
      ] as const
    ).map(([key, label, unit]) => ({
      key,
      label,
      unit,
      labels: groupedRows[key].map((row) => row.label),
      values: groupedRows[key].map((row) => field.getValue(row.metrics)),
    }))

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

        {summaryOpen &&
          (daily.length > 1 ? (
            <TrendGrid
              className="channel-insight__summary-grid has-trend"
              style={{ '--cols': 3 } as CSSProperties}
              tiles={ROAS_FIELDS.map((f, index) => {
                const values = daily.map((row) => f.getValue(row.metrics))
                return {
                  key: f.key,
                  className: 'channel-insight__kpi',
                  style: { '--glass-i': index } as CSSProperties,
                  detail: {
                    title: f.label,
                    subtitle: periodLabel,
                    value: f.format(f.getValue(total)),
                    format: f.format,
                    series: () => seriesOf(f),
                  },
                  content: (
                    <>
                      <span className="channel-insight__kpi-label">
                        <RoasFieldLabel field={f} />
                      </span>
                      <span className="channel-insight__kpi-row">
                        <span className="channel-insight__kpi-value">
                          {f.format(f.getValue(total))}
                        </span>
                        <Sparkline
                          className="channel-insight__kpi-spark"
                          values={values}
                        />
                      </span>
                    </>
                  ),
                }
              })}
            />
          ) : (
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
          ))}
      </section>

      {/* 광고 기여 ROAS — 범위(하한~상한)와 고객 유입 월 코호트. */}
      <RoasAttribution
        combinedInsight={combinedInsight}
        attribution={attribution}
        upperBound={total.newCustomerRoas}
      />

      {/* 예전엔 "기간별 추이" 표 헤더에만 보기 단위(일별/요일별/주차별/월별)
          컨트롤이 있었는데, 실제로는 세 표(기간별 추이/오프라인 매출/카페24
          온라인 매출) 전부에 적용되는 것처럼 보였다 — 표 하나 소속이 아니라
          전역 컨트롤이라는 게 더 분명하도록 밖으로 뺐다(9/30 요청). 여기서
          바꾸면 세 표 전부 한 번에 같은 보기 단위로 맞춰지고, 그 아래 각 표
          section-head에도 자기만의 보기 단위 컨트롤이 따로 있어서 개별로도
          바꿀 수 있다. */}
      <div className="roas-toolbar">
        <span>보기 단위</span>
        <Segmented
          options={GROUPING_LABEL}
          value={globalGrouping}
          onChange={setGroupingForAll}
          label="전체 보기 단위"
        />
        <small>
          아래 세 섹션에 한 번에 적용 — 섹션마다 따로 바꿀 수도 있습니다
        </small>
      </div>

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
            <DisplayToggle value={trendDisplay} onChange={setTrendDisplay} />
          </div>
        </div>

        {trendOpen && trendDisplay === 'chart' && (
          <div className="roas-visual">
            {rows.length === 0 ? (
              <p className="channel-insight__result-empty">데이터 없음</p>
            ) : (
              <>
                <RoasTrendChart {...trendChartProps(rows, average)} />
                <div className="roas-visual__head">
                  <span>광고비와 매출</span>
                  <Segmented
                    options={REVENUE_SPLIT_LABEL}
                    value={revenueSplit}
                    onChange={setRevenueSplit}
                    label="매출 나누기"
                    role="buttons"
                  />
                </div>
                <PeriodStackChart
                  labels={rows.map((row) => row.label)}
                  groups={revenueGroups(rows, revenueSplit)}
                  rightAxis="spend"
                  note={(i) =>
                    `광고비 대비 매출 ${pct2(rows[i].metrics.roas)} · 매출 대비 광고비 ${pct2(ratio(rows[i].metrics.spend, rows[i].metrics.totalRevenue))}`
                  }
                />
              </>
            )}
          </div>
        )}
        {trendOpen && trendDisplay === 'table' && (
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
                        const prevRow = compareTrendRowAt(i)
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
              </>
            )}
          </>
        )}
      </section>

      <RoasSubTable
        title="오프라인 매출"
        storageKey="cmip.roas.offline.hiddenFields"
        fields={OFFLINE_FIELDS}
        rows={offline.rows}
        total={total}
        average={offline.average}
        grouping={groupings[RoasTable.OFFLINE]}
        onGroupingChange={(g) => setGroupingFor(RoasTable.OFFLINE, g)}
        visual={
          <div className="roas-visual">
            <RatioChips
              items={[
                {
                  key: 'gross',
                  label: '오프라인 총매출',
                  value: won(total.offlineRevenue + total.installmentInterest),
                },
                {
                  key: 'net',
                  label: '오프라인 매출',
                  value: won(total.offlineRevenue),
                },
                {
                  key: 'share',
                  label: '총 매출 중 오프라인',
                  value: pct2(ratio(total.offlineRevenue, total.totalRevenue)),
                },
                {
                  key: 'interest',
                  label: '할부이자 비율',
                  value: pct2(
                    ratio(
                      total.installmentInterest,
                      total.offlineRevenue + total.installmentInterest,
                    ),
                  ),
                  note: '오프라인 총매출 중 카드사로 나가는 장기 할부 이자',
                },
                {
                  key: 'deferred',
                  label: '미수금(분할 잔금)',
                  value: won(Math.abs(total.deferredBalance)),
                  note: '계약은 했지만 아직 받지 않은 분할 잔금 — 오프라인 매출에서 빠져 있습니다',
                  tone: total.deferredBalance !== 0 ? 'warn' : undefined,
                },
              ]}
            />
            {offline.rows.length > 0 && (
              <PeriodStackChart
                labels={offline.rows.map((row) => row.label)}
                groups={[
                  {
                    key: 'offline',
                    label: '오프라인 총매출',
                    series: [
                      {
                        key: 'net',
                        label: '오프라인 매출',
                        color: COLOR.main,
                        values: offline.rows.map(
                          (row) => row.metrics.offlineRevenue,
                        ),
                      },
                      {
                        key: 'interest',
                        label: '할부이자',
                        color: COLOR.interest,
                        values: offline.rows.map(
                          (row) => row.metrics.installmentInterest,
                        ),
                      },
                    ],
                  },
                ]}
              />
            )}
          </div>
        }
      />

      <OnlineRevenueTable
        title="카페24 온라인 매출"
        rows={online.rows}
        total={total}
        average={online.average}
        grouping={groupings[RoasTable.ONLINE]}
        onGroupingChange={(g) => setGroupingFor(RoasTable.ONLINE, g)}
        visual={
          <div className="roas-visual">
            <RatioChips
              items={[
                {
                  key: 'roas',
                  label: '매출액(ROAS용)',
                  value: won(total.onlineRevenue),
                },
                {
                  key: 'discount',
                  label: '할인율',
                  value: pct2(
                    ratio(
                      total.onlineItemDiscount + total.onlineCouponDiscount,
                      total.onlineGrossPayment -
                        total.onlineShippingFee +
                        total.onlineCouponDiscount,
                    ),
                  ),
                  note: '(상품할인 + 쿠폰할인) ÷ 상품 구매금액',
                },
                {
                  key: 'refund',
                  label: '환불률',
                  value: pct2(
                    ratio(
                      total.onlineRefundAmount +
                        total.onlineUnrecordedRefundAmount,
                      total.onlineGrossPayment,
                    ),
                  ),
                  note: '총 환불액 ÷ 총 주문 금액',
                  tone:
                    ratio(
                      total.onlineRefundAmount +
                        total.onlineUnrecordedRefundAmount,
                      total.onlineGrossPayment,
                    ) >= 10
                      ? 'warn'
                      : undefined,
                },
                {
                  key: 'smart',
                  label: '환불 중 스마트스토어',
                  value: pct2(
                    ratio(
                      total.onlineUnrecordedRefundAmount,
                      total.onlineRefundAmount +
                        total.onlineUnrecordedRefundAmount,
                    ),
                  ),
                  note: '카페24 통계에 안 잡히는 환불의 몫',
                },
                {
                  key: 'leak',
                  label: 'ROAS에서 빠진 몫',
                  value: pct2(
                    ratio(
                      total.onlineGrossPayment - total.onlineRevenue,
                      total.onlineGrossPayment,
                    ),
                  ),
                  note: '(총 주문 금액 - ROAS용 매출) ÷ 총 주문 금액 — 할인·환불·배송비·적립금',
                },
              ]}
            />
            <Waterfall steps={onlineWaterfall(total)} />
            {online.rows.length > 0 && (
              <PeriodStackChart
                labels={online.rows.map((row) => row.label)}
                height={220}
                groups={[
                  {
                    key: 'revenue',
                    label: '매출액(ROAS용)',
                    series: [
                      {
                        key: 'revenue',
                        label: '매출액(ROAS용)',
                        color: COLOR.online,
                        values: online.rows.map(
                          (row) => row.metrics.onlineRevenue,
                        ),
                      },
                    ],
                  },
                  {
                    key: 'refund',
                    label: '환불',
                    series: [
                      {
                        key: 'refund',
                        label: '환불',
                        color: COLOR.minus,
                        values: online.rows.map(
                          (row) =>
                            row.metrics.onlineRefundAmount +
                            row.metrics.onlineUnrecordedRefundAmount,
                        ),
                      },
                    ],
                  },
                ]}
              />
            )}
          </div>
        }
      />
    </div>
  )
}

/**
 * getCafe24Revenue 클라이언트 — functions-cmip `getCafe24Revenue`(onRequest, GET)
 * 호출. offline-revenue-client.ts(Monday CRM, 오프라인 매출)와 완전히 같은
 * 모양(GET + dateStart/dateEnd 쿼리, 서버가 total/byDate/byDayOfWeek/
 * byGroupedWeek/byMonth까지 이미 집계해서 반환)이라 그대로 복사해 구현한다.
 * Cafe24는 온라인 스토어 주문 데이터라 "온라인 매출" 쪽을 담당 — 오프라인
 * 매출과 합치지 않고 별도로 쓴다(전체 요약/ROAS 탭에서 온라인/오프라인을
 * 따로 집계해 보여줘야 해서).
 */
import { CMIP_API_BASE } from '@/screens/xtool-lead-manager/constants'
import type { ISODate } from '../types'
import { CallableError } from './csv-client'

export interface Cafe24RevenueMetrics {
  /** 순매출(온라인 매출 대표값) = grossPayment - itemDiscount - refundAmount -
   * unrecordedRefundAmount(배송비·적립금 포함, 실제로 나간 돈은 다 뺀 값).
   * 카페24 공식 서비스 가이드(일별/월별매출)의 "순매출 = 결제합계 - 환불합계"
   * (결제합계 자체가 배송비 포함) 정의를 5/24 주문 대조로 확인해서 배송비는
   * 안 뺀다. 적립금도 grossPayment/refundAmount 계산 단계에서부터 이미
   * 포함돼 있어(6월 매출 대조로 확인) 여기서 따로 뺄 게 없다. itemDiscount는
   * grossPayment에는 아직 남아있어서(grossPayment 주석 참고, 3/12 매출
   * 대조) 여기서 따로 뺀다. 환불은 카페24 /admin/refunds 기록분
   * (refundAmount)뿐 아니라 NCHECKOUT(네이버페이) 등의 폴백 환불
   * (unrecordedRefundAmount)까지 둘 다 뺀다 — 한때 폴백분은 빼면 카페24
   * 화면과 어긋난다고 보고 제외했었는데(4월 매출 대조), 그 화면 자체가 이
   * 취소를 전혀 몰라서(총 결제액도 안 줄어듦) "카페24 매출액"이 실제로
   * 가게에 남은 돈보다 부풀려 보였던 거라 다시 포함시켰다 — 그래서 이
   * 필드는 카페24 관리자 화면 숫자와 정확히 일치하지 않을 수 있다(폴백
   * 환불이 있는 기간이면 그만큼 낮게 나오는 게 맞음). ROAS 계산용 온라인
   * 매출(use-roas-view-model.ts)은 이 값에서 배송비·순 적립금을 별도로 더
   * 빼서 쓴다. 결제(결제일 기준)와 환불(환불완료일 기준)을 서로 다른
   * 날짜/리소스에서 가져와 계산한다 — 카페24 관리자 일별 리포트가 주문일이
   * 아니라 결제일 기준으로 집계하는 걸 확인해서 맞췄고, 환불도 카페24의 별도
   * "환불(refunds)" 리소스가 제공하는 환불완료일 기준으로 맞췄다(한 주문이
   * 여러 번에 나눠 환불되는 경우 접수일 하나로는 표현이 안 돼서 — 실제로
   * 발견한 사례: 접수 8/21, 카드 부분취소 완료는 8/18과 8/31 두 번). */
  paymentAmount: number
  /** 총결제액 — 주문 시점(취소 여부 무관) 상품구매금액+배송비 합계(결제일
   * 기준) + 반품 추가배송비 합계(반품 접수일 기준). 배송비·적립금 포함,
   * 쿠폰할인은 제외하지만 **상품할인(itemDiscount)은 아직 포함돼 있다** —
   * 3/12 매출 대조로 카페24 관리자 "총결제액" 컬럼이 상품할인 반영 전
   * 금액이라는 걸 확인했다(예전엔 여기서도 상품할인을 뺐었는데, 그러면 이
   * 필드가 실제로는 카페24의 "총매출액"(할인 반영 후) 개념과 같아지는 라벨
   * 불일치가 있었다). 이 둘을 더하는 이유는 additionalShippingFee 주석
   * 참고. */
  grossPayment: number
  /** 환불금액 — 실제로 환불 완료 처리된 금액 합계(적립금/예치금 환불분
   * 포함), 환불완료일 기준(결제일과 다른 달일 수 있음). 카페24 /admin/refunds에
   * 실제로 기록된 환불만 — 폴백 환불(NCHECKOUT 등)은 unrecordedRefundAmount로
   * 따로 노출하지만, paymentAmount 계산에서는 이 둘을 합쳐서 뺀다
   * (paymentAmount 주석 참고). 이 필드 자체는 "카페24 화면에 실제로 잡히는
   * 환불이 얼마인지"를 보여주는 용도. */
  refundAmount: number
  /** 참고용 — grossPayment에 포함된 배송비 합계(기본 배송비 + 추가배송비),
   * paymentAmount(순매출)에서는 빠져있다. */
  shippingFee: number
  /** 참고용 — grossPayment(따라서 paymentAmount)에 이미 포함된 적립금 사용액
   * 합계(결제일 기준 — 나중에 환불되면 pointsRefunded로 따로 잡힌다). */
  pointsSpent: number
  /** 참고용 — refundAmount에 포함된 적립금 환불액 합계(환불완료일 기준).
   * 순 적립금 사용액 = pointsSpent - pointsRefunded. */
  pointsRefunded: number
  /** 참고용 — grossPayment에서 이미 제외된 쿠폰 등 주문 단위 할인 합계.
   * 지금까지 이 매장이 실제로 쓴 건 쿠폰뿐이라 "쿠폰할인"으로 부른다(7/7
   * 환불 건에서 발견 — 이걸 안 빼서 환불액이 100,000원 과다 집계됐었다). */
  couponDiscount: number
  /** 참고용 — grossPayment에는 아직 포함돼 있고 paymentAmount에서만 빠지는
   * "상품 할인" 합계(카페24 관리자 "일별 매출내역"의 "할인" 컬럼, 쿠폰과
   * 별도, grossPayment 주석 참고). order_price_amount와
   * payment_amount의 차이로만 드러나고 어떤 구조화된 할인 필드에도 안
   * 잡힌다(카페24가 품목별로 내려주는 additional_discount_price 필드로 바꿔본
   * 적도 있는데, 6/9·6/10 주문처럼 그 필드로도 안 잡히는 할인이 있어서 역산
   * 방식으로 되돌렸다). 처음엔 스마트스토어 채널에서만 발견했는데, 자체몰/
   * 모바일/NCHECKOUT(네이버페이) 채널에서도 같은 패턴이 나와 전 채널로
   * 넓혔다 — NCHECKOUT은 네이버포인트 결제분만 따로 제외하고 계산한다. */
  itemDiscount: number
  /** 참고용 — grossPayment에 포함된 반품 추가배송비 합계만 따로(반품 접수일
   * 기준). 반품 시 "반품배송비 구매자부담"으로 별도 결제가 일어나는 경우가
   * 있는데, 원 주문 결제에도 환불에도 안 잡히는 제3의 현금흐름이라 따로
   * 추적한다(shippingFee에도 이미 합산되어 있음). */
  additionalShippingFee: number
  /** 참고용 — refundAmount(카페24 화면 기록분)에는 안 들어있는 폴백 환불
   * 합계. NCHECKOUT(네이버페이) 등 카페24 자체 PG가 아닌 채널의 취소는 카페24
   * /admin/refunds에 기록이 안 남아 카페24 관리자 화면도 이 돈이 나간 걸
   * 모른다. paymentAmount 계산에는 이미 반영돼 있고(paymentAmount 주석
   * 참고), 이 필드는 "그중 얼마가 카페24 화면엔 안 보이는 몫인지" 감사용으로
   * 따로 노출한다. */
  unrecordedRefundAmount: number
  /** 결제 건수(결제일 기준). */
  orderCount: number
  /** 환불 건수(환불완료일 기준, 한 주문에 여러 건일 수 있음). */
  refundCount: number
  /** 참고용 — refundAmount에 이미 포함된 수동 보정 합계(/admin/cafe24에서
   * 직접 등록한 값). 양수면 환불을 늘린 것, 음수면 줄인 것. 이 필드가
   * 생기기 전에 배포된 서버 응답엔 없어서 optional이다. */
  manualRefundAdjustment?: number
}

export interface Cafe24RevenueDateSummary extends Cafe24RevenueMetrics {
  date: ISODate
}

export interface Cafe24RevenueDayOfWeekSummary extends Cafe24RevenueMetrics {
  dayOfWeek: string
}

export interface Cafe24RevenueWeekSummary extends Cafe24RevenueMetrics {
  period: string
  startDate: ISODate
  endDate: ISODate
}

export interface Cafe24RevenueMonthSummary extends Cafe24RevenueMetrics {
  period: string
  startDate: ISODate
  endDate: ISODate
}

export interface Cafe24RevenueSummary {
  total: Cafe24RevenueMetrics
  byDate: Cafe24RevenueDateSummary[]
  byDayOfWeek: Cafe24RevenueDayOfWeekSummary[]
  byGroupedWeek: Cafe24RevenueWeekSummary[]
  byMonth: Cafe24RevenueMonthSummary[]
}

interface ErrorBody {
  error?: string
}

export async function getCafe24Revenue(
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<Cafe24RevenueSummary> {
  const params = new URLSearchParams({ dateStart, dateEnd })
  const res = await fetch(
    `${CMIP_API_BASE}/getCafe24Revenue?${params.toString()}`,
  )

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(
      'getCafe24Revenue 응답을 해석할 수 없습니다.',
      res.status,
    )
  }

  if (!res.ok) {
    const message =
      (body as ErrorBody)?.error ??
      `getCafe24Revenue 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  return body as Cafe24RevenueSummary
}

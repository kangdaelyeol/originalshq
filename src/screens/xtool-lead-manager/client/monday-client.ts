import { API_BASE } from '../constants'
import type {
  MondayCustomer,
  MondayCustomerListItem,
  MondayDailyInflow,
  MondayDailySale,
  MondayFollowUp,
  MondayGaTracking,
  MondayKpiFacts,
  MondayMissingPhoneItem,
  MondayPaymentIssueItem,
} from '../entity'
import type { ClientResponse } from './lead-client'

const get = async <T>(
  endpoint: string,
  fallbackError: string,
): Promise<ClientResponse<T>> => {
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`)

    if (!response.ok) {
      return { ok: false, error: fallbackError, status: response.status }
    }

    return { ok: true, data: (await response.json()) as T }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : fallbackError,
    }
  }
}

export const mondayClient = {
  /** 통합 고객 전체(요약만) — 표가 쓴다. */
  getCustomers: () =>
    get<{ customers: MondayCustomerListItem[]; count: number }>(
      'listMondayCustomers',
      'Monday 고객 목록을 불러오지 못했습니다',
    ),
  /** 고객 1명의 전체 기록 — 상세 모달이 쓴다. */
  getCustomer: (phone: string) =>
    get<{ customer: MondayCustomer }>(
      `getMondayCustomer?phone=${encodeURIComponent(phone)}`,
      '고객 정보를 불러오지 못했습니다',
    ),
  /** 유효한 번호가 없어 통합에서 빠진 기록들. */
  getMissingPhoneItems: () =>
    get<{ items: MondayMissingPhoneItem[]; count: number }>(
      'listMondayMissingPhoneItems',
      '번호 확인이 필요한 기록을 불러오지 못했습니다',
    ),
  /** 확인이 필요한 결제 기록들(계약을 못 찾는 납부 등). */
  getPaymentIssues: () =>
    get<{ issues: MondayPaymentIssueItem[]; count: number }>(
      'listMondayPaymentIssues',
      '확인이 필요한 결제 기록을 불러오지 못했습니다',
    ),
  /** 날짜별 인입 건수 전체 — 통계 탭의 그래프가 쓴다. */
  getDailyInflow: () =>
    get<{ days: MondayDailyInflow[]; syncedAt: number | null }>(
      'getMondayDailyInflow',
      '인입 통계를 불러오지 못했습니다',
    ),
  /** 판매 통계용 줄 전체(날짜·채널·제품별) — 통계 탭의 판매통계가 쓴다. */
  getDailySales: () =>
    get<{ rows: MondayDailySale[]; syncedAt: number | null }>(
      'getMondayDailySales',
      '판매 통계를 불러오지 못했습니다',
    ),
  /** 진행 중인 상담·방문체험 기록 전체 — 통계 탭의 방치 현황이 쓴다. */
  getFollowUps: () =>
    get<{ followUps: MondayFollowUp[]; syncedAt: number | null }>(
      'getMondayFollowUps',
      '방치 현황을 불러오지 못했습니다',
    ),
  /** 개인 KPI 재료 — 통계 탭의 개인 KPI가 쓴다. */
  getKpiFacts: () =>
    get<MondayKpiFacts & { syncedAt: number | null }>(
      'getMondayKpiFacts',
      '개인 KPI를 불러오지 못했습니다',
    ),
  /** 오기입 추적 — GA ClientId가 적힌 상담과 그 GA4 이벤트. */
  getGaTracking: () =>
    get<MondayGaTracking>(
      'getMondayGaTracking',
      '오기입 추적 데이터를 불러오지 못했습니다',
    ),
}

import { API_BASE } from '../constants'
import type {
  MondayCustomer,
  MondayCustomerListItem,
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
      return { ok: false, error: fallbackError }
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
}

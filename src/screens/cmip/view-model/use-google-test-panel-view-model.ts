import { useState } from 'react'
import {
  getGoogleAuthUrl,
  getGoogleAuthStatus,
  getGoogleCampaignInsightRaw,
  getGoogleAdGroupInsightRaw,
  CallableError,
  type GoogleAuthStatusResult,
  type GoogleCampaignInsightRow,
  type GoogleAdGroupInsightRow,
} from '../client'
import { addDays, todayISO } from '../utils'

export type InsightLevel = 'campaign' | 'adgroup'

export interface InsightState {
  totalCount: number
  dateStart: string
  dateEnd: string
  rows: GoogleCampaignInsightRow[] | GoogleAdGroupInsightRow[]
  level: InsightLevel
}

/**
 * google-test-panel의 세 섹션(연동 상태 확인/연동 시작/인사이트 조회)은 서로
 * 독립적인 흐름이라 각자 loading/error를 따로 갖는다 — 한 섹션이 실패해도
 * 다른 섹션 상태에 영향을 주지 않기 위함(기존 컴포넌트 동작 그대로 유지).
 */
export const useGoogleTestPanelViewModel = () => {
  // 입력
  const [brandId, setBrandId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [loginCustomerId, setLoginCustomerId] = useState('')
  const [level, setLevel] = useState<InsightLevel>('campaign')
  const [dateStart, setDateStart] = useState(() => addDays(todayISO(), -7))
  const [dateEnd, setDateEnd] = useState(() => addDays(todayISO(), -1))

  // 1. 연동 상태 확인
  const [status, setStatus] = useState<GoogleAuthStatusResult | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  // 2. 연동 시작
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // 3. 인사이트 조회
  const [insight, setInsight] = useState<InsightState | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightError, setInsightError] = useState<string | null>(null)

  const describeError = (err: unknown, fallback: string): string =>
    err instanceof CallableError || err instanceof Error ? err.message : fallback

  const checkStatus = async () => {
    if (!brandId) {
      setStatusError('brandId를 입력해주세요.')
      return
    }
    setStatusError(null)
    setStatusLoading(true)
    try {
      setStatus(await getGoogleAuthStatus(brandId))
    } catch (err) {
      setStatusError(describeError(err, '연동 상태 확인에 실패했습니다.'))
      setStatus(null)
    } finally {
      setStatusLoading(false)
    }
  }

  const startAuth = async () => {
    if (!brandId) {
      setAuthError('brandId를 입력해주세요.')
      return
    }
    setAuthError(null)
    setAuthLoading(true)
    try {
      const { url } = await getGoogleAuthUrl(brandId)
      // 팝업 차단을 피하려면 이 클릭 핸들러 안에서 바로 열어야 한다(비동기 완료
      // 후 열면 브라우저가 사용자 제스처와 무관한 창으로 보고 막을 수 있다) —
      // 다만 fetch가 끝나야 URL을 알 수 있으니, 완전히 막히면 안내만 보여준다.
      const win = window.open(url, '_blank', 'noopener,noreferrer')
      if (!win) {
        setAuthError(
          '팝업이 차단된 것 같습니다. 브라우저 팝업 허용 후 다시 시도하거나, 아래 링크를 직접 열어주세요: ' +
            url,
        )
      }
    } catch (err) {
      setAuthError(describeError(err, 'Google 연동 URL 발급에 실패했습니다.'))
    } finally {
      setAuthLoading(false)
    }
  }

  const fetchInsight = async () => {
    if (!brandId || !customerId || !loginCustomerId) {
      setInsightError(
        'brandId, customerId, loginCustomerId를 모두 입력해주세요.',
      )
      return
    }
    setInsightError(null)
    setInsightLoading(true)
    try {
      const req = { brandId, dateStart, dateEnd, customerId, loginCustomerId }
      const result =
        level === 'campaign'
          ? await getGoogleCampaignInsightRaw(req)
          : await getGoogleAdGroupInsightRaw(req)
      setInsight({
        totalCount: result.totalCount,
        dateStart: result.dateStart,
        dateEnd: result.dateEnd,
        rows: result.rows,
        level,
      })
    } catch (err) {
      setInsightError(
        describeError(err, 'Google 인사이트 조회에 실패했습니다.'),
      )
      setInsight(null)
    } finally {
      setInsightLoading(false)
    }
  }

  return {
    // 입력
    brandId,
    setBrandId,
    customerId,
    setCustomerId,
    loginCustomerId,
    setLoginCustomerId,
    level,
    setLevel,
    dateStart,
    setDateStart,
    dateEnd,
    setDateEnd,
    // 진행 상태
    status,
    statusLoading,
    statusError,
    authLoading,
    authError,
    insight,
    insightLoading,
    insightError,
    // 액션
    checkStatus,
    startAuth,
    fetchInsight,
  }
}

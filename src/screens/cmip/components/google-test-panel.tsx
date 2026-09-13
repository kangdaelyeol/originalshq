import { useState } from 'react'
import {
  getGoogleAuthUrl,
  getGoogleAuthStatus,
  getGoogleAdsInsightRaw,
  CallableError,
  type GoogleAuthStatusResult,
  type GoogleAdsInsightResult,
} from '../client'
import { addDays, todayISO } from '../utils'
import '../styles/google-test-panel.scss'

const describeError = (err: unknown, fallback: string): string =>
  err instanceof CallableError || err instanceof Error ? err.message : fallback

const won = (v: number): string => `${v.toLocaleString()}원`

/**
 * Google Ads 실 연동 확인 전용 화면 — 실 서비스(meta-insight)의 구글 데이터는
 * 아직 google-insight-mock을 쓰고 있고, 이 패널은 그와 무관하게 "새로 붙인
 * OAuth·데이터 추출 로직이 실제로 동작하는지"만 검증한다. 흐름:
 *   1) brandId로 연동 상태 확인 → 미연동이면
 *   2) "연동 시작"으로 Google 동의 화면을 새 탭에서 열어 승인(→ oauthCallback이
 *      refreshToken 저장) →
 *   3) customerId/기간을 넣고 "인사이트 조회"로 실제 데이터가 들어오는지 확인.
 */
export function GoogleTestPanel() {
  const [brandId, setBrandId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [dateStart, setDateStart] = useState(() => addDays(todayISO(), -7))
  const [dateEnd, setDateEnd] = useState(() => addDays(todayISO(), -1))

  const [status, setStatus] = useState<GoogleAuthStatusResult | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const [insight, setInsight] = useState<GoogleAdsInsightResult | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightError, setInsightError] = useState<string | null>(null)

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
    if (!brandId || !customerId) {
      setInsightError('brandId와 customerId를 모두 입력해주세요.')
      return
    }
    setInsightError(null)
    setInsightLoading(true)
    try {
      setInsight(
        await getGoogleAdsInsightRaw(brandId, dateStart, dateEnd, customerId),
      )
    } catch (err) {
      setInsightError(
        describeError(err, 'Google 인사이트 조회에 실패했습니다.'),
      )
      setInsight(null)
    } finally {
      setInsightLoading(false)
    }
  }

  return (
    <div className="google-test-panel">
      <p className="google-test-panel__notice">
        실 서비스 화면(인사이트 조회)의 구글 데이터는 아직 목업입니다 — 이
        패널은 새로 붙인 Google Ads OAuth·데이터 추출 로직이 실제로 동작하는지
        만 확인하는 별도 테스트 도구입니다.
      </p>

      <section className="google-test-panel__section">
        <h3 className="google-test-panel__section-title">1. 연동 상태 확인</h3>
        <div className="google-test-panel__row">
          <label className="google-test-panel__field">
            <span>brandId</span>
            <input
              type="text"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              placeholder="예: 1"
            />
          </label>
          <button
            type="button"
            className="google-test-panel__btn"
            onClick={checkStatus}
            disabled={statusLoading}
          >
            {statusLoading ? '확인 중…' : '연동 상태 확인'}
          </button>
        </div>
        {statusError && (
          <div className="google-test-panel__banner is-error">
            {statusError}
          </div>
        )}
        {status && (
          <div
            className={`google-test-panel__status${
              status.connected ? ' is-connected' : ''
            }`}
          >
            {status.connected ? '✅ 연동됨' : '⚪️ 연동 안 됨'}
            {status.updatedAt && (
              <span className="google-test-panel__status-meta">
                (마지막 갱신: {status.updatedAt})
              </span>
            )}
          </div>
        )}
      </section>

      <section className="google-test-panel__section">
        <h3 className="google-test-panel__section-title">2. 연동 시작</h3>
        <p className="google-test-panel__hint">
          위 brandId로 Google 동의 화면을 새 탭에서 엽니다. 승인하면
          oauthCallback이 refreshToken을 저장합니다.
        </p>
        <button
          type="button"
          className="google-test-panel__btn google-test-panel__btn--accent"
          onClick={startAuth}
          disabled={authLoading}
        >
          {authLoading ? 'URL 발급 중…' : 'Google 연동 시작'}
        </button>
        {authError && (
          <div className="google-test-panel__banner is-error">{authError}</div>
        )}
      </section>

      <section className="google-test-panel__section">
        <h3 className="google-test-panel__section-title">3. 인사이트 조회</h3>
        <div className="google-test-panel__row">
          <label className="google-test-panel__field">
            <span>customerId</span>
            <input
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="예: 123-456-7890"
            />
          </label>
          <label className="google-test-panel__field">
            <span>시작일</span>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
            />
          </label>
          <label className="google-test-panel__field">
            <span>종료일</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="google-test-panel__btn"
            onClick={fetchInsight}
            disabled={insightLoading}
          >
            {insightLoading ? '조회 중…' : '인사이트 조회'}
          </button>
        </div>
        {insightError && (
          <div className="google-test-panel__banner is-error">
            {insightError}
          </div>
        )}

        {insight && (
          <div className="google-test-panel__result">
            <p className="google-test-panel__result-summary">
              총 {insight.totalCount.toLocaleString()}행 · {insight.dateStart} ~{' '}
              {insight.dateEnd}
            </p>

            {insight.rows.length > 0 && (
              <div className="google-test-panel__table-wrap">
                <table className="google-test-panel__table">
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th>캠페인</th>
                      <th>노출</th>
                      <th>클릭</th>
                      <th>비용</th>
                      <th>전환</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insight.rows.map((row, i) => (
                      <tr key={`${row.date}-${row.campaignId}-${i}`}>
                        <td>{row.date}</td>
                        <td className="google-test-panel__cell-label">
                          {row.campaignName || row.campaignId}
                        </td>
                        <td>{row.impressions.toLocaleString()}</td>
                        <td>{row.clicks.toLocaleString()}</td>
                        <td>{won(row.cost)}</td>
                        <td>{row.conversions.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <details className="google-test-panel__raw">
              <summary>원본 응답 JSON</summary>
              <pre>{JSON.stringify(insight, null, 2)}</pre>
            </details>
          </div>
        )}
      </section>
    </div>
  )
}

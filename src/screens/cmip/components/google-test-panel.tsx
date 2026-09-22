import { useGoogleTestPanelViewModel } from '../view-model/use-google-test-panel-view-model'
import type { InsightLevel } from '../view-model/use-google-test-panel-view-model'
import type { GoogleAdGroupInsightRow } from '../client'
import '../styles/google-test-panel.scss'

const won = (v: number): string => `${v.toLocaleString()}원`

/**
 * Google Ads 실 연동 확인 전용 화면 — 실 서비스(channel-insight)는 이미
 * google-insight-client.ts로 진짜 데이터를 쓰고 있고, 이 패널은 그와 무관하게
 * "OAuth·두 인사이트 엔드포인트가 개별적으로 잘 동작하는지"를 원본 응답 그대로
 * 확인하는 진단 도구다. 흐름:
 *   1) brandId로 연동 상태 확인 → 미연동이면
 *   2) "연동 시작"으로 Google 동의 화면을 새 탭에서 열어 승인(→ oauthCallback이
 *      refreshToken 저장) →
 *   3) customerId/loginCustomerId/기간 + 조회 단위(캠페인/adset)를 골라
 *      "인사이트 조회"로 실제 데이터가 들어오는지 확인.
 */
export function GoogleTestPanel() {
  const {
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
    status,
    statusLoading,
    statusError,
    authLoading,
    authError,
    insight,
    insightLoading,
    insightError,
    checkStatus,
    startAuth,
    fetchInsight,
  } = useGoogleTestPanelViewModel()

  return (
    <div className="google-test-panel">
      <p className="google-test-panel__notice">
        실 서비스 화면(인사이트 조회)은 이미 실제 Google Ads 데이터를 씁니다 —
        이 패널은 두 인사이트 엔드포인트(캠페인 단위/adset 단위)와 OAuth 연동이
        개별적으로 잘 동작하는지 원본 응답 그대로 확인하는 진단 도구입니다.
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
              placeholder="예: 10"
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
            <span>조회 단위</span>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as InsightLevel)}
            >
              <option value="campaign">
                캠페인 (getGoogleCampaignInsight)
              </option>
              <option value="adgroup">adset (getGoogleAdsInsight)</option>
            </select>
          </label>
          <label className="google-test-panel__field">
            <span>customerId</span>
            <input
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="예: 2771515076"
            />
          </label>
          <label className="google-test-panel__field">
            <span>loginCustomerId</span>
            <input
              type="text"
              value={loginCustomerId}
              onChange={(e) => setLoginCustomerId(e.target.value)}
              placeholder="예: 7421390798"
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
                      {insight.level === 'adgroup' && <th>adset</th>}
                      <th>노출</th>
                      <th>클릭</th>
                      <th>비용</th>
                      <th>전환</th>
                      <th>CTR</th>
                      <th>CPC</th>
                      <th>CPA</th>
                      <th>CVR</th>
                      <th>CPM</th>
                      <th>Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insight.rows.map((row, i) => (
                      <tr key={`${row.date}-${row.campaignId}-${i}`}>
                        <td>{row.date}</td>
                        <td className="google-test-panel__cell-label">
                          {row.campaignName || row.campaignId}
                        </td>
                        {insight.level === 'adgroup' && (
                          <td className="google-test-panel__cell-label">
                            {(row as GoogleAdGroupInsightRow).adGroupName ||
                              (row as GoogleAdGroupInsightRow).adGroupId}
                          </td>
                        )}
                        <td>{row.impressions.toLocaleString()}</td>
                        <td>{row.clicks.toLocaleString()}</td>
                        <td>{won(row.cost)}</td>
                        <td>{row.conversions.toLocaleString()}</td>
                        <td>{row.ctr.toLocaleString()}%</td>
                        <td>{won(row.cpc)}</td>
                        <td>{won(row.cpa)}</td>
                        <td>{row.cvr.toLocaleString()}%</td>
                        <td>{won(row.cpm)}</td>
                        <td>{row.frequency.toLocaleString()}</td>
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

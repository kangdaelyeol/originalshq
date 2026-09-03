import { useBrandDashboardViewModel } from '../view-model/use-brand-dashboard-view-model'
import '../styles/brand-dashboard.scss'

const GRADE_CLASS: Record<string, string> = {
  A: 'is-success',
  B: 'is-success',
  C: 'is-warning',
  D: 'is-error',
  F: 'is-error',
}
const SEVERITY_LABEL: Record<string, string> = {
  info: '정보',
  warn: '주의',
  critical: '위험',
}
export const BrandDashboard = () => {
  const {
    brandId,
    setBrandId,
    score,
    alerts,
    loading,
    checking,
    error,
    load,
    recheck,
  } = useBrandDashboardViewModel()
  const busy = loading || checking

  return (
    <div className="brand-dashboard">
      <div className="brand-dashboard__field">
        <label htmlFor="dash-brand-id">브랜드 ID</label>
        <input
          id="dash-brand-id"
          type="text"
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          placeholder="예: 123"
          disabled={busy}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
      </div>

      <div className="brand-dashboard__actions">
        <button type="button" onClick={load} disabled={busy || !brandId.trim()}>
          {loading ? '조회하는 중…' : '조회'}
        </button>
        <button
          type="button"
          className="brand-dashboard__ghost"
          onClick={recheck}
          disabled={busy || !brandId.trim()}
        >
          {checking ? '재검사하는 중…' : '이상 징후 재검사'}
        </button>
      </div>

      {error && <div className="brand-dashboard__banner is-error">{error}</div>}

      {score && (
        <div className="brand-dashboard__score">
          <div className="brand-dashboard__score-main">
            <span className="brand-dashboard__score-number">{score.score}</span>
            <span
              className={`brand-dashboard__grade ${GRADE_CLASS[score.grade] ?? ''}`}
            >
              {score.grade}
            </span>
          </div>
          <p className="brand-dashboard__score-label">MORTAR SCORE</p>
          {score.reasons.length > 0 && (
            <ul className="brand-dashboard__reasons">
              {score.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {score && (
        <div className="brand-dashboard__alerts">
          <p className="brand-dashboard__section-title">
            미확인 알림 {alerts.length > 0 ? `(${alerts.length}건)` : ''}
          </p>
          {alerts.length === 0 ? (
            <p className="brand-dashboard__empty">
              현재 미확인 알림이 없습니다.
            </p>
          ) : (
            <ul className="brand-dashboard__alert-list">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className={`brand-dashboard__alert is-${a.severity}`}
                >
                  <div className="brand-dashboard__alert-head">
                    <span className="brand-dashboard__alert-severity">
                      {SEVERITY_LABEL[a.severity] ?? a.severity}
                    </span>
                    <span className="brand-dashboard__alert-title">
                      {a.title}
                    </span>
                  </div>
                  <p className="brand-dashboard__alert-message">{a.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

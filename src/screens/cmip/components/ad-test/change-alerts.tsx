import type { AdTestSegment, DataEvent } from '../../client'
import { formatMD } from '../../utils'
import { won } from '../ad-settings/labels'
import { summarizeChanges, type SettingEvent } from './changes'

type Alert =
  | { kind: 'setting'; date: string; event: SettingEvent }
  | { kind: 'data'; date: string; event: DataEvent }

const pctChange = (before: number, after: number) =>
  before > 0
    ? `${after >= before ? '+' : '−'}${Math.abs(((after - before) / before) * 100).toFixed(0)}%`
    : ''

/**
 * 알림 — 대상의 설정이 바뀐 날(광고 설정 기록)과 성과에서 찾은 변화(광고비
 * 수준이 바뀐 날, 집행이 멈춘 날). 그 날이 구간 안쪽이면 "이 날부터 새 구간"으로
 * 바로 나눌 수 있고, 이미 구간이 그 날 시작하면 경계와 맞는다고 표시한다.
 */
export function ChangeAlerts({
  settingEvents,
  dataEvents,
  segments,
  from,
  to,
  onSplit,
  onAddBefore,
}: {
  settingEvents: readonly SettingEvent[]
  dataEvents: readonly DataEvent[]
  segments: readonly AdTestSegment[]
  /** 그래프 범위 — 이 밖의 알림은 접어 둔다. */
  from: string
  to: string
  onSplit: (date: string, note: string) => void
  /** 첫 구간보다 앞선 알림 — 그 날부터 첫 구간 전날까지 새 구간. */
  onAddBefore: (date: string, note: string) => void
}) {
  const alerts: Alert[] = [
    ...settingEvents.map((event) => ({
      kind: 'setting' as const,
      date: event.date,
      event,
    })),
    ...dataEvents.map((event) => ({
      kind: 'data' as const,
      date: event.date,
      event,
    })),
  ]
    .filter((a) => a.date >= from && a.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
  const outside = settingEvents.filter(
    (e) => e.date < from || e.date > to,
  ).length

  if (alerts.length === 0) {
    return (
      <p className="ad-test__empty">
        이 범위에는 설정 변경이나 눈에 띄는 성과 변화가 없습니다.
        {outside > 0 && ` (범위 밖 설정 변경 ${outside}건)`}
      </p>
    )
  }

  return (
    <ul className="ad-test-alerts">
      {alerts.map((alert) => {
        const boundary = segments.some((s) => s.start === alert.date)
        const inside = segments.some(
          (s) => s.start < alert.date && alert.date <= s.end,
        )
        const note =
          alert.kind === 'setting'
            ? summarizeChanges(alert.event)
            : alert.event.kind === 'paused'
              ? '집행 멈춤'
              : alert.event.kind === 'resumed'
                ? '집행 다시 시작'
                : `광고비 수준 ${pctChange(alert.event.before, alert.event.after)}`
        return (
          <li
            key={`${alert.kind}:${alert.date}:${alert.kind === 'data' ? alert.event.kind : ''}`}
            className={`ad-test-alert is-${alert.kind}`}
          >
            <div className="ad-test-alert__head">
              <b>{formatMD(alert.date)}</b>
              {alert.kind === 'setting' ? (
                <span className="ad-badge is-scheduled">
                  설정 {alert.event.first ? '시작' : '변경'} ·{' '}
                  {alert.event.sources
                    .map((s) => (s === 'campaign' ? '캠페인' : '광고셋'))
                    .join('·')}
                </span>
              ) : (
                <span className="ad-badge is-missing">성과 변화</span>
              )}
              {boundary ? (
                <span className="ad-test-alert__ok">구간 경계와 맞음</span>
              ) : inside ? (
                <button
                  type="button"
                  className="ad-button is-small is-primary"
                  onClick={() => onSplit(alert.date, note)}
                >
                  이 날부터 새 구간
                </button>
              ) : alert.date < (segments[0]?.start ?? '') ? (
                <button
                  type="button"
                  className="ad-button is-small"
                  onClick={() => onAddBefore(alert.date, note)}
                >
                  여기서부터 구간 추가
                </button>
              ) : (
                <span className="ad-test-alert__ok is-out">구간 밖</span>
              )}
            </div>
            {alert.kind === 'setting' ? (
              <>
                <ul className="ad-test-alert__changes">
                  {alert.event.changes.map((c) => (
                    <li key={c.label}>
                      <span>{c.label}</span> {c.before} <em>→</em>{' '}
                      <b>{c.after}</b>
                    </li>
                  ))}
                </ul>
                {alert.event.memo && (
                  <p className="ad-test-alert__memo">{alert.event.memo}</p>
                )}
              </>
            ) : (
              <p className="ad-test-alert__memo">
                {alert.event.kind === 'paused'
                  ? `${alert.event.pausedDays}일 동안 광고비가 0원이었습니다 (직전 일평균 ${won(alert.event.before)}). 설정에 적지 않은 중단이라면 구간을 나눠 보세요.`
                  : alert.event.kind === 'resumed'
                    ? `집행이 다시 시작됐습니다 (이후 일평균 ${won(alert.event.after)}).`
                    : `앞 7일 일평균 ${won(alert.event.before)} → 뒤 7일 ${won(alert.event.after)} (${pctChange(alert.event.before, alert.event.after)}). 예산·입찰을 바꿨는데 설정에 안 적었다면 광고 설정에도 남겨 두세요.`}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

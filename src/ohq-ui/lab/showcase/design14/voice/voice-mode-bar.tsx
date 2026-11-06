import { cx } from '../../../../lib/cx'

export interface VoiceBarTab {
  key: string
  label: string
}

interface VoiceModeBarProps {
  /** 맨 앞 주황 점 옆 글(영상: VOICE MODE) */
  label?: string
  tabs: readonly VoiceBarTab[]
  /** 고른 탭 — 주황 테두리 알약 */
  active: string
  onSelect?: (key: string) => void
  /** ■ ESC 단추 — 없으면 단추를 눌러도 아무 일 없다 */
  onEsc?: () => void
  escLabel?: string
  className?: string
}

/**
 * 음성 모드 맨 위 알약 막대 — "● VOICE MODE | DEALS | 6AM BRIEF | ■ ESC"(F289~F680 내내 같다).
 * 가로 27.8em·높이 3.6em, 탭 알약은 높이 2.35em에 5px 사이. 글씨는 고정폭 대문자(글자 폭이 고르다 —
 * VOICE MODE·DEALS·6AM BRIEF·ESC 모두 글자당 5.3~5.6px). 영상에선 잘린 자리(F288 → F289)에 이미 떠
 * 있어 나타나는 움직임은 볼 수 없다 — 붙을 때 0.2초 내려오며 나타나는 건 고른 값.
 */
export function VoiceModeBar({
  label = 'VOICE MODE',
  tabs,
  active,
  onSelect,
  onEsc,
  escLabel = 'ESC',
  className,
}: VoiceModeBarProps) {
  return (
    <div className={cx('d14v-bar', className)} role="toolbar" aria-label={label} lang="en">
      <span className="d14v-bar__mode">
        <span className="d14v-bar__dot" aria-hidden />
        {label}
      </span>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={cx('d14v-bar__tab', tab.key === active && 'is-active')}
          aria-pressed={tab.key === active}
          onClick={() => onSelect?.(tab.key)}
        >
          {tab.label}
        </button>
      ))}
      <button type="button" className="d14v-bar__esc" onClick={onEsc}>
        <span className="d14v-bar__square" aria-hidden />
        {escLabel}
      </button>
    </div>
  )
}

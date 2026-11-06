import { cx } from '../../../lib/cx'

interface ToggleSwitchProps {
  checked: boolean
  onChange?: (next: boolean) => void
  label: string
  /** 글자를 숨기고 스위치만 */
  bare?: boolean
}

/** 켜고 끄기 — 21×11 초록 길(켜짐)·흰 손잡이 9px. 손잡이는 0.2초에 미끄러진다. */
export function ToggleSwitch({ checked, onChange, label, bare }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={bare ? label : undefined}
      className={cx('d16-switch', checked && 'is-on')}
      onClick={() => onChange?.(!checked)}
    >
      <span className="d16-switch__track" aria-hidden>
        <span className="d16-switch__knob" />
      </span>
    </button>
  )
}

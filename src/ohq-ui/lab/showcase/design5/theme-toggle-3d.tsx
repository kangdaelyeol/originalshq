import { cx } from '../../../lib/cx'
import { ToggleKnob, ToggleSlot, ToggleSurface } from './toggle-3d-parts'

interface ThemeToggle3DProps {
  /** 켜짐 = 어두움 */
  checked: boolean
  onChange: (next: boolean) => void
  /** 읽어 줄 이름 */
  label?: string
  className?: string
}

/**
 * 3D 다크/라이트 토글(Design 5) — 판에 판 홈 속을 원기둥 손잡이가 미끄러진다.
 * - 누르면 손잡이와 글자띠가 함께 반대쪽 끝으로 가고(1.05초, 끝이 길게 늘어지는 ease-out),
 *   0.5초에 새 글자(DARK 주황 / LIGHT 파랑)에 불이 들어오며, 장면 빛이 1초 동안 바뀐다.
 * - 진짜 스위치: role="switch" + aria-checked, 키보드 Space·Enter(버튼 기본 동작).
 * 누르는 곳은 슬롯과 손잡이뿐이다(바닥판은 눌리지 않는다).
 */
export function ThemeToggle3D({ checked, onChange, label = '어두운 화면', className }: ThemeToggle3DProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cx('d5-toggle', checked && 'is-dark', className)}
      onClick={() => onChange(!checked)}
    >
      <span className="d5-world" aria-hidden>
        <ToggleSurface />
        <ToggleSlot />
        <ToggleKnob />
      </span>
    </button>
  )
}

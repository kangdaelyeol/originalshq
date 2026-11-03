import { cx } from '../../../lib/cx'

interface LabelPillProps {
  text: string
  /** 보일 때만 0.12초에 걸쳐 나타난다(올리지 않으면 투명) */
  visible?: boolean
  className?: string
}

/**
 * 위성 버튼 위·아래에 뜨는 이름표(Design 9) — 볼록한 작은 알약에 자간 넓힌 굵은 대문자.
 * 버튼이 이미 이름을 갖고 있어서 화면 읽기에서는 숨긴다.
 */
export function LabelPill({ text, visible = true, className }: LabelPillProps) {
  return (
    <span className={cx('d9-label', visible && 'is-visible', className)} aria-hidden>
      <span className="d9-label__text">{text}</span>
    </span>
  )
}

import { useCallback, useRef, type CSSProperties } from 'react'
import { cx } from '../../../lib/cx'
import { scrambleFrame } from './scramble-timeline'
import { useLoopClock } from './use-loop-clock'

interface TextScrambleProps {
  /** 맞춰질 단어 — 글자마다 같은 폭 칸에 놓인다 */
  text: string
  className?: string
}

/**
 * 03 텍스트 스크램블 — 왼쪽부터 글자가 무작위 문자로 흩어졌다가, 밑줄 막대가 차오르는 만큼
 * 왼쪽부터 한 글자씩 제 글자(초록)로 맞춰진다. 글자는 칸 폭이 고정이라 바뀌어도 자리가 흔들리지 않는다.
 * 글자는 data-ch 속성으로만 바꿔(React가 그린 글자 노드는 건드리지 않는다) CSS가 ::before로 보여 준다.
 */
export function TextScramble({ text, className }: TextScrambleProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  const draw = useCallback(
    (t: number) => {
      const root = rootRef.current
      if (!root) return
      const frame = scrambleFrame(text, t)
      root.querySelectorAll<HTMLElement>('.d10-scramble__char').forEach((el, i) => {
        el.dataset.ch = frame.chars[i]
        el.classList.toggle('is-settled', frame.settled[i])
      })
      root.style.setProperty('--d10-progress', frame.progress.toFixed(4))
    },
    [text],
  )
  useLoopClock(rootRef, draw)

  const letters = [...text]
  return (
    <div
      ref={rootRef}
      className={cx('d10-scramble', className)}
      style={{ '--d10-cells': letters.length } as CSSProperties}
      role="img"
      aria-label={text}
    >
      <span className="d10-scramble__word">
        {letters.map((ch, i) => (
          <span key={i} className="d10-scramble__char is-settled" data-ch={ch} />
        ))}
      </span>
      <span className="d10-scramble__bar" />
    </div>
  )
}

import { useCallback, useRef, type CSSProperties } from 'react'
import { cx } from '../../../lib/cx'
import { useD13Frame } from './d13-clock'
import { VERDICT_SLIDE, countAt, eventIndexAt, formatInt } from './d13-timeline'
import { D13_JUDGED, D13_VERDICTS, type Verdict } from './design13-data'

interface VerdictListProps {
  /** 한 바퀴 판정 — 사건마다 다음 줄이 맨 위에 들어온다 */
  verdicts?: readonly Verdict[]
  /** 보이는 줄 수 */
  rows?: number
  title?: string
  /** 오른쪽 위 "180 judged" 오르기 — 없으면 숨긴다 */
  judged?: { from: number; to: number; duration: number } | null
  className?: string
}

const mod = (a: number, n: number) => ((a % n) + n) % n
/** 줄 간격(em, 1em = 영상 10px) — 점 가운데 551.5 → 581 → 610.5 → 639.5 */
const VERDICT_PITCH = 2.94

/**
 * LIVE VERDICTS — 사건마다(0.2975초) 새 판정이 맨 위에 들어오고 나머지는 한 칸(29.4px) 내려간다(0.07초).
 * 새 줄은 종류 색 바탕(choice 분홍·score 보라·noul 청록)이 켜졌다가 다음 줄이 올 때까지 옅어진다.
 * 줄은 rows+1개를 한 번 그려 두고 글만 바꾼다 — 사건이 바뀔 때만 DOM을 고친다.
 */
export function VerdictList({
  verdicts = D13_VERDICTS,
  rows = 4,
  title = 'LIVE VERDICTS',
  judged = D13_JUDGED,
  className,
}: VerdictListProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const judgedRef = useRef<HTMLSpanElement>(null)
  const last = useRef({ k: Number.NaN, judged: '' })

  const draw = useCallback(
    (t: number, still: boolean) => {
      const list = listRef.current
      if (!list || !verdicts.length) return
      if (judged && judgedRef.current) {
        const text = `${formatInt(countAt(t, judged.from, judged.to, judged.duration))} judged`
        if (last.current.judged !== text) {
          last.current.judged = text
          judgedRef.current.textContent = text
        }
      }
      const k = eventIndexAt(t)
      const prev = last.current.k
      if (k === prev) return
      last.current.k = k
      const items = list.children
      for (let i = 0; i < items.length; i++) {
        const v = verdicts[mod(k - i, verdicts.length)]
        const li = items[i] as HTMLElement
        li.dataset.kind = v.kind
        // 줄 안: 0 바탕 빛 · 1 점 · 2 종류 · 3 글
        const kind = li.children[2]
        const text = li.children[3]
        if (kind) kind.textContent = v.kind
        if (text) text.textContent = v.text
      }
      const top = items[0] as HTMLElement | undefined
      // 한 칸씩 들어올 때만 움직인다(처음 그릴 때·멀리 건너뛸 때·움직임 줄이기는 그냥 놓는다)
      if (still || k !== prev + 1 || k < 0) return
      list.animate([{ transform: `translateY(-${VERDICT_PITCH}em)` }, { transform: 'none' }], {
        duration: VERDICT_SLIDE * 1000,
        easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
      })
      top
        ?.querySelector('.d13-verdict__glow')
        ?.animate([{ opacity: 1 }, { opacity: 0.62, offset: 0.25 }, { opacity: 0 }], {
          duration: 340,
          easing: 'linear',
          fill: 'forwards',
        })
    },
    [verdicts, judged],
  )
  useD13Frame(rootRef, draw)

  return (
    <div ref={rootRef} className={cx('d13-panel', 'd13-verdicts', className)}>
      <div className="d13-panel__head">
        <h3 className="d13-panel__title">{title}</h3>
        {judged && (
          <span ref={judgedRef} className="d13-verdicts__judged">
            {formatInt(judged.from)} judged
          </span>
        )}
      </div>
      <div className="d13-verdicts__viewport" style={{ '--d13-rows': rows } as CSSProperties}>
        <ol ref={listRef} className="d13-verdicts__list">
          {Array.from({ length: rows + 1 }, (_, i) => (
            <li key={i} className="d13-verdict">
              <span className="d13-verdict__glow" aria-hidden />
              <i className="d13-verdict__dot" aria-hidden />
              <span className="d13-verdict__kind" />
              <span className="d13-verdict__text" />
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

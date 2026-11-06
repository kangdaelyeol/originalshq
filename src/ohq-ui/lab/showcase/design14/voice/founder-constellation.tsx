import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { cx } from '../../../../lib/cx'
import { useReducedMotion } from '../../../../water/hooks'
import { watchOnScreen } from './use-voice-script'
import { FOUNDER_CENTER, FOUNDER_TOPICS, type FounderTopic } from './voice-script'

interface FounderCenter {
  /** 원 안 글(영상: YOU) */
  node: string
  /** 원 아래 이름(영상: YOU) */
  title: string
  subtitle?: string
}

interface FounderConstellationProps {
  topics?: readonly FounderTopic[]
  /** 펼침 — false면 주제·줄은 바로 사라지고 YOU 원만 0.1초에 흐려진다(F346 → F347). 기본 true */
  open?: boolean
  /** YOU 원과 그 아래 이름. false면 그리지 않는다(지도가 이미 그 원을 그릴 때) */
  center?: FounderCenter | false
  /** YOU 오른쪽 위 금색 숫자 — 기본: waiting 주제 수(영상 3), 0이면 없다 */
  badge?: number
  className?: string
}

// 펼칠 때 주제가 YOU 자리에서 제자리까지 x로만 미끄러진다(y는 처음부터 제자리 — F636 INVOICE 점 x
// −1.5 → −58 → −75 → −83 → −87px). 남은 거리가 프레임마다 0.33~0.6배로 준다 → τ 64ms 지수 감쇠를
// 0.32초 linear()로 옮겼다. 처음 0.1초에 같이 나타난다.
const SPREAD_MS = 320
const SPREAD_EASE = 'linear(0, 0.39 10%, 0.63 20%, 0.78 30%, 0.86 40%, 0.92 50%, 0.95 60%, 0.97 70%, 0.99 85%, 1)'

/**
 * 창업자(YOU) 별자리 — 흰 YOU 원 둘레에 창업자가 정할 일(주제)이 점·이름·상태 줄로 놓이고, YOU에서 줄이
 * 뻗는다. 자리는 영상에서 잰 em(1em = 영상 10px), 요소 자체는 크기 0인 기준점이라 부모가 YOU 원 가운데에
 * 놓는다. waiting 주제는 주황 점 + 금색 상태 줄 + 위에서 흔들리는 ▲, urgent는 점 둘레 붉은 고리가 숨 쉰다.
 * 이름 칸은 바탕색으로 칠해져 있어 겹치면 앞 주제가 뒤 주제를 가린다(영상의 "QUOTE FOLLOW-UP …TURE HABIT").
 */
export function FounderConstellation({
  topics = FOUNDER_TOPICS,
  open = true,
  center = FOUNDER_CENTER,
  badge,
  className,
}: FounderConstellationProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const count = badge ?? topics.filter((t) => t.tone === 'waiting').length

  // 펼칠 때(처음 붙을 때 포함) 주제와 줄을 YOU 자리에서 펼친다 — 그리기 전에 걸어야 제자리가 한 번 비치지 않는다
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !open || reduced || typeof root.animate !== 'function') return
    const anims: Animation[] = []
    const spread = { duration: SPREAD_MS, easing: SPREAD_EASE }
    const fade = { duration: 100, easing: 'linear' }
    const appear = [{ opacity: 0 }, { opacity: 1 }]
    root.querySelectorAll<HTMLElement>('.d14v-topic').forEach((el) => {
      const x = Number(el.dataset.x ?? 0)
      anims.push(el.animate([{ translate: `${-x}em 0` }, { translate: '0 0' }], spread))
      anims.push(el.animate(appear, fade))
    })
    // 줄은 YOU(0,0)에서 x로만 늘어난다 — 점이 x로만 미끄러지는 것과 같은 모양
    root.querySelectorAll<SVGLineElement>('.d14v-founder__line').forEach((el) => {
      anims.push(el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], spread))
    })
    const you = root.querySelector('.d14v-founder__center')
    if (you) anims.push(you.animate(appear, fade))
    return () => anims.forEach((a) => a.cancel())
  }, [open, reduced, topics])

  // 화면 밖이면 ▲ 흔들림·고리 숨쉬기를 멈춘다 — 기준점은 크기가 0이라 YOU 둘레 그늘(16em)로 본다
  useEffect(() => {
    const root = rootRef.current
    const area = root?.querySelector('.d14v-founder__shade')
    if (!root || !area) return
    return watchOnScreen(area, (v) => root.classList.toggle('is-offscreen', !v))
  }, [])

  return (
    <div ref={rootRef} className={cx('d14v-founder', !open && 'is-closed', className)} lang="en">
      <svg className="d14v-founder__lines" viewBox="0 0 10 10" aria-hidden>
        {topics.map((t) => (
          <line key={t.label} className="d14v-founder__line" x1="0" y1="0" x2={t.x * 10} y2={t.y * 10} />
        ))}
      </svg>
      <div className="d14v-founder__shade" aria-hidden />
      <ul className="d14v-founder__topics">
        {topics.map((t, i) => (
          <li
            key={t.label}
            className={cx('d14v-topic', `d14v-topic--${t.tone ?? 'idle'}`, t.x < 0 ? 'is-left' : 'is-right')}
            data-x={t.x}
            style={
              {
                left: `${t.x}em`,
                top: `${t.y}em`,
                zIndex: topics.length - i,
                '--d14v-dot': `${t.r ?? 0.45}em`,
              } as CSSProperties
            }
          >
            {t.urgent && <span className="d14v-topic__ring" aria-hidden />}
            <span className="d14v-topic__dot" aria-hidden />
            {t.tone === 'waiting' && <span className="d14v-topic__mark" aria-hidden />}
            <span className="d14v-topic__text">
              <span className="d14v-topic__label">{t.label}</span>
              {t.status && <span className="d14v-topic__status">{t.status}</span>}
            </span>
          </li>
        ))}
      </ul>
      {center && (
        <div className="d14v-founder__center">
          <span className="d14v-founder__node">
            <span className="d14v-founder__node-text">{center.node}</span>
            {count > 0 && (
              <span className="d14v-founder__badge">
                <span className="d14v-founder__badge-text">{count}</span>
              </span>
            )}
          </span>
          <span className="d14v-founder__title">{center.title}</span>
          {center.subtitle && <span className="d14v-founder__subtitle">{center.subtitle}</span>}
        </div>
      )}
    </div>
  )
}

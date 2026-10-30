import { flushSync } from 'react-dom'

const TRANSITIONING = 'glass_transitioning'

// 지금 돌고 있는 전환 — 전환 중에 또 바꾸면 앞의 것은 건너뛰어지므로, 마지막
// 것이 끝날 때만 표시를 뗀다.
let current: ViewTransition | null = null

/**
 * 화면(탭)을 바꾼다 — 지원하는 브라우저는 새 화면이 흐릿하게 나타나며
 * 선명해지고, 헤더(GlassHeader)는 그대로 남는다(styles/_page.scss).
 * 지원하지 않거나 움직임 줄이기를 켠 경우 바로 바꾼다.
 *
 * update는 React 상태를 바꾸는 함수 — 새 화면을 그 자리에서 그려야 해서
 * flushSync로 바로 반영한다.
 */
export const startGlassTransition = (update: () => void) => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduced) {
    update()
    return
  }
  const root = document.documentElement
  root.classList.add(TRANSITIONING)
  const transition = document.startViewTransition(() => flushSync(update))
  current = transition
  transition.finished.finally(() => {
    if (current !== transition) return
    current = null
    root.classList.remove(TRANSITIONING)
  })
}

import { D16_T, DRAG_THRESHOLD, EASE, prefersReducedMotion } from './d16-motion'
import type { OrderStatus } from './design16-data'

export interface BoardDragHooks {
  /** 유령을 띄울 층 — 창 안에 절대 위치로 깔린 요소 */
  layer: HTMLElement
  /** 영상 코드의 setHot — 손가락 아래 레인(없으면 null) */
  setHot: (col: OrderStatus | null) => void
  /** 끌기 시작·끝 — 원래 카드를 흐리게(id) / 되돌리기(null) */
  setLifted: (id: string | null) => void
  /** 다른 레인에 놓았다 — 칸반이 자리를 바꾸고(FLIP) 진짜 카드를 ghostHold 뒤에 드러낸다 */
  drop: (id: string, from: OrderStatus, to: OrderStatus) => void
}

/**
 * 카드 끌기 — 영상 코드(src/pages/orders.tsx moveH)를 GSAP 없이 그대로 옮겼다.
 *   gsap.fromTo(ghost, {scale:1, rotation:0}, {scale:1.04, rotation:-2, duration:0.25, ease:'back.out(2)'})
 *     → ghost.animate([{scale:1, rotate:0}, {scale:1.04, rotate:-2deg}], 250ms, back.out(2)을 펴 둔 linear())
 *   gsap.set(ghost, {x: dx, y: dy}) → ghost.style.translate (따로 쓰는 translate라 WAAPI의 scale·rotate와 겹친다)
 *   .lane → .d16-lane · 'ocard--ghost' → 'd16-ocard--ghost'
 * 놓은 뒤(영상 F160.5~F170): 유령은 0.19초 그 자리에 있다가 0.07초에 사라지고, 나머지 카드는 expo.out 0.5초로 자리를 바꾼다.
 */
export function startCardDrag(down: PointerEvent, card: HTMLElement, hooks: BoardDragHooks) {
  if (down.button !== 0) return
  const x0 = down.clientX
  const y0 = down.clientY
  let on = false
  let ghost: HTMLElement | null = null
  let over: OrderStatus | null = null
  const id = card.dataset.id ?? ''
  const from = (card.closest<HTMLElement>('.d16-lane')?.dataset.col as OrderStatus | undefined) ?? null

  const moveH = (ev: PointerEvent) => {
    if (ev.pointerId !== down.pointerId) return
    const dx = ev.clientX - x0,
      dy = ev.clientY - y0
    if (!on) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      on = true
      ghost = card.cloneNode(true) as HTMLElement
      ghost.classList.add('d16-ocard--ghost')
      ghost.classList.remove('is-hover')
      const r = card.getBoundingClientRect()
      const l = hooks.layer.getBoundingClientRect()
      ghost.style.left = `${r.left - l.left}px`
      ghost.style.top = `${r.top - l.top}px`
      ghost.style.width = `${r.width}px`
      hooks.layer.append(ghost)
      hooks.setLifted(id)
      ghost.animate(
        [
          { scale: 1, rotate: '0deg' },
          { scale: D16_T.ghostScale, rotate: `${D16_T.ghostRotate}deg` },
        ],
        { duration: prefersReducedMotion() ? 0 : D16_T.ghostLift * 1000, easing: EASE.backOut2, fill: 'forwards' },
      )
    }
    if (!ghost) return
    ghost.style.translate = `${dx}px ${dy}px`
    const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('.d16-lane')
    const col = (under?.dataset.col as OrderStatus | undefined) ?? null
    if (col !== over) {
      over = col
      hooks.setHot(col)
    }
  }

  const stop = () => {
    window.removeEventListener('pointermove', moveH)
    window.removeEventListener('pointerup', upH)
    window.removeEventListener('pointercancel', cancelH)
  }

  const settleBack = (g: HTMLElement) => {
    // 같은 레인이나 바깥에 놓으면 제자리로 돌아간다(영상에 없는 경우 — back.out(2) 0.3초)
    const back = g.animate(
      [
        { translate: g.style.translate || '0 0', scale: D16_T.ghostScale, rotate: `${D16_T.ghostRotate}deg` },
        { translate: '0 0', scale: 1, rotate: '0deg' },
      ],
      { duration: prefersReducedMotion() ? 0 : 300, easing: EASE.backOut2, fill: 'forwards' },
    )
    back.finished.then(
      () => {
        g.remove()
        hooks.setLifted(null)
      },
      () => g.remove(),
    )
  }

  const upH = (ev: PointerEvent) => {
    if (ev.pointerId !== down.pointerId) return
    stop()
    if (!on || !ghost) return
    const g = ghost
    const to = over
    hooks.setHot(null)
    if (!to || !from || to === from) {
      settleBack(g)
      return
    }
    hooks.drop(id, from, to)
    const reduced = prefersReducedMotion()
    const fade = g.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: reduced ? 0 : D16_T.ghostFade * 1000,
      delay: reduced ? 0 : D16_T.ghostHold * 1000,
      fill: 'forwards',
    })
    fade.finished.then(
      () => g.remove(),
      () => g.remove(),
    )
  }

  const cancelH = (ev: PointerEvent) => {
    if (ev.pointerId !== down.pointerId) return
    stop()
    hooks.setHot(null)
    if (ghost) settleBack(ghost)
  }

  window.addEventListener('pointermove', moveH)
  window.addEventListener('pointerup', upH)
  window.addEventListener('pointercancel', cancelH)
}

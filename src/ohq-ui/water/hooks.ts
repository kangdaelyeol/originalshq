import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { WaterFxEngine } from './fx'
import { WaterIndicatorEngine, type IndicatorPose } from './indicator'
import type { SpringSpec } from './motion'
import { WaterRipple } from './ripple'

/**
 * 표시 알약 엔진을 요소에 붙였다 뗀다 — ref를 알약 요소에 달고, 고른 값이 바뀔 때 engine.current.set()을
 * 부른다(첫 set은 바로 놓인다). 엔진이 style을 직접 고치니 React는 다시 그리지 않는다.
 * squash는 옆 찌그러짐 배율(기본 1 = D7), onDraw는 그릴 때마다(같은 프레임) 불린다 — 바뀌어도 엔진을 다시
 * 만들지 않는다. 결과는 구조 분해해서 쓴다(`const { ref: xRef, engine: xEngine } = …` — React Compiler 규칙
 * react-hooks/refs가 렌더 중 `x.ref`·`x.engine` 읽기를 막는다).
 */
export function useWaterIndicator<T extends HTMLElement = HTMLDivElement>(
  opts: { axis?: 'x' | 'y'; spring?: SpringSpec; squash?: number; onDraw?: (pose: IndicatorPose) => void } = {},
) {
  const ref = useRef<T>(null)
  const engine = useRef<WaterIndicatorEngine | null>(null)
  const onDraw = useRef(opts.onDraw)
  const { axis, spring, squash } = opts
  useLayoutEffect(() => {
    onDraw.current = opts.onDraw
  })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const e = new WaterIndicatorEngine(el, { axis, spring, squash, onDraw: (pose) => onDraw.current?.(pose) })
    engine.current = e
    return () => {
      e.destroy()
      engine.current = null
    }
  }, [axis, spring, squash])
  return { ref, engine }
}

/** 물방울·물결 층 — ref를 부품 위에 겹친 <svg>(overflow visible)에 단다 */
export function useWaterFx() {
  const ref = useRef<SVGSVGElement>(null)
  const engine = useRef<WaterFxEngine | null>(null)
  useLayoutEffect(() => {
    const svg = ref.current
    if (!svg) return
    const e = new WaterFxEngine(svg)
    engine.current = e
    return () => {
      e.destroy()
      engine.current = null
    }
  }, [])
  return { ref, engine }
}

/** 누르자마자 퍼지는 물결 층 — ref를 부품 위에 겹친 <svg>(overflow visible)에 달고 engine.current.play() */
export function useWaterRipple() {
  const ref = useRef<SVGSVGElement>(null)
  const engine = useRef<WaterRipple | null>(null)
  useLayoutEffect(() => {
    const svg = ref.current
    if (!svg) return
    const e = new WaterRipple(svg)
    engine.current = e
    return () => {
      e.destroy()
      engine.current = null
    }
  }, [])
  return { ref, engine }
}

/** 요소의 CSS zoom 배율(조상까지 곱한 값, transform은 빼고) — currentCSSZoom이 없으면 조상 zoom을 곱한다 */
function cssZoom(el: Element): number {
  const own = (el as Element & { currentCSSZoom?: number }).currentCSSZoom
  if (typeof own === 'number' && own > 0) return own
  let zoom = 1
  for (let a: Element | null = el; a; a = a.parentElement) zoom *= parseFloat(getComputedStyle(a).zoom) || 1
  return zoom
}

/**
 * 장치 화소 한 칸(--w-dpx)을 실제 배율에 맞춘다 — ref를 단 요소에 `1 / (화면 배율 × 조상 CSS zoom)` px를 건다.
 * CSS만으로는 배율 2 → 0.5px · 1.49 이하 → 1px밖에 몰라서, 조상에 zoom을 걸거나 배율이 1.25·1.5면 유리 테두리
 * 화소 맞춤(w-glass)이 어긋난다. 다시 재는 때는 크기가 바뀔 때(ResizeObserver 둘 — CSS 크기·장치 화소 크기:
 * 조상 zoom이 바뀌면 둘 중 하나는 꼭 바뀐다)와 화면 배율이 바뀔 때(matchMedia)뿐이고, 값이 같으면 쓰지 않는다 —
 * 가만히 있을 때는 아무 일도 하지 않는다. WaterStage가 쓰고, 무대 밖(포털 등)은 그 뿌리 요소에 따로 단다.
 */
export function useWaterDpx<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let last = ''
    const update = () => {
      const dpx = `${+(1 / ((window.devicePixelRatio || 1) * cssZoom(el))).toFixed(4)}px`
      if (dpx === last) return
      last = dpx
      el.style.setProperty('--w-dpx', dpx)
    }
    update()
    const css = new ResizeObserver(update)
    css.observe(el)
    const device = new ResizeObserver(update)
    try {
      device.observe(el, { box: 'device-pixel-content-box' })
    } catch {
      // 장치 화소 상자를 못 보는 브라우저(Safari) — CSS 크기·화면 배율로만 안다
    }
    // 화면 배율(창을 다른 모니터로 옮기기·브라우저 확대) — 지금 배율이 아니게 되면 한 번 불리고 새 배율로 다시 건다
    let mq: MediaQueryList | null = null
    const onResolution = () => {
      update()
      listen()
    }
    const listen = () => {
      mq?.removeEventListener('change', onResolution)
      mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
      mq.addEventListener('change', onResolution)
    }
    listen()
    return () => {
      css.disconnect()
      device.disconnect()
      mq?.removeEventListener('change', onResolution)
      el.style.removeProperty('--w-dpx')
    }
  }, [])
  return ref
}

const REDUCE = '(prefers-reduced-motion: reduce)'
const subscribe = (cb: () => void) => {
  if (typeof matchMedia !== 'function') return () => {}
  const mq = matchMedia(REDUCE)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const snapshot = () => typeof matchMedia === 'function' && matchMedia(REDUCE).matches

/** "동작 줄이기"가 켜져 있으면 true — 물방울·출렁임을 끄고 자리만 옮긴다 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}

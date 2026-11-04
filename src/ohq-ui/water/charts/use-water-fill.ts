import { useLayoutEffect, useRef } from 'react'
import { useReducedMotion } from '../hooks'
import { WATER_REVEAL, WATER_SPRING, clamp01, round3 } from '../motion'
import { runSpring, type SpringRun } from '../spring-run'

/**
 * 막대 끝 자리(홈 길이 비율 0~1) → 채움 위치. 채움은 홈의 두 배 길이 알약이고, 왼쪽은 홈 밖으로 숨어 오른쪽 끝만
 * 보인다 — 길이를 바꾸지 않고(레이아웃 없음) transform만 옮기며, 끝의 둥근 모양도 찌그러지지 않는다.
 * 100% = 채움 길이(홈의 두 배)라 끝 자리 f는 f·50% − 100%.
 */
export const fillTransform = (tip: number): string => `translateX(${round3(tip * 50 - 100)}%)`

/**
 * 막대 채움을 뻗게 한다 — 처음 나타날 때는 0에서, 값이 바뀌면 지금 자리에서 새 자리로 D7 extend 스프링
 * (ζ0.5·ω34 — 알약 오른끝이 16% 넘쳤다 돌아온다, F76 692 → F80 651 → F84 674). 쉬던 막대는 index ×
 * WATER_REVEAL.stagger(21ms — D7 아이콘이 왼쪽부터 차례로) 늦게 출발하고, 움직이는 도중 값이 바뀌면 바로 지금
 * 자리·빠르기에서 이어 간다. 키프레임은 WAAPI로 넘겨 합성 단계가 그린다(rAF 없음). 동작 줄이기면 바로 놓는다.
 * ref는 채움 요소에 단다.
 */
export function useWaterFill<T extends HTMLElement = HTMLSpanElement>(tip: number, index = 0) {
  const ref = useRef<T>(null)
  const run = useRef<SpringRun | null>(null)
  const shown = useRef(0)
  const reduced = useReducedMotion()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const target = clamp01(Number.isFinite(tip) ? tip : 0)
    const moving = run.current?.busy() ? run.current : null
    const cur = moving ? moving.sample() : { x: shown.current, v: 0 }
    run.current?.cancel()
    run.current = null
    shown.current = target
    el.style.transform = fillTransform(target)
    if (reduced || (Math.abs(cur.x - target) < 1e-4 && Math.abs(cur.v) < 1e-3)) return
    run.current = runSpring(el, {
      from: cur.x,
      to: target,
      v0: cur.v,
      spec: WATER_SPRING.extend,
      // 열두째부터는 같이(긴 목록에서 마지막 막대가 0.25초 안에 출발 — styles/_surfaces.scss .water-reveal과 같은 상한)
      delay: moving ? 0 : Math.min(index, 12) * WATER_REVEAL.stagger,
      frame: (x) => ({ transform: fillTransform(x) }),
    })
  }, [tip, index, reduced])

  // 떼어질 때 멈춘다 — 지금 자리를 남겨 두어, 개발 모드(StrictMode)에서 곧바로 다시 붙을 때 처음부터 다시 뻗는다
  useLayoutEffect(
    () => () => {
      if (run.current) shown.current = run.current.sample().x
      run.current?.cancel()
      run.current = null
    },
    [],
  )

  return ref
}

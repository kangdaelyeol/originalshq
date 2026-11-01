import { useEffect, useState } from 'react'

const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/**
 * key가 바뀌면 그때 보이던 값에서 새 값으로 duration 동안 넘어가는 값을
 * 돌려준다(가운데는 mix로 섞는다). 넘어가는 중이 아니면 늘 지금 값 그대로.
 * 신호 그래프가 기간·필터를 바꿔 새 데이터가 오면 노드가 제자리로 미끄러지게
 * 쓴다(signal-graph.tsx). 움직임 줄이기 설정이면 바로 바꾼다.
 */
export const useTween = <T>(
  target: T,
  key: string,
  mix: (from: T, to: T, t: number) => T,
  duration = 650,
): T => {
  const [anim, setAnim] = useState({ key, from: target, to: target, t: 1 })

  // key가 바뀌었다 — 지금 보이는 값(넘어가는 중이면 그 중간)에서 다시 출발.
  if (anim.key !== key) {
    const shown = anim.t >= 1 ? anim.to : mix(anim.from, anim.to, ease(anim.t))
    setAnim({ key, from: shown, to: target, t: 0 })
  }

  useEffect(() => {
    if (anim.t >= 1) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let start: number | null = null
    let frame = requestAnimationFrame(function step(now) {
      start ??= now
      const t = reduce ? 1 : Math.min(1, (now - start) / duration)
      setAnim((prev) => (prev.key === key ? { ...prev, t } : prev))
      if (t < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
    // 새로 출발할 때(key)만 다시 건다 — t가 바뀔 때마다 걸면 끊긴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim.key])

  if (anim.key !== key || anim.t >= 1) return target
  return mix(anim.from, anim.to, ease(anim.t))
}

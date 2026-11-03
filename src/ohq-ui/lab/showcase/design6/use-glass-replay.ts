import { useCallback, useEffect, useRef, useState } from 'react'
import { REPLAY_FRAMES, REPLAY_STEPS, type ReplayStep } from './glass-data'

const FRAME = 1000 / 30
/** 처음 모습(Personal 켜짐)을 갖춘 뒤 대본을 시작하기까지 — 켜지는 애니메이션이 끝날 시간.
 *  27.5프레임이라 시작부터 i번째 프레임이 영상 F(i − 27)과 겹친다(대본 0 = 영상 F0.5). */
const LEAD_IN = 27.5 * FRAME

interface ReplayHandlers {
  /** 시작 전 — 영상 첫 모습으로 맞춘다 */
  prepare: () => void
  /** 대본 한 줄 */
  apply: (step: ReplayStep) => void
  /** 끝났거나 멈췄을 때 — 마우스 입력으로 돌려준다 */
  finish: () => void
}

/**
 * 영상 그대로 다시 보기 — REPLAY_STEPS를 시간에 맞춰 apply에 넘긴다.
 * 시계는 빈 Web Animation(currentTime)이라 캡처 도구가 애니메이션을 느리게 돌리면 대본도 같이 느려진다.
 */
export function useGlassReplay(handlers: ReplayHandlers) {
  const [playing, setPlaying] = useState(false)
  const handlersRef = useRef(handlers)
  const stopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    handlersRef.current = handlers
  })

  const stop = useCallback(() => {
    stopRef.current?.()
    stopRef.current = null
  }, [])

  const play = useCallback(() => {
    stop()
    handlersRef.current.prepare()
    const clock = new Animation(new KeyframeEffect(null, null, LEAD_IN + REPLAY_FRAMES * FRAME + 50), document.timeline)
    let next = 0
    let raf = 0
    const tick = () => {
      const t = Number(clock.currentTime ?? 0) - LEAD_IN
      while (next < REPLAY_STEPS.length && REPLAY_STEPS[next].frame * FRAME <= t)
        handlersRef.current.apply(REPLAY_STEPS[next++])
      if (clock.playState === 'finished' || next >= REPLAY_STEPS.length) {
        stopRef.current = null
        setPlaying(false)
        handlersRef.current.finish()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    clock.play()
    raf = requestAnimationFrame(tick)
    setPlaying(true)
    stopRef.current = () => {
      cancelAnimationFrame(raf)
      clock.cancel()
      setPlaying(false)
      handlersRef.current.finish()
    }
  }, [stop])

  useEffect(() => stop, [stop])

  return { playing, play, stop }
}

import { useEffect, useRef, useState } from 'react'
import { REPLAY_END_FRAME, REPLAY_INITIAL, REPLAY_STEPS, replayMs, type ReplayHover } from './radial-menu-data'

interface ReplayTarget {
  setOpen: (open: boolean) => void
  setValue: (value: string | null) => void
}

// 열린 메뉴에서 재생을 누르면 먼저 닫히는 데(0.55초 + 40ms×5) 걸리는 만큼 기다렸다 시작한다.
const CLOSE_LEAD_MS = 900

/**
 * 영상(F55~F396) 순서대로 메뉴를 여닫고, 올리고, 고른다 — 타이머로 상태만 바꾸고 움직임은 CSS가 한다.
 * hover가 undefined가 아니면 재생 중이다(그동안 메뉴는 마우스 대신 hover를 따른다).
 */
export function useRadialReplay({ setOpen, setValue }: ReplayTarget) {
  const [hover, setHover] = useState<ReplayHover | undefined>(undefined)
  // 배열을 갈아끼우지 않고 비우기만 해서, 언마운트 정리에서도 같은 배열을 본다.
  const timers = useRef<number[]>([])

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current.length = 0
  }

  const stop = () => {
    clear()
    setHover(undefined)
  }

  const play = (currentlyOpen: boolean) => {
    clear()
    setOpen(REPLAY_INITIAL.open)
    setValue(REPLAY_INITIAL.value)
    setHover(REPLAY_INITIAL.hover)
    const lead = currentlyOpen ? CLOSE_LEAD_MS : 0
    const at = (ms: number, run: () => void) => timers.current.push(window.setTimeout(run, lead + ms))
    for (const step of REPLAY_STEPS) {
      at(replayMs(step.at), () => {
        if (step.hover !== undefined) setHover(step.hover)
        if (step.open !== undefined) setOpen(step.open)
        if (step.select !== undefined) setValue(step.select)
      })
    }
    at(replayMs(REPLAY_END_FRAME), () => {
      timers.current.length = 0
      setHover(undefined)
    })
  }

  useEffect(() => {
    const list = timers.current
    return () => list.forEach((t) => window.clearTimeout(t))
  }, [])

  return { playing: hover !== undefined, hover, play, stop }
}

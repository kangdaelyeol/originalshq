import { useState } from 'react'

/** 마지막으로 null이 아니었던 값 — 상세 패널이 닫혀 미끄러져 나가는 동안에도
 * 내용을 남겨 두려고(side-panel.tsx). */
export const useLatched = <T>(value: T | null): T | null => {
  const [latched, setLatched] = useState(value)
  if (value !== null && value !== latched) setLatched(value)
  return latched
}

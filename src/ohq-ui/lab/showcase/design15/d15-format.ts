import type { CSSProperties } from 'react'

// D15 숫자 모양 — 영상 글 그대로(3,553 · 89% · 3.0 d · 3,553h · 01:24:08)

export type D15NumberFormat = 'int' | 'pct' | 'days' | 'hours'

const INT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatValue(v: number, format: D15NumberFormat) {
  switch (format) {
    case 'pct':
      return `${Math.round(v)}%`
    case 'days':
      return `${v.toFixed(1)} d`
    case 'hours':
      return `${INT.format(Math.round(v))}h`
    default:
      return INT.format(Math.round(v))
  }
}

/** 초 → "01:24:08" */
export function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return [hh, mm, ss].map((n) => String(n).padStart(2, '0')).join(':')
}

/** CSS 변수 묶음 → style 값("--i": 3) */
export const cssVars = (vars: Record<`--${string}`, string | number>) => vars as CSSProperties

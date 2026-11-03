import type { SVGProps } from 'react'

// Design 7 아이콘 — 영상 프레임을 확대해 따라 그렸다(24 단위 판, 영상에서 28.8px = 1.2배).
// TrendingUp·Mic·User의 선은 Lucide(ISC License, Copyright (c) 2026 Lucide Icons and Contributors)에서
// 가져와, 영상처럼 마이크 몸통은 채우고 사람 몸은 아래를 닫았다. 카드·서류가방·목록은 영상 실측으로 그렸다.

type IconProps = SVGProps<SVGSVGElement>

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** Activity — 오르는 선(Lucide trending-up 그대로, F1 223.5~247.5) */
export function LiquidTrendingIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M16 7h6v6" />
      <path d="m22 7-8.5 8.5-5-5L2 17" />
    </svg>
  )
}

/** Cards — 가운데 줄이 지나는 카드(F1: 20×15.8, 모서리 3.3, 줄 y 12.25) */
export function LiquidCardsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <rect x="1.9" y="4.35" width="20" height="15.8" rx="3.3" />
      <path d="M1.9 12.25h20" />
    </svg>
  )
}

/** Work — 손잡이만 있는 서류가방(F1: 몸 18.3×13.3, 손잡이 6.7 폭) */
export function LiquidBriefcaseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <rect x="3.1" y="7.7" width="18.3" height="13.3" rx="2.4" />
      <path d="M8.9 7.7V5.95a1.6 1.6 0 0 1 1.6-1.6h3.5a1.6 1.6 0 0 1 1.6 1.6V7.7" />
    </svg>
  )
}

/** Voice — 몸통을 채운 마이크(F1: 몸통 9.9×16.9px) */
export function LiquidMicIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M12 19v3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <rect x="9" y="2" width="6" height="13" rx="3" fill="currentColor" />
    </svg>
  )
}

/** Profile — 아래가 닫힌 사람(F140 몸 바닥선이 이어져 있다) */
export function LiquidUserIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2z" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

/**
 * 버튼의 목록 아이콘 — 점 셋 + 굵은 줄 셋(F49 실측, 단위 = 영상 px).
 * 점 지름·줄 굵기 4.2, 줄 간격 8.3, 점과 줄 사이 5px — Lucide list보다 굵고 성기다.
 */
export function LiquidListIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" {...props}>
      <path d="M3.1 3.7h.01M3.1 11.95h.01M3.1 20.25h.01" />
      <path d="M12.2 3.7h16.7M12.2 11.95h16.7M12.2 20.25h16.7" />
    </svg>
  )
}

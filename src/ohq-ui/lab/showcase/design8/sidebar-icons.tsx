import type { SVGProps } from 'react'

// lucide에 없는 아이콘 두 개 — lucide와 같은 24 격자·선 굵기 2로 그렸다(F169 8배 확대에서 잰 모양).

const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

/** 대시보드 — 동그라미 네 개(2×2). 지름 7.5px·간격 1.5px(18px 아이콘 기준) */
export function DashboardDotsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="6.25" cy="6.25" r="4" />
      <circle cx="17.75" cy="6.25" r="4" />
      <circle cx="6.25" cy="17.75" r="4" />
      <circle cx="17.75" cy="17.75" r="4" />
    </svg>
  )
}

/** 리포트 — 바닥선 위 막대 세 개(가운데가 가장 높다). lucide chart-no-axes-column에 바닥선을 더한 꼴 */
export function ReportsBarsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 20h18" />
      <path d="M7 16V9.5" />
      <path d="M12 16V5" />
      <path d="M17 16V9" />
    </svg>
  )
}

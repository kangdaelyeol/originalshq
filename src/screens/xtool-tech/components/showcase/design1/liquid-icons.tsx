// Design 1 탭 바 아이콘 — 영상 프레임을 10배로 키워 잰 좌표로 그렸다. viewBox 52 = 버튼 중심
// 둘레 52px(영상 기준)이라, 버튼 지름 90 안에서 영상과 같은 크기·두께로 보인다.

export interface LiquidIconProps {
  className?: string
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** 집 — 지붕이 벽보다 바깥으로 나온 처마, 아래가 뚫린 문 */
export function LiquidHomeIcon({ className }: LiquidIconProps) {
  return (
    <svg className={className} viewBox="0 0 52 52" aria-hidden {...stroke} strokeWidth={2.4}>
      <path d="M12.3 23.8 26 13.3l13.7 10.5" />
      <path d="M15.8 21.1V37H23v-6.6a2.3 2.3 0 0 1 2.3-2.3h1.4a2.3 2.3 0 0 1 2.3 2.3V37h7.2V21.1" />
    </svg>
  )
}

/** 돋보기 — 원이 왼쪽 위로 치우치고 손잡이가 오른쪽 아래로 길다 */
export function LiquidSearchIcon({ className }: LiquidIconProps) {
  return (
    <svg className={className} viewBox="0 0 52 52" aria-hidden {...stroke} strokeWidth={2.5}>
      <circle cx="23.8" cy="23.2" r="10.1" />
      <path d="M31.1 30.4 37.6 37" />
    </svg>
  )
}

/** 더하기 — 다른 아이콘보다 가늘고 길다(영상 그대로) */
export function LiquidPlusIcon({ className }: LiquidIconProps) {
  return (
    <svg className={className} viewBox="0 0 52 52" aria-hidden {...stroke} strokeWidth={2.2}>
      <path d="M13 26h26M26 13v26" />
    </svg>
  )
}

/** 하트 — 물에 잠기면 속을 흰색으로 채운다(fill은 CSS가 정한다) */
export function LiquidHeartIcon({ className }: LiquidIconProps) {
  return (
    <svg className={className} viewBox="0 0 52 52" aria-hidden {...stroke} strokeWidth={2.6}>
      <path d="M26 18.4c-1.8-3.1-4.4-4.7-7.4-4.7-4.2 0-7.2 3.3-7.2 7.7 0 3.9 2.4 7 5.6 10.2L26 39.3l9-7.7c3.2-3.2 5.6-6.3 5.6-10.2 0-4.4-3-7.7-7.2-7.7-3 0-5.6 1.6-7.4 4.7Z" />
    </svg>
  )
}

/** 사람 — 작은 머리 + 넓은 아치 어깨 */
export function LiquidUserIcon({ className }: LiquidIconProps) {
  return (
    <svg className={className} viewBox="0 0 52 52" aria-hidden {...stroke} strokeWidth={2.4}>
      <circle cx="26" cy="19" r="5.15" />
      <path d="M15.5 37.1a10.8 10.8 0 0 1 21 0" />
    </svg>
  )
}

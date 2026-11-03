// Design 6 알약 아이콘 — iOS 집중 모드(SF Symbols의 bed.double.fill · moon.fill · person.fill ·
// ellipsis)처럼 속이 찬 그림. 영상 F80을 6배로 키워 본 모양을 24 뷰박스에 옮겼다.

export interface FocusIconProps {
  className?: string
}

/** 침대 — 둥근 머리판 아래쪽에 베개 두 개가 하얗게 뚫리고, 머리판보다 넓은 매트리스와 짧은 다리(F200을 판 평면으로 편 모양) */
export function FocusBedIcon({ className }: FocusIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M6 3.6h12a1.6 1.6 0 0 1 1.6 1.6v4.3H4.4V5.2A1.6 1.6 0 0 1 6 3.6Zm-.3 4.4v1.5H11V8H5.7Zm7.3 0v1.5h5.3V8H13Z"
      />
      <path d="M2.2 9.5h19.6a1.2 1.2 0 0 1 1.2 1.2v8H1v-8a1.2 1.2 0 0 1 1.2-1.2Z" />
      <path d="M1 18.7h2.3v1.9H1Zm19.7 0H23v1.9h-2.3Z" />
    </svg>
  )
}

/** 초승달 — 오른쪽 위로 열린 달(큰 원에서 작은 원을 뺀 모양, 가장 두꺼운 곳이 지름의 40%) */
export function FocusMoonIcon({ className }: FocusIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8.68 4.58A8.6 8.6 0 1 0 19.42 15.32 7.9 7.9 0 0 1 8.68 4.58Z" />
    </svg>
  )
}

/** 사람 — 동그란 머리와 둥근 어깨 */
export function FocusPersonIcon({ className }: FocusIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="7.4" r="4.3" />
      <path d="M3.6 21c0-4.6 3.8-7.6 8.4-7.6s8.4 3 8.4 7.6v.4H3.6Z" />
    </svg>
  )
}

/** 점 셋(더보기) — 알약 오른쪽 끝 */
export function FocusDotsIcon({ className }: FocusIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 6" fill="currentColor" aria-hidden>
      <circle cx="4" cy="3" r="1.8" />
      <circle cx="12" cy="3" r="1.8" />
      <circle cx="20" cy="3" r="1.8" />
    </svg>
  )
}

/**
 * 워크스페이스 로고 — 주황빛 빨강 원(지름 4.4em) 위 흰 V. V는 글꼴 대신 다각형으로 그려
 * 영상(F169 5배 확대)의 굵기·꼭짓점을 그대로 옮겼다: 폭 21px, 위는 가로로 잘리고 아래는 납작한 꼭짓점.
 */
export function SidebarLogo() {
  return (
    <span className="d8-logo" aria-hidden="true">
      <svg className="d8-logo__mark" viewBox="0 0 44 44">
        <path d="M11.6 11.8h4.8L22 26.1l5.6-14.3h4.8l-8.1 20.6h-4.6z" />
      </svg>
    </span>
  )
}

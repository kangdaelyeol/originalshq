

export function ChevronIcon() {
  return (
    <svg
      className="channel-insight__chevron"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 커스텀 체크박스(MultiSelectDropdown)의 체크 표시 — 네이티브 input은 시각적으로
 * 숨기고(sr-only) 이 아이콘 + 박스로 대신 그린다. */
export function CheckIcon() {
  return (
    <svg
      className="channel-insight__multi-select-check"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function InfoIcon() {
  return (
    <svg
      className="channel-insight__info-icon"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth={1.3} />
      <path
        d="M8 7.2v4"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      <circle cx="8" cy="4.8" r="0.9" fill="currentColor" />
    </svg>
  )
}

export type SortDir = 'asc' | 'desc'

/** 정렬 중인 컬럼에만 방향(▲/▼)을 강조 표시 — 정렬 대상이 아닌 컬럼은 둘 다 옅게
 * 둔다. 전체 요약 표(MetricsTable)와 전체 목록 표(FullListTable) 둘 다 공유. */
export function SortArrows({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="channel-insight__sort-arrows">
      <span
        className={`channel-insight__sort-arrow${active && dir === 'asc' ? ' is-active' : ''}`}
      >
        ▲
      </span>
      <span
        className={`channel-insight__sort-arrow${active && dir === 'desc' ? ' is-active' : ''}`}
      >
        ▼
      </span>
    </span>
  )
}

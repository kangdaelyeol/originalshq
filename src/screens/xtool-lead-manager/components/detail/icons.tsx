/* 고객 상세 모달 전용 아이콘 — 전부 currentColor를 써서 버튼의 글자색을 따른다. */

export const DeleteIcon = () => (
  <svg viewBox="0 0 20 20" fill="none">
    <path
      d="M4 6h12M8 6V4.5A1 1 0 0 1 9 3.5h2a1 1 0 0 1 1 1V6M5.5 6l.6 9.6a1.5 1.5 0 0 0 1.5 1.4h4.8a1.5 1.5 0 0 0 1.5-1.4l.6-9.6"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const ResendIcon = () => (
  <svg viewBox="0 0 20 20" fill="none">
    <path
      d="M4 10a6 6 0 0 1 10.24-4.24M16 10a6 6 0 0 1-10.24 4.24"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.5 3v3h-3M5.5 17v-3h3"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const EditIcon = () => (
  <svg viewBox="0 0 20 20" fill="none">
    <path
      d="M13.5 3.5l3 3L6 17l-3.5.5.5-3.5L13.5 3.5Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const CloseIcon = () => (
  <svg viewBox="0 0 20 20" fill="none">
    <path
      d="M5 5l10 10M15 5 5 15"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
)

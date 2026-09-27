import {
  useSingleSelectDropdownViewModel,
  type SingleSelectOption,
} from '../view-model/use-single-select-dropdown-view-model'

export type { SingleSelectOption } from '../view-model/use-single-select-dropdown-view-model'

// channel-insight.tsx의 ChevronIcon과 같은 모양이지만, roas-panel.tsx 등
// channel-insight.tsx 밖에서도 이 컴포넌트를 쓸 수 있도록 따로 둔다(모듈
// 독립성 우선 — 이 코드베이스 여러 곳이 같은 작은 조각을 각자 갖고 있는 것과
// 같은 패턴).
function ChevronIcon() {
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

/** "보기 단위"(전체 요약/캠페인/adset/…), pivot 축(날짜별/요일별/주차별), adset
 * 탭의 캠페인 선택, ROAS 탭의 그룹핑 선택이 공유하는 네이티브 <select> 대체용
 * 커스텀 드롭다운. MultiSelectDropdown(channel-insight.tsx)과 같은 톤(트리거
 * 버튼 + 팝오버 메뉴)이지만 체크박스가 아니라 클릭하면 바로 선택되고 닫힌다.
 * 트리거에 포커스가 있으면 방향키로도 메뉴를 펼치지 않고 값을 바로 바꿀 수
 * 있다(네이티브 select와 같은 동작 — useSingleSelectDropdownViewModel의
 * handleTriggerKeyDown 참고). */
export function SingleSelectDropdown<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly SingleSelectOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
}) {
  const { open, ref, selectedLabel, toggleOpen, close, handleTriggerKeyDown } =
    useSingleSelectDropdownViewModel(options, value, onChange)

  return (
    <div className="channel-insight__single-select" ref={ref}>
      <button
        type="button"
        className={`channel-insight__result-select channel-insight__single-select-trigger${
          open ? ' is-open' : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
      >
        {selectedLabel}
        <ChevronIcon />
      </button>
      {open && (
        <ul
          className="channel-insight__single-select-menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`channel-insight__single-select-item${
                o.value === value ? ' is-selected' : ''
              }`}
              onClick={() => {
                onChange(o.value)
                close()
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

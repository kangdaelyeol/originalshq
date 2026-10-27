import {
  useMultiSelectDropdownViewModel,
  type MultiSelectOption,
} from '../../view-model/use-multi-select-dropdown-view-model'
import { ChevronIcon, CheckIcon } from '../icons'

// ------------------------------------------------------------------ 다중 선택 드롭다운
// 캠페인 탭의 캠페인 선택, adset 탭의 adset 선택, 지표 선택이 공유하는 체크박스
// 팝오버. 지표 선택엔 MetricKey를, 나머지엔 일반 string을 써서 제네릭으로 뒀다.
export function MultiSelectDropdown<T extends string>({
  options,
  selected,
  onToggle,
  emptyLabel,
  countSuffix,
}: {
  options: readonly MultiSelectOption<T>[]
  selected: ReadonlySet<T>
  onToggle: (key: T) => void
  emptyLabel: string
  countSuffix: string
}) {
  const { open, ref, triggerLabel, toggleOpen } =
    useMultiSelectDropdownViewModel(options, selected, emptyLabel, countSuffix)

  return (
    <div className="channel-insight__multi-select" ref={ref}>
      <button
        type="button"
        className={`channel-insight__result-select channel-insight__multi-select-trigger${
          open ? ' is-open' : ''
        }`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        {triggerLabel}
        <ChevronIcon />
      </button>
      {open && (
        <div className="channel-insight__multi-select-menu">
          {options.map((o) => (
            <label key={o.key} className="channel-insight__multi-select-item">
              <input
                type="checkbox"
                className="channel-insight__multi-select-input"
                checked={selected.has(o.key)}
                onChange={() => onToggle(o.key)}
              />
              <span className="channel-insight__multi-select-box">
                <span className="channel-insight__multi-select-fill" />
                <CheckIcon />
              </span>
              <span className="channel-insight__multi-select-label">
                {o.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

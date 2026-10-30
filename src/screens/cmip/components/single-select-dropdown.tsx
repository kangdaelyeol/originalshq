import { Select } from '@/components/glass'

export interface SingleSelectOption<T extends string> {
  value: T
  label: string
}

/** "보기 단위"(전체 요약/캠페인/adset/…), pivot 축(날짜별/요일별/주차별), ROAS
 * 탭의 그룹핑 선택이 같이 쓰는 드롭다운 — 클릭하면 바로 선택되고 닫힌다.
 * 모양·키보드 동작은 유리 Select(@/components/glass)가 갖는다. */
export function SingleSelectDropdown<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = '선택',
}: {
  options: readonly SingleSelectOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
}) {
  return (
    <Select
      className="channel-insight__single-select"
      value={value}
      options={options.map((option) => ({
        value: option.value,
        label: option.label,
      }))}
      onChange={onChange}
      label={ariaLabel}
    />
  )
}

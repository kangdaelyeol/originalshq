import '../styles/segmented-toggle.scss'
import { Segmented } from '@/components/glass'

interface Props<T extends string> {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}

/** 버튼 N개 중 하나 — 항상 하나만 선택. 브랜드·보고서 종류·요약 단위 등에
 * 공용. 모양은 유리 Segmented(@/components/glass — 고른 알약이 미끄러진다). */
export function SegmentedToggle<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: Props<T>) {
  return (
    <Segmented
      options={
        Object.fromEntries(
          options.map((option) => [option.value, option.label]),
        ) as Record<T, string>
      }
      value={value}
      onChange={onChange}
      label={label}
      role="buttons"
      disabled={disabled}
    />
  )
}

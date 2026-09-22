import { useEffect, useRef, useState } from 'react'

export interface MultiSelectOption<T extends string> {
  key: T
  label: string
}

/** 캠페인 탭의 캠페인 선택, adset 탭의 adset 선택, 지표 선택이 공유하는 체크박스
 * 팝오버(MultiSelectDropdown) 전용 상태 — 열림/닫힘, 바깥 클릭·Escape로 닫기,
 * 트리거 버튼에 보여줄 라벨을 다룬다. */
export const useMultiSelectDropdownViewModel = <T extends string>(
  options: readonly MultiSelectOption<T>[],
  selected: ReadonlySet<T>,
  emptyLabel: string,
  countSuffix: string,
) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const selectedOption =
    selected.size === 1 ? options.find((o) => selected.has(o.key)) : undefined
  const triggerLabel =
    selected.size === 0
      ? emptyLabel
      : (selectedOption?.label ?? `${selected.size}${countSuffix}`)

  return {
    // 진행 상태
    open,
    ref,
    triggerLabel,
    // 액션
    toggleOpen: () => setOpen((v) => !v),
  }
}

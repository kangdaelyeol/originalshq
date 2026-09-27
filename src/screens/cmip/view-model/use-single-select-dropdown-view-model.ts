import type { KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

export interface SingleSelectOption<T extends string> {
  value: T
  label: string
}

/** "보기 단위"(전체 요약/캠페인/adset/…), pivot 축(날짜별/요일별/주차별), adset
 * 탭의 캠페인 선택처럼 항상 하나만 고르는 네이티브 <select>를 커스텀 디자인
 * 드롭다운(SingleSelectDropdown)으로 바꾸는 데 쓰는 공용 상태 — 열림/닫힘,
 * 바깥 클릭·Escape로 닫기, 트리거에 포커스가 있을 때 방향키로 값을 바로
 * 바꾸는 동작(네이티브 select가 메뉴를 펼치지 않고도 방향키만으로 값이
 * 바뀌는 것과 같은 동작)까지 다룬다. */
export const useSingleSelectDropdownViewModel = <T extends string>(
  options: readonly SingleSelectOption<T>[],
  value: T,
  onChange: (value: T) => void,
) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const currentIndex = options.findIndex((o) => o.value === value)
  const selectedLabel = options[currentIndex]?.label ?? ''

  // 방향키로 옵션을 바로 순환시킨다 — 메뉴가 열려 있든 닫혀 있든 트리거에
  // 포커스가 있으면 동작한다(닫혀 있을 때도 되는 게 네이티브 select와 같은
  // 동작이라 사용자가 더 자연스럽게 느낀다). 맨 끝 옵션에서는 그 자리에 멈춘다
  // (순환하지 않음 — 네이티브 select와 동일).
  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = options[Math.min(currentIndex + 1, options.length - 1)]
      if (next && next.value !== value) onChange(next.value)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = options[Math.max(currentIndex - 1, 0)]
      if (prev && prev.value !== value) onChange(prev.value)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen((v) => !v)
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return {
    // 진행 상태
    open,
    ref,
    selectedLabel,
    // 액션
    toggleOpen: () => setOpen((v) => !v),
    close: () => setOpen(false),
    handleTriggerKeyDown,
  }
}

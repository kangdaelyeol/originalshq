import { useEffect, useRef, useState } from 'react'
import { startOfMonth } from '../utils'
import type { ISODate } from '../types'

function formatDisplay(iso: ISODate): string {
  return iso.replaceAll('-', '.')
}

/** date-range-narrow(단일 월, 프리셋 없는 부분 범위 축소) 전용 상태 — minDate~maxDate
 * 밖은 고를 수 없다는 제약만 date-range-picker의 팝오버 상태 패턴에 추가된 형태다. */
export const useDateRangeNarrowViewModel = (
  minDate: ISODate,
  maxDate: ISODate,
  dateStart: ISODate,
  dateEnd: ISODate,
  onChange: (start: ISODate, end: ISODate) => void,
) => {
  const [open, setOpen] = useState(false)
  const [draftStart, setDraftStart] = useState(dateStart)
  const [draftEnd, setDraftEnd] = useState(dateEnd)
  const [pickingEnd, setPickingEnd] = useState(false)
  const [hoverDay, setHoverDay] = useState<ISODate | null>(null)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(dateEnd))
  const containerRef = useRef<HTMLDivElement>(null)

  const minMonth = startOfMonth(minDate)
  const maxMonth = startOfMonth(maxDate)

  const openPopover = () => {
    setDraftStart(dateStart)
    setDraftEnd(dateEnd)
    setPickingEnd(false)
    setHoverDay(null)
    setViewMonth(startOfMonth(dateEnd))
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
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

  const isDayDisabled = (day: ISODate) => day < minDate || day > maxDate

  const handleDayClick = (day: ISODate) => {
    if (isDayDisabled(day)) return
    if (!pickingEnd) {
      setDraftStart(day)
      setDraftEnd(day)
      setPickingEnd(true)
    } else {
      if (day < draftStart) {
        setDraftEnd(draftStart)
        setDraftStart(day)
      } else {
        setDraftEnd(day)
      }
      setPickingEnd(false)
      setHoverDay(null)
    }
  }

  const handleApply = () => {
    onChange(draftStart, draftEnd)
    setOpen(false)
  }

  const handleResetToFull = () => {
    setDraftStart(minDate)
    setDraftEnd(maxDate)
    setPickingEnd(false)
    setHoverDay(null)
  }

  const [previewLo, previewHi]: [ISODate, ISODate] =
    pickingEnd && hoverDay
      ? hoverDay < draftStart
        ? [hoverDay, draftStart]
        : [draftStart, hoverDay]
      : [draftStart, draftEnd]

  const isFullRange = dateStart === minDate && dateEnd === maxDate
  const triggerLabel = isFullRange
    ? '전체 기간'
    : `${formatDisplay(dateStart)} ~ ${formatDisplay(dateEnd)}`

  return {
    // 진행 상태
    open,
    viewMonth,
    minMonth,
    maxMonth,
    previewLo,
    previewHi,
    isFullRange,
    triggerLabel,
    containerRef,
    isDayDisabled,
    // 액션
    setViewMonth,
    setHoverDay,
    openPopover,
    close: () => setOpen(false),
    handleDayClick,
    handleApply,
    handleResetToFull,
  }
}

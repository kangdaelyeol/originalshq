import { useEffect, useMemo, useRef, useState } from 'react'
import { addMonths, fromISO, startOfMonth, todayISO } from '../utils'
import type { ISODate } from '../types'
import { PRESETS, matchPreset, type Preset } from '../components/date-range-presets'

/** date-range-picker(듀얼 월 팝오버) 전용 상태 — 팝오버를 열 때마다 draft를
 * dateStart/dateEnd로 리셋하고, "업데이트"를 눌러야만 onChange로 부모에 반영한다
 * (달력을 클릭할 때마다 즉시 조회하지 않기 위함). */
export const useDateRangePickerViewModel = (
  dateStart: ISODate,
  dateEnd: ISODate,
  onChange: (start: ISODate, end: ISODate) => void,
) => {
  const [open, setOpen] = useState(false)
  const [draftStart, setDraftStart] = useState(dateStart)
  const [draftEnd, setDraftEnd] = useState(dateEnd)
  // true인 동안은 "시작일은 정했고 끝나는 날을 고르는 중" — 다음 클릭이 끝나는 날이 된다.
  const [pickingEnd, setPickingEnd] = useState(false)
  const [hoverDay, setHoverDay] = useState<ISODate | null>(null)
  const [rightMonthStart, setRightMonthStart] = useState(() =>
    startOfMonth(dateEnd),
  )
  const containerRef = useRef<HTMLDivElement>(null)

  const openPopover = () => {
    setDraftStart(dateStart)
    setDraftEnd(dateEnd)
    setPickingEnd(false)
    setHoverDay(null)
    setRightMonthStart(startOfMonth(dateEnd))
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

  const activeKey = matchPreset(draftStart, draftEnd)

  const applyPreset = (p: Preset) => {
    const [s, e] = p.range()
    setDraftStart(s)
    setDraftEnd(e)
    setPickingEnd(false)
    setHoverDay(null)
    setRightMonthStart(startOfMonth(e))
  }

  const handleDayClick = (day: ISODate) => {
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

  const handleTypedStart = (value: ISODate) => {
    setDraftStart(value)
    if (value > draftEnd) setDraftEnd(value)
    setPickingEnd(false)
  }

  const handleTypedEnd = (value: ISODate) => {
    setDraftEnd(value)
    if (value < draftStart) setDraftStart(value)
    setPickingEnd(false)
  }

  const handleApply = () => {
    onChange(draftStart, draftEnd)
    setOpen(false)
  }

  const leftMonthStart = addMonths(rightMonthStart, -1)

  const yearOptions = useMemo(() => {
    const y = fromISO(todayISO()).getUTCFullYear()
    return Array.from({ length: 6 }, (_, i) => y - 5 + i)
  }, [])

  // 드래그로 범위를 고르는 중이면 마우스가 지나간 지점까지 미리 보여준다.
  const [previewLo, previewHi]: [ISODate, ISODate] =
    pickingEnd && hoverDay
      ? hoverDay < draftStart
        ? [hoverDay, draftStart]
        : [draftStart, hoverDay]
      : [draftStart, draftEnd]

  const triggerPresetLabel =
    PRESETS.find((p) => p.key === activeKey)?.label ?? '직접 입력'

  return {
    // 입력(draft)
    draftStart,
    draftEnd,
    setHoverDay,
    setRightMonthStart,
    // 진행 상태
    open,
    pickingEnd,
    activeKey,
    leftMonthStart,
    rightMonthStart,
    yearOptions,
    previewLo,
    previewHi,
    triggerPresetLabel,
    containerRef,
    // 액션
    openPopover,
    close: () => setOpen(false),
    applyPreset,
    handleDayClick,
    handleTypedStart,
    handleTypedEnd,
    handleApply,
    setPickingEnd,
  }
}

import { useState } from 'react'
import {
  Device,
  type ConsultationRecord,
  type IntakeRecord,
  type PurchaseRecord,
} from '@/screens/xtool-lead-manager/entity'
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '@/screens/xtool-lead-manager/utils'

/*
 * 접수/상담/구매 이력 한 줄의 편집 상태.
 *
 * 세 줄은 "눌러서 고치고 저장/취소"라는 흐름은 같지만 고칠 수 있는 값이
 * 서로 다르다(접수: 기기·시각, 상담: +메모, 구매: +금액). 하나의 범용 훅에
 * 옵션을 붙여 합치면 어느 줄에 무슨 값이 있는지 따라가기 어려워져서, 줄마다
 * 훅을 따로 두고 각자 필요한 값만 갖게 했다.
 *
 * 편집 값은 폼 입력에 그대로 묶을 수 있는 문자열 형태(시각은 datetime-local
 * 문자열, 금액은 숫자 문자열)로 들고 있다가, 저장할 때만 변환한다.
 */

/** 접수 — device가 비어 있는 레코드가 많다(리드 생성 흐름에 기기 입력이
 * 없음). 편집에 들어가면 기기를 하나 고르게 하고, 지정한 기기를 다시 비우는
 * 것은 지원하지 않는다. */
export const useIntakeRowViewModel = (
  record: IntakeRecord,
  onUpdate: (updates: { at?: number; device?: Device }) => Promise<void>,
) => {
  const [editing, setEditing] = useState(false)
  const [device, setDevice] = useState<Device>(record.device ?? Device.F2_ULTRA)
  const [at, setAt] = useState(toDatetimeLocalValue(record.at))

  return {
    state: { editing, device, at },
    actions: {
      setDevice,
      setAt,
      startEdit: () => setEditing(true),
      cancelEdit: () => setEditing(false),
      save: async () => {
        await onUpdate({ device, at: fromDatetimeLocalValue(at) })
        setEditing(false)
      },
    },
  }
}

export const useConsultationRowViewModel = (
  record: ConsultationRecord,
  onUpdate: (updates: {
    at?: number
    device?: Device
    note?: string
  }) => Promise<void>,
) => {
  const [editing, setEditing] = useState(false)
  const [device, setDevice] = useState<Device>(record.device)
  const [at, setAt] = useState(toDatetimeLocalValue(record.at))
  // Monday CRM에서 나중에 이 값을 채워 넣을 예정 — 그 전까지는 수기 입력.
  const [note, setNote] = useState(record.note ?? '')
  const [resendOpen, setResendOpen] = useState(false)

  return {
    state: { editing, device, at, note, resendOpen },
    actions: {
      setDevice,
      setAt,
      setNote,
      startEdit: () => setEditing(true),
      cancelEdit: () => setEditing(false),
      toggleResend: () => setResendOpen((v) => !v),
      closeResend: () => setResendOpen(false),
      save: async () => {
        await onUpdate({ device, at: fromDatetimeLocalValue(at), note })
        setEditing(false)
      },
    },
  }
}

export const usePurchaseRowViewModel = (
  record: PurchaseRecord,
  onUpdate: (updates: {
    at?: number
    device?: Device
    price?: number
  }) => Promise<void>,
) => {
  const [editing, setEditing] = useState(false)
  const [device, setDevice] = useState<Device>(record.device)
  const [at, setAt] = useState(toDatetimeLocalValue(record.at))
  const [price, setPrice] = useState(String(record.price))
  const [resendOpen, setResendOpen] = useState(false)

  return {
    state: { editing, device, at, price, resendOpen },
    actions: {
      setDevice,
      setAt,
      setPrice,
      startEdit: () => setEditing(true),
      cancelEdit: () => setEditing(false),
      toggleResend: () => setResendOpen((v) => !v),
      closeResend: () => setResendOpen(false),
      /** 금액이 숫자가 아니거나 0 이하면 저장하지 않고 편집 상태로 둔다. */
      save: async () => {
        const numericPrice = Number(price)
        if (Number.isNaN(numericPrice) || numericPrice <= 0) return
        await onUpdate({
          device,
          at: fromDatetimeLocalValue(at),
          price: numericPrice,
        })
        setEditing(false)
      },
    },
  }
}

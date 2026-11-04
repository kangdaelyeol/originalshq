import { useRef, useState } from 'react'
import { isComposing } from '../../lib/ime'

// "+ 추가" — 그룹 맨 아래 새 항목 줄과 하위 표 맨 아래 새 하위 아이템 칸이 같이 쓴다.

/**
 * "+ 고객 추가" 입력 — 이름만 적고 엔터(또는 바깥 누르기)면 만든다. Esc는 취소 — blur가 같은 차례에
 * 저장을 부르므로(아직 지우기 전 값) 취소 표시를 ref로 먼저 세운다.
 */
export function AddInput({ label, onAdd }: { label: string; onAdd: (name: string) => void }) {
  const [value, setValue] = useState('')
  const cancelled = useRef(false)
  const submit = () => {
    const name = value.trim()
    if (cancelled.current) {
      cancelled.current = false
      return
    }
    if (!name) return
    onAdd(name)
    setValue('')
  }
  return (
    <input
      className="mon-add"
      placeholder={`+ ${label} 추가`}
      aria-label={`${label} 추가`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isComposing(e)) {
          e.preventDefault()
          submit()
        } else if (e.key === 'Escape') {
          cancelled.current = true
          setValue('')
          e.currentTarget.blur()
        }
      }}
    />
  )
}

/** 맨 아래 "+ 고객 추가" 줄 — 이 그룹에 새 항목을 만든다. */
export function AddRow({ nameTitle, onAdd }: { nameTitle: string; onAdd: (name: string) => void }) {
  return (
    <div className="mon-row mon-row--add" role="row">
      <div className="mon-cell mon-cell--name" role="rowheader">
        <AddInput label={nameTitle} onAdd={onAdd} />
      </div>
      <div className="mon-cell mon-row__fill" aria-hidden />
    </div>
  )
}

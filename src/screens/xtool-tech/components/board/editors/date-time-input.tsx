import { X } from 'lucide-react'
import { useState } from 'react'
import { koreaNow } from '../../../lib/dates'

// 편집 판의 칸 부품 — 물 레이아웃은 같은 props의 WaterDateTimeInput(components/water/board/date-time-input.tsx)으로
// 바꿔 끼운다.

/**
 * 날짜·시각 — 달력 하나에서 날짜와 시각을 같이 고른다. "시각 없음"을 체크하면 날짜만 고르는
 * 칸이 되고 Monday에도 날짜만 저장된다. 시각이 없는 기존 값은 체크된 채로 열린다.
 */
export function DateTimeInput({
  id,
  title,
  value,
  onChange,
}: {
  id: string
  title: string
  value: { date: string; time: string }
  onChange: (value: { date: string; time: string }) => void
}) {
  const { date, time } = value
  // 날짜만 있는 값이면 "시각 없음"으로 연다. 비어 있으면 시각까지 넣는 쪽이 기본.
  const [noTime, setNoTime] = useState(Boolean(date && !time))

  const toggleNoTime = (checked: boolean) => {
    setNoTime(checked)
    if (checked) onChange({ date, time: '' })
    // 시각을 다시 켜면 지금 시각을 넣어 둔다(시각까지 있어야 칸에 값이 보인다).
    else if (date && !time) onChange({ date, time: koreaNow().time })
  }

  return (
    <div className="dt-field">
      <div className="field__input dt-input">
        {noTime ? (
          <input id={id} type="date" value={date} onChange={(e) => onChange({ date: e.target.value, time: '' })} />
        ) : (
          <input
            id={id}
            type="datetime-local"
            value={date && time ? `${date}T${time}` : ''}
            onChange={(e) => {
              const [d = '', t = ''] = e.target.value.split('T')
              onChange({ date: d, time: t.slice(0, 5) })
            }}
          />
        )}
        {date && (
          <button type="button" className="dt-input__clear" aria-label={`${title} 지우기`} onClick={() => onChange({ date: '', time: '' })}>
            <X size={13} aria-hidden />
          </button>
        )}
      </div>
      <label className="check dt-field__notime">
        <input type="checkbox" checked={noTime} onChange={(e) => toggleNoTime(e.target.checked)} />
        시각 없음
      </label>
    </div>
  )
}

import { X } from 'lucide-react'
import { useState } from 'react'
import { WaterCheck } from '@/ohq-ui/water/controls'
import { koreaNow } from './edit-utils'

interface WaterDateTimeInputProps {
  id: string
  title: string
  value: { date: string; time: string }
  onChange: (value: { date: string; time: string }) => void
}

/**
 * 날짜·시각(물) — 칸 하나에서 날짜와 시각을 같이 고른다. "시각 없음"(기본 부품 WaterCheck)을 켜면 날짜만
 * 고르는 칸이 되고 Monday에도 날짜만 저장된다. 시각이 없는 기존 값은 켜진 채로 열린다 — 기존 DateTimeInput과
 * 같은 동작. 칸 모양은 기본 부품 입력(WaterTextField)의 유리 알약(water-field__box)을 빌린다 — 브라우저 날짜
 * 입력과 칸 안의 지우기 단추가 같이 들어가야 해서 WaterTextField를 그대로 쓰지 않는다(바깥 이름은 편집 칸이 단다).
 */
export function WaterDateTimeInput({
  id,
  title,
  value,
  onChange,
}: WaterDateTimeInputProps) {
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
    <div className="water-dt">
      <div className="water-field__box water-dt__box">
        {noTime ? (
          <input
            id={id}
            className="water-field__input"
            type="date"
            value={date}
            onChange={(e) => onChange({ date: e.target.value, time: '' })}
          />
        ) : (
          <input
            id={id}
            className="water-field__input"
            type="datetime-local"
            value={date && time ? `${date}T${time}` : ''}
            onChange={(e) => {
              const [d = '', t = ''] = e.target.value.split('T')
              onChange({ date: d, time: t.slice(0, 5) })
            }}
          />
        )}
        {date && (
          // 칸 안의 작은 지우기 — 기본 부품 WaterIconButton(32px 유리 원)은 40px 칸 안에 들어가지 않아 로컬
          <button
            type="button"
            className="water-dt__clear"
            aria-label={`${title} 지우기`}
            onClick={() => onChange({ date: '', time: '' })}
          >
            <X size={13} aria-hidden />
          </button>
        )}
      </div>
      <WaterCheck
        className="water-dt__notime"
        label="시각 없음"
        checked={noTime}
        onChange={(e) => toggleNoTime(e.target.checked)}
      />
    </div>
  )
}

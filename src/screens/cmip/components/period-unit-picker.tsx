import {
  PERIOD_UNIT_LABEL,
  periodUnitOf,
  type PeriodUnit,
} from '../utils'
import type { ISODate } from '../types'

/**
 * 일별 / 주차별 / 월별 — 누르면 그 단위의 기본 기간(직전 7일 / 직전 8주 /
 * 이번 달 포함 6개월)을 고른다. 지금 기간이 어느 단위의 기본 기간과 같으면
 * 그 버튼이 켜지고, 날짜를 직접 고른 기간이면 아무것도 켜지지 않는다.
 * xtool-lead-manager 통계 탭과 같은 규칙(defaultRangeOf)이다.
 */
export function PeriodUnitPicker({
  dateStart,
  dateEnd,
  onSelect,
  disabled = false,
}: {
  dateStart: ISODate
  dateEnd: ISODate
  onSelect: (unit: PeriodUnit) => void
  disabled?: boolean
}) {
  const active = periodUnitOf(dateStart, dateEnd)
  return (
    <div className="channel-insight__period-units" role="group" aria-label="기간 단위">
      {(Object.keys(PERIOD_UNIT_LABEL) as PeriodUnit[]).map((unit) => (
        <button
          key={unit}
          type="button"
          className={unit === active ? 'is-active' : ''}
          aria-pressed={unit === active}
          disabled={disabled}
          onClick={() => onSelect(unit)}
        >
          {PERIOD_UNIT_LABEL[unit]}
        </button>
      ))}
    </div>
  )
}

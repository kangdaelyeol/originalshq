import { Segmented } from '@/components/glass'
import { PERIOD_UNIT_LABEL, periodUnitOf, type PeriodUnit } from '../utils'
import type { ISODate } from '../types'

/**
 * 일별 / 주차별 / 월별 — 누르면 그 단위의 기본 기간(직전 7일 / 직전 8주 /
 * 이번 달 포함 6개월)을 고른다. 지금 기간이 어느 단위의 기본 기간과 같으면
 * 그 버튼이 켜지고, 날짜를 직접 고른 기간이면 아무것도 켜지지 않는다.
 * xtool-lead-manager 통계 탭과 같은 규칙(defaultRangeOf)·같은 유리 알약이다.
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
  return (
    <Segmented
      options={PERIOD_UNIT_LABEL}
      value={periodUnitOf(dateStart, dateEnd)}
      onChange={onSelect}
      label="기간 단위"
      role="buttons"
      size="md"
      disabled={disabled}
    />
  )
}

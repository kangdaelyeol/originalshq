import { useState } from 'react'
import {
  metricsForDateSubset,
  type CombinedAdset,
  type CombinedCampaign,
  type CombinedInsight,
  type MetricsSummary,
} from '../client'
import { addDays, dateRange, formatMD } from '../utils'
import type { ISODate } from '../types'

export type PeriodTestEntityType = 'campaign' | 'adset'

interface Period {
  id: string
  start: ISODate
  end: ISODate
}

export interface PeriodTestRow {
  id: string
  label: string
  start: ISODate
  end: ISODate
  metrics: MetricsSummary
}

let periodIdSeq = 0
const nextPeriodId = () => `period-${++periodIdSeq}`

/** dateStart~dateEnd를 절반으로 나눈 기본 2구간 — "변경 전/후"를 바로 비교해볼
 * 수 있도록 빈 상태로 시작하지 않는다. 하루짜리 범위처럼 둘로 못 나누면 그
 * 하루 전체를 구간 하나로만 준다. */
function defaultPeriods(dateStart: ISODate, dateEnd: ISODate): Period[] {
  const days = dateRange(dateStart, dateEnd)
  if (days.length < 2) {
    return [{ id: nextPeriodId(), start: dateStart, end: dateEnd }]
  }
  const mid = days[Math.floor(days.length / 2) - 1]
  return [
    { id: nextPeriodId(), start: dateStart, end: mid },
    { id: nextPeriodId(), start: addDays(mid, 1), end: dateEnd },
  ]
}

const clampToRange = (
  value: ISODate,
  dateStart: ISODate,
  dateEnd: ISODate,
): ISODate => (value < dateStart ? dateStart : value > dateEnd ? dateEnd : value)

/** "매체별 테스트" 탭 전용 상태 — 캠페인/애드셋 중 하나를 고르고, 그 안에서
 * 가변 개수의 임의 구간(시작일~종료일)을 추가/삭제/수정하면서 구간별 지표를
 * 비교한다. 전체 요약 탭의 "이전 일정 vs 지정 일정" 표와 같은 재료
 * (metricsForDateSubset)를 쓰되, 구간이 고정 크기가 아니라 사용자가 직접 고른
 * 임의 범위라는 점만 다르다. */
export const usePeriodTestViewModel = (
  combinedInsight: CombinedInsight | null,
  dateStart: ISODate,
  dateEnd: ISODate,
) => {
  const [entityType, setEntityType] = useState<PeriodTestEntityType>('campaign')
  const [entityName, setEntityName] = useState<string | null>(null)
  const [periods, setPeriods] = useState<readonly Period[]>(() =>
    defaultPeriods(dateStart, dateEnd),
  )
  // 구간은 보통 2~4개뿐이라 기본은 "지표를 행으로"(구간이 컬럼) — 지표별
  // 변화를 위아래로 훑기 좋다. 구간이 많아지는 경우엔 반대(구간을 행으로)가
  // 더 편할 수 있어 토글로 바꿀 수 있게 둔다.
  const [transposed, setTransposed] = useState(true)

  const campaigns = combinedInsight?.byCampaign ?? []

  // adset은 이름이 여러 캠페인에 걸쳐 겹칠 수 있어(FullListTable의 "전체
  // 광고셋"과 같은 이유) "campaignName::adsetName" 합성 키로 유일하게 고른다.
  const entityOptions: readonly { key: string; label: string }[] =
    entityType === 'campaign'
      ? campaigns.map((c) => ({ key: c.campaignName, label: c.campaignName }))
      : campaigns.flatMap((c) =>
          c.adsets.map((a) => ({
            key: `${c.campaignName}::${a.adsetName}`,
            label: `${a.adsetName} (${c.campaignName})`,
          })),
        )

  const entity: CombinedCampaign | CombinedAdset | null =
    entityType === 'campaign'
      ? (campaigns.find((c) => c.campaignName === entityName) ?? null)
      : (campaigns
          .flatMap((c) => c.adsets.map((a) => ({ key: `${c.campaignName}::${a.adsetName}`, adset: a })))
          .find((e) => e.key === entityName)?.adset ?? null)

  // entityType이 바뀌거나(캠페인↔애드셋) 그 목록 자체가 바뀌면(재조회 등)
  // 선택을 첫 옵션으로 리셋한다 — 기존 캠페인/adset 탭의 동기화 패턴과 동일.
  const optionsKey = `${entityType}::${entityOptions.map((o) => o.key).join('|')}`
  const [syncedOptionsKey, setSyncedOptionsKey] = useState<string | null>(null)
  if (optionsKey !== syncedOptionsKey) {
    setSyncedOptionsKey(optionsKey)
    setEntityName(entityOptions[0]?.key ?? null)
  }

  // 선택된 entity 자체가 바뀌면(다른 캠페인/adset을 고름) 구간을 새 기본값(절반
  // 2구간)으로 리셋한다 — 이전 entity에서 손보던 구간이 새 entity에 그대로
  // 남아있으면 혼란스럽다.
  const entityKey = entity
    ? entityType === 'campaign'
      ? (entity as CombinedCampaign).campaignName
      : entityName
    : null
  const [syncedEntityKey, setSyncedEntityKey] = useState<string | null>(null)
  if (entityKey !== syncedEntityKey) {
    setSyncedEntityKey(entityKey)
    setPeriods(defaultPeriods(dateStart, dateEnd))
  }

  const addPeriod = () => {
    const last = periods[periods.length - 1]
    const start = last ? clampToRange(addDays(last.end, 1), dateStart, dateEnd) : dateStart
    setPeriods((prev) => [...prev, { id: nextPeriodId(), start, end: dateEnd }])
  }

  const removePeriod = (id: string) => {
    setPeriods((prev) => prev.filter((p) => p.id !== id))
  }

  const updatePeriodStart = (id: string, value: ISODate) => {
    const clamped = clampToRange(value, dateStart, dateEnd)
    setPeriods((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, start: clamped, end: clamped > p.end ? clamped : p.end }
          : p,
      ),
    )
  }

  const updatePeriodEnd = (id: string, value: ISODate) => {
    const clamped = clampToRange(value, dateStart, dateEnd)
    setPeriods((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, end: clamped, start: clamped < p.start ? clamped : p.start }
          : p,
      ),
    )
  }

  const byDate = entity?.combined.byDate ?? []
  const rows: readonly PeriodTestRow[] = periods.map((p) => ({
    id: p.id,
    label: `${formatMD(p.start)}~${formatMD(p.end)}`,
    start: p.start,
    end: p.end,
    metrics: metricsForDateSubset(byDate, (d) => d >= p.start && d <= p.end),
  }))

  return {
    // 입력
    entityType,
    entityName,
    entityOptions,
    periods,
    transposed,
    // 결과
    entity,
    rows,
    // 액션
    setEntityType,
    setEntityName,
    addPeriod,
    removePeriod,
    updatePeriodStart,
    updatePeriodEnd,
    toggleTransposed: () => setTransposed((v) => !v),
  }
}

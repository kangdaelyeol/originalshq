import {
  adEntityKey,
  settingAt,
  type AdEntity,
  type AdEntityKey,
  type AdSettingFields,
  type AdSettingVersion,
  type ConversionGoal,
  type CreativeSet,
} from '../../client'
import { addDays } from '../../utils'
import { FUNNEL_LABEL, formatBudget, won } from '../ad-settings/labels'

/** 설정이 바뀐 날 하나 — 그 날 적용 중인 설정(광고셋은 캠페인 것과 합친 값)을
 * 전날과 견준 칸들. */
export interface SettingEvent {
  date: string
  /** 그 날 시작한 장이 누구 것인지(둘 다일 수 있다). */
  sources: ('campaign' | 'adset')[]
  changes: { label: string; before: string; after: string }[]
  /** 그 날 장들에 적은 바꾼 이유. */
  memo: string
  /** 처음 넣은 장(앞에 설정이 없었다). */
  first: boolean
}

const describe = (
  fields: AdSettingFields,
  goals: ReadonlyMap<string, ConversionGoal>,
  sets: ReadonlyMap<string, CreativeSet>,
): Record<string, string> => ({
  '전환 목표': fields.conversionGoal
    ? (goals.get(fields.conversionGoal)?.label ?? fields.conversionGoal)
    : '',
  '소비 설정 비용': fields.budget ? formatBudget(fields.budget) : '',
  '소재 셋': fields.creativeSetId
    ? (sets.get(fields.creativeSetId)?.name ?? '(지운 셋)')
    : '',
  '목표 단가': fields.targetCpa !== null ? won(fields.targetCpa) : '',
  '목표 ROAS': fields.targetRoas !== null ? `${fields.targetRoas}%` : '',
  퍼널: fields.funnelStage ? FUNNEL_LABEL[fields.funnelStage] : '',
  오디언스: fields.audience,
  '랜딩 URL': fields.landingUrl,
})

/**
 * 대상의 설정 변경일 — 광고셋이면 소속 캠페인의 변경도(비워 둔 칸은 캠페인
 * 설정을 따르니까). 값이 실제로 바뀐 칸만 남기고, 바뀐 게 없는 날(메모만 고친
 * 장 등)은 뺀다.
 */
export function settingEvents(
  entity: AdEntity,
  byEntity: ReadonlyMap<AdEntityKey, AdSettingVersion[]>,
  goals: readonly ConversionGoal[],
  sets: readonly CreativeSet[],
): SettingEvent[] {
  const goalMap = new Map(goals.map((g) => [g.key, g]))
  const setMap = new Map(sets.map((s) => [s.id, s]))
  const own = byEntity.get(entity.key) ?? []
  const parent =
    entity.level === 'adset'
      ? (byEntity.get(
          adEntityKey(entity.channel, 'campaign', entity.campaignId),
        ) ?? [])
      : []
  const dates = [
    ...new Set([...own, ...parent].map((v) => v.effectiveFrom)),
  ].sort()
  const events: SettingEvent[] = []
  for (const date of dates) {
    const before = describe(
      settingAt(entity, byEntity, addDays(date, -1)),
      goalMap,
      setMap,
    )
    const after = describe(settingAt(entity, byEntity, date), goalMap, setMap)
    const changes = Object.keys(after)
      .filter((label) => before[label] !== after[label])
      .map((label) => ({
        label,
        before: before[label] || '없음',
        after: after[label] || '없음',
      }))
    if (changes.length === 0) continue
    const starting = [
      ...own.filter((v) => v.effectiveFrom === date),
      ...parent.filter((v) => v.effectiveFrom === date),
    ]
    events.push({
      date,
      sources: [
        ...(parent.some((v) => v.effectiveFrom === date)
          ? ['campaign' as const]
          : []),
        ...(own.some((v) => v.effectiveFrom === date)
          ? ['adset' as const]
          : []),
      ],
      changes,
      memo: starting
        .map((v) => v.memo)
        .filter(Boolean)
        .join(' · '),
      first: Object.values(before).every((v) => !v),
    })
  }
  return events
}

/** 구간 메모 기본값 — 그 날 바뀐 칸을 짧게("예산 일 3만원 → 5만원"). */
export const summarizeChanges = (event: SettingEvent): string =>
  event.changes
    .slice(0, 2)
    .map((c) => `${c.label} ${c.before} → ${c.after}`)
    .join(', ') +
  (event.changes.length > 2 ? ` 외 ${event.changes.length - 2}` : '')

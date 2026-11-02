import {
  adEntityKey,
  settingAt,
  type AdEntity,
  type AdEntityKey,
  type AdSettingFields,
  type AdSettingVersion,
  type AdTestSegment,
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
  '목표 ROAS':
    fields.targetRoas !== null
      ? `${fields.targetRoas.toLocaleString('ko-KR')}%`
      : '',
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

// ── 설정 이력 → 구간 ────────────────────────────────────────────────────

/** 설정 장 하나가 곧 구간 하나 — 그 장이 적용된 기간과 그 동안의 설정. */
export interface SettingSegment extends AdTestSegment {
  /** baseline = 첫 설정 전(기준), past = 지난 설정, current = 지금 적용 중. */
  status: 'baseline' | 'past' | 'current'
  /** 이 구간을 시작한 변경 — 설정 전 구간이면 null. */
  event: SettingEvent | null
  /** 그 동안 적용된 설정(광고셋은 캠페인 설정과 합친 값) — 설정 전이면 null. */
  setting: AdSettingFields | null
}

/** 첫 설정 전 기준 구간의 길이. */
export const BASELINE_DAYS = 14

/**
 * 설정이 바뀐 날(settingEvents)마다 구간을 자른다 — 매체별 테스트의 구간은 광고
 * 설정의 장 자체다. 앞날로 넣은 장은 아직 성과가 없어 구간이 아니라 예약으로
 * 돌려준다. 마지막(지금 적용 중) 구간은 데이터가 있는 마지막 날까지.
 * withBaseline이면 첫 설정 전 2주(데이터가 있는 만큼)를 "설정 전" 구간으로
 * 앞에 붙인다 — 첫 설정이 효과가 있었는지 견줄 기준.
 */
export function settingSegments(
  entity: AdEntity,
  byEntity: ReadonlyMap<AdEntityKey, AdSettingVersion[]>,
  events: readonly SettingEvent[],
  {
    today,
    firstDay,
    lastDay,
    withBaseline,
  }: {
    today: string
    /** 데이터가 있는 첫날·마지막 날(없으면 null). */
    firstDay: string | null
    lastDay: string | null
    withBaseline: boolean
  },
): { segments: SettingSegment[]; scheduled: SettingEvent[] } {
  const past = events.filter((e) => e.date <= today)
  const scheduled = events.filter((e) => e.date > today)
  const until = lastDay && lastDay < today ? lastDay : today
  const segments: SettingSegment[] = past.map((event, i) => {
    const next = past[i + 1]
    const end = next ? addDays(next.date, -1) : until
    return {
      id: event.date,
      label: `${i + 1}차`,
      start: event.date,
      end: end < event.date ? event.date : end,
      note: summarizeChanges(event),
      status: next ? 'past' : 'current',
      event,
      setting: settingAt(entity, byEntity, event.date),
    }
  })
  const first = past[0]
  if (withBaseline && first && firstDay && firstDay < first.date) {
    const from = addDays(first.date, -BASELINE_DAYS)
    segments.unshift({
      id: 'baseline',
      label: '설정 전',
      start: from > firstDay ? from : firstDay,
      end: addDays(first.date, -1),
      note: `첫 설정(${first.date}) 전 기준`,
      status: 'baseline',
      event: null,
      setting: null,
    })
  }
  return { segments, scheduled }
}

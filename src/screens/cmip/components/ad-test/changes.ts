import {
  adEntityKey,
  platformAt,
  settingAt,
  type AdEntity,
  type AdEntityKey,
  type AdSettingFields,
  type AdSettingVersion,
  type AdTestSegment,
  type ConversionGoal,
  type CreativeSet,
  type PlatformSetting,
  type PlatformSettingFields,
  type PlatformSettingValue,
} from '../../client'
import { addDays } from '../../utils'
import {
  FUNNEL_LABEL,
  PLATFORM_FIELD_LABEL,
  formatBudget,
  platformValue,
  won,
} from '../ad-settings/labels'

type PlatformByEntity = ReadonlyMap<AdEntityKey, PlatformSetting>

const NO_PLATFORM: PlatformSettingFields = {
  budget: null,
  bidding: '',
  targetCpa: null,
  targetRoas: null,
  audience: '',
}

/** 매체 설정 칸 하나의 값을 글자로(지난 변경은 칸 하나만 안다). */
const pastValue = (
  field: keyof PlatformSettingFields,
  value: PlatformSettingValue,
) => platformValue({ ...NO_PLATFORM, [field]: value }, field)

/** 설정이 바뀐 날 하나 — 그 날 적용 중인 설정(광고셋은 캠페인 것과 합친 값)을
 * 전날과 견준 칸들. */
export interface SettingEvent {
  date: string
  /** 그 날 시작한 장이 누구 것인지(둘 다일 수 있다) — 매체 변경만 있는 날은
   * 비어 있다. */
  sources: ('campaign' | 'adset')[]
  changes: { label: string; before: string; after: string }[]
  /** 그 날 장들에 적은 바꾼 이유. */
  memo: string
  /** 처음 넣은 장(앞에 설정이 없었다). */
  first: boolean
  /** 전날과 그 날 고른 소재 — 구간 카드가 새로 넣은 것·뺀 것을 보인다. */
  creatives: { before: string[]; after: string[] }
  /** 그 날 매체 설정이 바뀐 대상(자신·캠페인) — 바뀐 칸은 "매체 예산"처럼
   * changes에. 매체 변경이 없으면 비어 있다. */
  platform: ('campaign' | 'adset')[]
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
  // 고른 소재 — 순서와 상관없이 같은 묶음이면 같은 값(바뀐 날만 구간이 된다).
  소재: fields.creativeIds.length
    ? `${fields.creativeIds.length}개 (${[...fields.creativeIds]
        .sort()
        .map((id) => id.split('_').pop()?.slice(-6) ?? id)
        .join(', ')})`
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

/** 소재 칸의 바뀐 내용 — 몇 개에서 몇 개로, 새로 넣은 것·뺀 것 수(소재 ID는
 * 읽을 수 없어서 칸 비교에만 쓴다). */
const creativeChange = (
  before: readonly string[],
  after: readonly string[],
) => {
  const added = after.filter((id) => !before.includes(id)).length
  const removed = before.filter((id) => !after.includes(id)).length
  const diff = [added && `새로 ${added}`, removed && `뺌 ${removed}`]
    .filter(Boolean)
    .join(' · ')
  return {
    before: before.length ? `${before.length}개` : '없음',
    after: `${after.length ? `${after.length}개` : '없음'}${diff ? ` (${diff})` : ''}`,
  }
}

/**
 * 대상의 설정 변경일 — 광고셋이면 소속 캠페인의 변경도(비워 둔 칸은 캠페인
 * 설정을 따르니까). 값이 실제로 바뀐 칸만 남기고, 바뀐 게 없는 날(메모만 고친
 * 장 등)은 뺀다. 매체 설정(자동 기록)이 바뀐 날도 넣는다 — 손으로 바꾼 날과
 * 겹치면 그 날에 같이 적는다.
 */
export function settingEvents(
  entity: AdEntity,
  byEntity: ReadonlyMap<AdEntityKey, AdSettingVersion[]>,
  goals: readonly ConversionGoal[],
  sets: readonly CreativeSet[],
  platform: PlatformByEntity,
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
    const beforeFields = settingAt(entity, byEntity, addDays(date, -1))
    const afterFields = settingAt(entity, byEntity, date)
    const before = describe(beforeFields, goalMap, setMap)
    const after = describe(afterFields, goalMap, setMap)
    const changes = Object.keys(after)
      .filter((label) => before[label] !== after[label])
      .map((label) =>
        label === '소재'
          ? {
              label,
              ...creativeChange(
                beforeFields.creativeIds,
                afterFields.creativeIds,
              ),
            }
          : {
              label,
              before: before[label] || '없음',
              after: after[label] || '없음',
            },
      )
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
      creatives: {
        before: beforeFields.creativeIds,
        after: afterFields.creativeIds,
      },
      platform: [],
    })
  }

  // 매체 설정이 바뀐 날 — 처음 읽은 줄은 기준이라 뺀다. 광고셋의 캠페인 것은
  // "캠페인 매체 예산"처럼 적는다(광고셋이 캠페인 예산을 쓸 때 등).
  type PlatformSource = [
    PlatformSetting | undefined,
    'campaign' | 'adset',
    string,
  ]
  const platformSources: PlatformSource[] = [
    [platform.get(entity.key), entity.level, '매체'],
    ...(entity.level === 'adset'
      ? [
          [
            platform.get(
              adEntityKey(entity.channel, 'campaign', entity.campaignId),
            ),
            'campaign',
            '캠페인 매체',
          ] as PlatformSource,
        ]
      : []),
  ]
  /** 그 날 사건에 매체 변경 칸을 더한다 — 같은 칸이 그 날 또 바뀌었으면 처음
   * 전 값과 마지막 후 값만 남긴다. */
  const addPlatform = (
    date: string,
    source: 'campaign' | 'adset',
    change: SettingEvent['changes'][number],
  ) => {
    let event = events.find((e) => e.date === date)
    if (!event) {
      const fields = settingAt(entity, byEntity, date)
      event = {
        date,
        sources: [],
        changes: [],
        memo: '',
        first: false,
        // 장은 그대로라 소재도 그대로다.
        creatives: { before: fields.creativeIds, after: fields.creativeIds },
        platform: [],
      }
      events.push(event)
    }
    const same = event.changes.find((c) => c.label === change.label)
    if (same) same.after = change.after
    else event.changes.push(change)
    if (!event.platform.includes(source)) event.platform.push(source)
  }
  for (const [setting, source, prefix] of platformSources) {
    const label = (key: keyof PlatformSettingFields) =>
      `${prefix} ${PLATFORM_FIELD_LABEL[key]}`
    // 처음 읽은 날 전 — 매체 변경 기록에서 읽은 바뀐 칸만(시각 순).
    for (const c of setting?.pastChanges ?? [])
      addPlatform(c.date, source, {
        label: label(c.field),
        before: c.summary ? '' : pastValue(c.field, c.before) || '없음',
        after: pastValue(c.field, c.after) || '없음',
      })
    const history = setting?.history ?? []
    history.forEach((entry, i) => {
      if (i === 0 || entry.changed.length === 0) return
      for (const key of entry.changed)
        addPlatform(entry.from, source, {
          label: label(key),
          before: platformValue(history[i - 1], key) || '없음',
          after: platformValue(entry, key) || '없음',
        })
    })
  }
  return events.sort((a, b) => a.date.localeCompare(b.date))
}

/** 그 날의 매체 설정 — 광고셋이 정하지 않은 칸(캠페인 예산·입찰 전략·목표)은
 * 캠페인 것으로. 읽은 기록이 없으면 null. */
export const platformFieldsAt = (
  entity: Pick<AdEntity, 'key' | 'channel' | 'level' | 'campaignId'>,
  platform: PlatformByEntity,
  date: string,
): PlatformSettingFields | null => {
  const own = platformAt(platform.get(entity.key), date)
  const parent =
    entity.level === 'adset'
      ? platformAt(
          platform.get(
            adEntityKey(entity.channel, 'campaign', entity.campaignId),
          ),
          date,
        )
      : null
  if (!own) return parent
  return {
    budget: own.budget ?? parent?.budget ?? null,
    bidding: own.bidding || parent?.bidding || '',
    targetCpa: own.targetCpa ?? parent?.targetCpa ?? null,
    targetRoas: own.targetRoas ?? parent?.targetRoas ?? null,
    audience: own.audience,
  }
}

/** 구간 메모 기본값 — 그 날 바뀐 칸을 짧게("예산 일 3만원 → 5만원"). 전 값을
 * 모르는 칸(매체 타기팅 조건 추가 등)은 바뀐 내용만. */
export const summarizeChanges = (event: SettingEvent): string =>
  event.changes
    .slice(0, 2)
    .map((c) =>
      c.before
        ? `${c.label} ${c.before} → ${c.after}`
        : `${c.label} ${c.after}`,
    )
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
  /** 구간을 시작한 날의 매체 설정 — 읽은 기록이 없으면 null. */
  platform: PlatformSettingFields | null
}

/** 첫 설정 전 기준 구간의 길이. */
export const BASELINE_DAYS = 14

/**
 * 설정이 바뀐 날(settingEvents)마다 구간을 자른다 — 매체별 테스트의 구간은 광고
 * 설정의 장과 매체 설정이 바뀐 날이다. 앞날로 넣은 장은 아직 성과가 없어 구간이
 * 아니라 예약으로 돌려준다. 마지막(지금 적용 중) 구간은 데이터가 있는 마지막
 * 날까지.
 * withBaseline이면 첫 설정 전 2주(데이터가 있는 만큼)를 "설정 전" 구간으로
 * 앞에 붙인다 — 첫 설정이 효과가 있었는지 견줄 기준.
 */
export function settingSegments(
  entity: AdEntity,
  byEntity: ReadonlyMap<AdEntityKey, AdSettingVersion[]>,
  events: readonly SettingEvent[],
  platform: PlatformByEntity,
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
      platform: platformFieldsAt(entity, platform, event.date),
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
      platform: null,
    })
  }
  return { segments, scheduled }
}

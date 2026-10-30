import type {
  AdBudget,
  AdTestInput,
  AdTestSegment,
  AdSettingVersionInput,
  ConversionGoalInput,
  Creative,
  CreativeFormat,
  CreativeSetInput,
  FunnelStage,
  GoalKpi,
  SaveAdSettingsAction,
} from './types'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ENTITY_KEY = /^(meta|google|naver|openai):(campaign|adset):[^/@]+$/
const GOAL_KEY = /^[a-z][a-z0-9_]{0,31}$/
const KPIS: readonly GoalKpi[] = ['cpa', 'roas', 'cpc', 'cpm', 'ctr', 'cvr']
const FUNNEL: readonly FunnelStage[] = [
  'awareness',
  'consideration',
  'conversion',
]
const FORMATS: readonly CreativeFormat[] = [
  'image',
  'video',
  'carousel',
  'text',
  'other',
]

class Invalid extends Error {}

const record = (v: unknown, what: string): Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new Invalid(`${what}은(는) 객체여야 합니다`)
  }
  return v as Record<string, unknown>
}

const text = (v: unknown, what: string, max = 500): string => {
  if (v === undefined || v === null) return ''
  if (typeof v !== 'string')
    throw new Invalid(`${what}은(는) 문자열이어야 합니다`)
  if (v.length > max)
    throw new Invalid(`${what}은(는) ${max}자 이하여야 합니다`)
  return v.trim()
}

const requiredText = (v: unknown, what: string, max = 100): string => {
  const s = text(v, what, max)
  if (s === '') throw new Invalid(`${what}은(는) 필수입니다`)
  return s
}

const optionalNumber = (v: unknown, what: string): number | null => {
  if (v === undefined || v === null || v === '') return null
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new Invalid(`${what}은(는) 0 이상의 숫자여야 합니다`)
  }
  return v
}

const optionalId = (v: unknown, what: string): string | null => {
  if (v === undefined || v === null || v === '') return null
  if (typeof v !== 'string' || v.includes('/')) {
    throw new Invalid(`${what}이(가) 올바르지 않습니다`)
  }
  return v
}

const isoDate = (v: unknown, what: string): string => {
  // 2026-02-30처럼 넘치는 날짜는 Date가 다음 달로 넘겨 버려서, 되돌린 값이
  // 같은지로 본다.
  if (
    typeof v !== 'string' ||
    !ISO_DATE.test(v) ||
    Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()) ||
    new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v
  ) {
    throw new Invalid(`${what}은(는) YYYY-MM-DD 형식이어야 합니다`)
  }
  return v
}

const budget = (v: unknown): AdBudget | null => {
  if (v === undefined || v === null) return null
  const b = record(v, 'budget')
  const amount = optionalNumber(b.amount, 'budget.amount')
  if (amount === null) throw new Invalid('budget.amount는 필수입니다')
  if (
    b.period !== 'daily' &&
    b.period !== 'lifetime' &&
    b.period !== 'monthly'
  ) {
    throw new Invalid('budget.period는 daily·lifetime·monthly 중 하나입니다')
  }
  return { amount, period: b.period }
}

const version = (v: unknown): AdSettingVersionInput => {
  const x = record(v, 'version')
  if (typeof x.entityKey !== 'string' || !ENTITY_KEY.test(x.entityKey)) {
    throw new Invalid('entityKey는 "채널:단위:ID" 모양이어야 합니다')
  }
  const funnelStage = x.funnelStage ?? null
  if (funnelStage !== null && !FUNNEL.includes(funnelStage as FunnelStage)) {
    throw new Invalid('funnelStage가 올바르지 않습니다')
  }
  return {
    entityKey: x.entityKey,
    effectiveFrom: isoDate(x.effectiveFrom, 'effectiveFrom'),
    conversionGoal: optionalId(x.conversionGoal, 'conversionGoal'),
    budget: budget(x.budget),
    creativeSetId: optionalId(x.creativeSetId, 'creativeSetId'),
    targetCpa: optionalNumber(x.targetCpa, 'targetCpa'),
    targetRoas: optionalNumber(x.targetRoas, 'targetRoas'),
    funnelStage: funnelStage as FunnelStage | null,
    audience: text(x.audience, 'audience'),
    landingUrl: text(x.landingUrl, 'landingUrl'),
    memo: text(x.memo, 'memo', 1000),
  }
}

const goal = (v: unknown): ConversionGoalInput => {
  const x = record(v, 'goal')
  if (!KPIS.includes(x.kpi as GoalKpi)) {
    throw new Invalid(`kpi는 ${KPIS.join('·')} 중 하나입니다`)
  }
  const order = optionalNumber(x.order, 'order') ?? 0
  return {
    label: requiredText(x.label, 'label', 30),
    kpi: x.kpi as GoalKpi,
    order,
    archived: x.archived === true,
  }
}

const creative = (v: unknown, i: number): Creative => {
  const x = record(v, `creatives[${i}]`)
  const format = x.format ?? 'other'
  if (!FORMATS.includes(format as CreativeFormat)) {
    throw new Invalid(`creatives[${i}].format이 올바르지 않습니다`)
  }
  return {
    name: requiredText(x.name, `creatives[${i}].name`),
    format: format as CreativeFormat,
    url: text(x.url, `creatives[${i}].url`, 1000),
    memo: text(x.memo, `creatives[${i}].memo`),
  }
}

const creativeSet = (v: unknown): CreativeSetInput => {
  const x = record(v, 'set')
  const creatives = x.creatives ?? []
  if (!Array.isArray(creatives) || creatives.length > 50) {
    throw new Invalid('creatives는 50개 이하의 배열이어야 합니다')
  }
  return {
    name: requiredText(x.name, 'name'),
    description: text(x.description, 'description', 1000),
    creatives: creatives.map(creative),
  }
}

const docId = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || v === '' || v.includes('/')) {
    throw new Invalid(`${what}이(가) 올바르지 않습니다`)
  }
  return v
}

const MAX_SEGMENTS = 12

const segment = (v: unknown, i: number): AdTestSegment => {
  const x = record(v, `segments[${i}]`)
  const start = isoDate(x.start, `segments[${i}].start`)
  const end = isoDate(x.end, `segments[${i}].end`)
  if (end < start) {
    throw new Invalid(`segments[${i}]의 끝 날짜가 시작 날짜보다 앞입니다`)
  }
  return {
    id: requiredText(x.id, `segments[${i}].id`, 40),
    label: requiredText(x.label, `segments[${i}].label`, 30),
    start,
    end,
    note: text(x.note, `segments[${i}].note`, 300),
  }
}

const test = (v: unknown): AdTestInput => {
  const x = record(v, 'test')
  if (typeof x.entityKey !== 'string' || !ENTITY_KEY.test(x.entityKey)) {
    throw new Invalid('entityKey는 "채널:단위:ID" 모양이어야 합니다')
  }
  const segments = x.segments ?? []
  if (!Array.isArray(segments) || segments.length > MAX_SEGMENTS) {
    throw new Invalid(`segments는 ${MAX_SEGMENTS}개 이하의 배열이어야 합니다`)
  }
  const primaryKpi = x.primaryKpi ?? null
  if (primaryKpi !== null && !KPIS.includes(primaryKpi as GoalKpi)) {
    throw new Invalid(`primaryKpi는 ${KPIS.join('·')} 중 하나입니다`)
  }
  if (x.status !== 'running' && x.status !== 'done') {
    throw new Invalid('status는 running·done 중 하나입니다')
  }
  return {
    entityKey: x.entityKey,
    title: requiredText(x.title, 'title', 60),
    hypothesis: text(x.hypothesis, 'hypothesis', 1000),
    primaryKpi: primaryKpi as GoalKpi | null,
    status: x.status,
    segments: segments.map(segment),
  }
}

/** saveAdSettings 요청 본문 — { action, ... }. */
export function validateSaveAdSettings(
  body: unknown,
): Result<SaveAdSettingsAction> {
  try {
    const x = record(body, '요청 본문')
    switch (x.action) {
      case 'saveVersion':
        return {
          ok: true,
          data: { action: 'saveVersion', version: version(x.version) },
        }
      case 'deleteVersion':
        return {
          ok: true,
          data: { action: 'deleteVersion', id: docId(x.id, 'id') },
        }
      case 'saveGoal': {
        if (typeof x.key !== 'string' || !GOAL_KEY.test(x.key)) {
          throw new Invalid(
            'key는 영문 소문자로 시작하는 32자 이하(a-z·0-9·_)여야 합니다',
          )
        }
        return {
          ok: true,
          data: { action: 'saveGoal', key: x.key, goal: goal(x.goal) },
        }
      }
      case 'saveCreativeSet':
        return {
          ok: true,
          data: {
            action: 'saveCreativeSet',
            id: x.id === null || x.id === undefined ? null : docId(x.id, 'id'),
            set: creativeSet(x.set),
          },
        }
      case 'saveTest':
        return { ok: true, data: { action: 'saveTest', test: test(x.test) } }
      case 'deleteTest': {
        if (typeof x.entityKey !== 'string' || !ENTITY_KEY.test(x.entityKey)) {
          throw new Invalid('entityKey는 "채널:단위:ID" 모양이어야 합니다')
        }
        return {
          ok: true,
          data: { action: 'deleteTest', entityKey: x.entityKey },
        }
      }
      case 'deleteCreativeSet':
        return {
          ok: true,
          data: { action: 'deleteCreativeSet', id: docId(x.id, 'id') },
        }
      default:
        throw new Invalid(
          'action은 saveVersion·deleteVersion·saveGoal·saveCreativeSet·deleteCreativeSet·saveTest·deleteTest 중 하나입니다',
        )
    }
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: error.message }
    throw error
  }
}

/**
 * 광고 설정 클라이언트 — functions-cmip `getAdSettings`(GET)·`saveAdSettings`
 * (POST) 호출과, 받은 설정 기록을 날짜로 푸는 순수 함수.
 *
 * 설정은 캠페인·광고셋마다 적용 시작일(effectiveFrom)이 다른 장으로 쌓인다
 * (functions-cmip/src/ad-settings/types.ts). 어느 날의 설정은 그 날 이전(포함)에
 * 시작한 장 중 가장 늦은 것이고, 앞날로 넣은 장은 예약이다. 광고셋에서 비워 둔
 * 칸은 그 날의 캠페인 설정을 따른다.
 */
import { authFetch } from '@/xtool-auth/auth-fetch'
import { CMIP_API_BASE } from '@/screens/xtool-lead-manager/constants'
import type { ISODate } from '../types'
import { CallableError } from './csv-client'

export type AdChannel = 'meta' | 'google' | 'naver' | 'openai' | 'daangn'
export type AdLevel = 'campaign' | 'adset'

/** "meta:adset:1203…" — 채널·단위·플랫폼 ID. */
export type AdEntityKey = string

export const adEntityKey = (
  channel: AdChannel,
  level: AdLevel,
  platformId: string,
): AdEntityKey => `${channel}:${level}:${platformId}`

/** 동기화된 성과에서 자동으로 모은 캠페인·광고셋 하나. */
export interface AdEntity {
  key: AdEntityKey
  channel: AdChannel
  level: AdLevel
  platformId: string
  name: string
  campaignId: string
  campaignName: string
  firstSeenDate: ISODate
  lastSeenDate: ISODate
  /** Meta 결과 유형 — 전환 목표를 처음 고를 때 참고. */
  platformResultType: string | null
  updatedAt: number
}

export type GoalKpi = 'cpa' | 'roas' | 'cpc' | 'cpm' | 'ctr' | 'cvr'

export interface ConversionGoal {
  key: string
  label: string
  /** 같은 목표끼리 줄 세울 지표. */
  kpi: GoalKpi
  order: number
  archived: boolean
  updatedAt: number
}

export type CreativeFormat = 'image' | 'video' | 'carousel' | 'text' | 'other'

export interface Creative {
  name: string
  format: CreativeFormat
  url: string
  memo: string
}

export interface CreativeSet {
  id: string
  name: string
  description: string
  creatives: Creative[]
  createdAt: number
  updatedAt: number
}

export type BudgetPeriod = 'daily' | 'lifetime' | 'monthly'

export interface AdBudget {
  amount: number
  period: BudgetPeriod
}

export type FunnelStage = 'awareness' | 'consideration' | 'conversion'

/** 설정 한 장의 내용 — null·빈 글자는 "정하지 않음". */
export interface AdSettingFields {
  conversionGoal: string | null
  /** 소비 설정 비용. */
  budget: AdBudget | null
  creativeSetId: string | null
  /** 이 장에서 돌린 소재(adCreatives id) — 바뀐 날이 매체별 테스트의 구간이 된다. */
  creativeIds: string[]
  targetCpa: number | null
  /** 목표 ROAS(%). */
  targetRoas: number | null
  funnelStage: FunnelStage | null
  audience: string
  landingUrl: string
  /** 바꾼 이유. */
  memo: string
}

export interface AdSettingVersion extends AdSettingFields {
  /** {entityKey}@{effectiveFrom} — 같은 대상·같은 시작일은 한 장. */
  id: string
  entityKey: AdEntityKey
  channel: AdChannel
  level: AdLevel
  platformId: string
  effectiveFrom: ISODate
  createdAt: number
  updatedAt: number
}

export interface AdSettingsSnapshot {
  entities: AdEntity[]
  goals: ConversionGoal[]
  creativeSets: CreativeSet[]
  /** 대상·시작일 순. */
  versions: AdSettingVersion[]
  /** 매체별 테스트 — 최근 저장 순. */
  tests: AdTest[]
}

/** 매체별 테스트의 구간 하나. */
export interface AdTestSegment {
  id: string
  label: string
  start: ISODate
  end: ISODate
  /** 이 구간에 무엇이 달랐는지. */
  note: string
}

export type AdTestStatus = 'running' | 'done'

/** 매체별 테스트 — 캠페인·광고셋마다 하나(id = 대상 키), 모두가 같이 본다. */
export interface AdTest {
  id: string
  entityKey: AdEntityKey
  channel: AdChannel
  level: AdLevel
  platformId: string
  /** 저장할 때의 대상 이름. */
  entityName: string
  title: string
  hypothesis: string
  /** null이면 대상 전환 목표의 판단 지표. */
  primaryKpi: GoalKpi | null
  status: AdTestStatus
  /** 시작일 순. */
  segments: AdTestSegment[]
  createdAt: number
  updatedAt: number
}

export type AdTestInput = Pick<
  AdTest,
  'entityKey' | 'title' | 'hypothesis' | 'primaryKpi' | 'status' | 'segments'
>

export interface AdSettingVersionInput extends AdSettingFields {
  entityKey: AdEntityKey
  effectiveFrom: ISODate
}

export type SaveAdSettingsRequest =
  | { action: 'saveVersion'; version: AdSettingVersionInput }
  | { action: 'deleteVersion'; id: string }
  | {
      action: 'saveGoal'
      key: string
      goal: Pick<ConversionGoal, 'label' | 'kpi' | 'order' | 'archived'>
    }
  | {
      action: 'saveCreativeSet'
      /** null이면 새로 만든다. */
      id: string | null
      set: Pick<CreativeSet, 'name' | 'description' | 'creatives'>
    }
  | { action: 'deleteCreativeSet'; id: string }
  | { action: 'saveTest'; test: AdTestInput }
  | { action: 'deleteTest'; entityKey: AdEntityKey }

export const EMPTY_AD_SETTING: AdSettingFields = {
  conversionGoal: null,
  budget: null,
  creativeSetId: null,
  creativeIds: [],
  targetCpa: null,
  targetRoas: null,
  funnelStage: null,
  audience: '',
  landingUrl: '',
  memo: '',
}

const call = async <T>(endpoint: string, init?: RequestInit): Promise<T> => {
  const res = await authFetch(`${CMIP_API_BASE}/${endpoint}`, init)
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(
      `${endpoint} 응답을 해석할 수 없습니다.`,
      res.status,
    )
  }
  if (!res.ok) {
    throw new CallableError(
      (body as { error?: string })?.error ??
        `${endpoint} 호출에 실패했습니다. (HTTP ${res.status})`,
      res.status,
    )
  }
  return body as T
}

export const getAdSettings = async (): Promise<AdSettingsSnapshot> => {
  const body = await call<AdSettingsSnapshot>('getAdSettings')
  // tests는 매체별 테스트와, creativeIds는 소재 칸과 함께 생겼다 — 그 전 서버
  // 응답에는 없다.
  return {
    ...body,
    tests: body.tests ?? [],
    versions: body.versions.map((v) => ({
      ...v,
      creativeIds: v.creativeIds ?? [],
    })),
  }
}

/** 저장·삭제 — 응답은 action마다 { version } · { goal } · { set } · { id, deleted }. */
export const saveAdSettings = <T = unknown>(request: SaveAdSettingsRequest) =>
  call<T>('saveAdSettings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

/** 대상 하나의 하루 성과(플랫폼 수치) — getAdEntityDaily. */
export interface AdEntityDay {
  date: ISODate
  spend: number
  impressions: number
  clicks: number
  conversions: number
  /** 플랫폼이 잡은 전환 가치(매출) — 목표가 문의 등이면 0. */
  revenue: number
}

/** 캠페인·광고셋 하나의 일별 성과(데이터가 있는 날, 날짜 순) — 플랫폼 ID로
 * 그 대상의 행만 읽는다. */
export const getAdEntityDaily = async (
  entityKey: AdEntityKey,
): Promise<AdEntityDay[]> => {
  const body = await call<{ byDate: AdEntityDay[] }>(
    `getAdEntityDaily?${new URLSearchParams({ entityKey }).toString()}`,
  )
  return body.byDate.map((d) => ({
    date: d.date,
    spend: Number(d.spend) || 0,
    impressions: Number(d.impressions) || 0,
    clicks: Number(d.clicks) || 0,
    conversions: Number(d.conversions) || 0,
    revenue: Number(d.revenue) || 0,
  }))
}

// ── 날짜로 풀기 ──────────────────────────────────────────────────────────

/** 대상별 설정 기록(시작일 순) — versions는 받은 그대로(대상·시작일 순). */
export const versionsByEntity = (
  versions: readonly AdSettingVersion[],
): Map<AdEntityKey, AdSettingVersion[]> => {
  const map = new Map<AdEntityKey, AdSettingVersion[]>()
  for (const v of versions) {
    const list = map.get(v.entityKey)
    if (list) list.push(v)
    else map.set(v.entityKey, [v])
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  }
  return map
}

/** 그 날 적용 중인 장(그 대상만) — 그 날 전에 시작한 장이 없으면 null. */
export const versionAt = (
  history: readonly AdSettingVersion[] | undefined,
  date: ISODate,
): AdSettingVersion | null => {
  let found: AdSettingVersion | null = null
  for (const v of history ?? []) {
    if (v.effectiveFrom > date) break
    found = v
  }
  return found
}

/** 광고셋이 비워 둔 칸을 캠페인 설정으로 채운다(글자 칸은 빈 글자면). */
const fillFrom = (
  own: AdSettingFields,
  parent: AdSettingFields,
): AdSettingFields => ({
  conversionGoal: own.conversionGoal ?? parent.conversionGoal,
  budget: own.budget ?? parent.budget,
  creativeSetId: own.creativeSetId ?? parent.creativeSetId,
  creativeIds: own.creativeIds.length ? own.creativeIds : parent.creativeIds,
  targetCpa: own.targetCpa ?? parent.targetCpa,
  targetRoas: own.targetRoas ?? parent.targetRoas,
  funnelStage: own.funnelStage ?? parent.funnelStage,
  audience: own.audience || parent.audience,
  landingUrl: own.landingUrl || parent.landingUrl,
  // 메모는 그 장에 쓴 것만(캠페인 메모를 광고셋 것처럼 보이면 헷갈린다).
  memo: own.memo,
})

/** 그 날 대상에 적용되는 설정 — 광고셋이면 캠페인 설정으로 빈칸을 채운다. */
export const settingAt = (
  entity: Pick<AdEntity, 'key' | 'channel' | 'level' | 'campaignId'>,
  byEntity: ReadonlyMap<AdEntityKey, AdSettingVersion[]>,
  date: ISODate,
): AdSettingFields => {
  const own = versionAt(byEntity.get(entity.key), date) ?? EMPTY_AD_SETTING
  if (entity.level === 'campaign') return own
  const parent =
    versionAt(
      byEntity.get(adEntityKey(entity.channel, 'campaign', entity.campaignId)),
      date,
    ) ?? EMPTY_AD_SETTING
  return fillFrom(own, parent)
}

/** 설정 구간 — 시작일이 바뀌는 날마다 끊는다(바꾸기 전/후 비교용). version이
 * null인 구간은 설정을 넣기 전. 광고셋은 캠페인 장이 바뀌는 날에도 끊는다. */
export interface AdSettingPeriod {
  start: ISODate
  end: ISODate
  setting: AdSettingFields
  /** 이 구간을 연 장 — 대상 자신 또는 (광고셋이면) 캠페인 장. */
  version: AdSettingVersion | null
}

const dayBefore = (date: ISODate): ISODate =>
  new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10)

export const settingPeriods = (
  entity: Pick<AdEntity, 'key' | 'channel' | 'level' | 'campaignId'>,
  byEntity: ReadonlyMap<AdEntityKey, AdSettingVersion[]>,
  start: ISODate,
  end: ISODate,
): AdSettingPeriod[] => {
  const own = byEntity.get(entity.key) ?? []
  const parent =
    entity.level === 'adset'
      ? (byEntity.get(
          adEntityKey(entity.channel, 'campaign', entity.campaignId),
        ) ?? [])
      : []
  const cuts = [...own, ...parent]
    .filter((v) => v.effectiveFrom > start && v.effectiveFrom <= end)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  const starts = [start, ...new Set(cuts.map((v) => v.effectiveFrom))]
  return starts.map((from, i) => ({
    start: from,
    end: i + 1 < starts.length ? dayBefore(starts[i + 1]) : end,
    setting: settingAt(entity, byEntity, from),
    version:
      [...own, ...parent]
        .filter((v) => v.effectiveFrom <= from)
        .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
        .at(-1) ?? null,
  }))
}

/** 장의 상태 — 예약(앞날 시작) · 적용 중 · 지난 장. */
export const versionStatus = (
  history: readonly AdSettingVersion[],
  version: AdSettingVersion,
  today: ISODate,
): 'scheduled' | 'current' | 'past' => {
  if (version.effectiveFrom > today) return 'scheduled'
  return versionAt(history, today)?.id === version.id ? 'current' : 'past'
}

/** 화면의 캠페인·광고셋(이름으로 묶인 성과)에서 목록 대상 찾기 — 성과 데이터는
 * 이름으로 묶여 와서, 같은 채널·이름의 대상을 찾는다(이름이 바뀐 대상은 가장
 * 최근 이름으로 잡힌다). */
export const findAdEntity = (
  entities: readonly AdEntity[],
  channel: AdChannel,
  campaignName: string,
  adsetName: string | null,
): AdEntity | null =>
  entities
    .filter(
      (e) =>
        e.channel === channel &&
        e.campaignName === campaignName &&
        (adsetName === null
          ? e.level === 'campaign'
          : e.level === 'adset' && e.name === adsetName),
    )
    .sort((a, b) => b.lastSeenDate.localeCompare(a.lastSeenDate))[0] ?? null

// ── 소재 ──────────────────────────────────────────────────────────────────

/** 저장한 소재 하나(listAdCreatives) — 매체에서 가져왔거나 직접 올린
 * 이미지·영상. */
export interface AdCreativeView {
  id: string
  /** 보일 이름 — 쓴 광고 이름, 직접 올린 것은 파일 이름. */
  name: string
  channel: AdChannel
  kind: 'video' | 'image'
  /** ready면 원본·프레임이 저장돼 있다. pending은 아직 내려받는 중. */
  status: 'pending' | 'ready' | 'failed'
  error: string | null
  /** 오늘 집행 중인 광고에서 봤는지 — 직접 올린 것은 늘 false(매체가 알려
   * 주지 않는다). */
  active: boolean
  lastSeenDate: ISODate
  /** 이 소재를 쓴 광고(고른 캠페인·광고셋 안의 것만). */
  ads: { id: string; name: string; adsetId: string }[]
  /** 화면에서 직접 올린 소재 — 매체에서 가져온 것은 null. */
  upload: { fileName: string; uploadedBy: string; at: number } | null
  media: {
    width: number | null
    height: number | null
    lengthSec: number | null
    thumbnailUrl: string | null
    originalUrl: string | null
    contentType: string
    /** 분석용 프레임 — 영상 속 시점(초)마다 한 장. */
    frames: { t: number; url: string | null }[]
  } | null
  /** 마지막 분석(analyzeCreative) — 아직 안 했으면 null. */
  analysis: CreativeAnalysis | null
}

/** 소재 분석 — 퍼셉트론 게시본 프롬프트(CREATIVE ANALYSIS) + Claude. */
export interface CreativeAnalysis {
  /** hold: 게이트가 사람 검토로 보냄(Claude를 안 불렀다). */
  status: 'done' | 'hold' | 'failed'
  at: number
  graphVersion: number
  caseId: number
  caseTitle: string
  model: string | null
  result: {
    topic: string
    hook: { firstSeconds: string; technique: string; strength: string }
    message: string
    tone: string
    persona: string
    cta: string
    format: string
    summary: string
    /** 퍼셉트론 프롬프트의 ## output이 요구한 모양(JSON 글). */
    detail: string
  } | null
  error: string | null
  usage: { inputTokens: number; outputTokens: number } | null
  costUsd: number | null
}

/** 캠페인·광고셋 하나의 저장 소재 — 집행 중인 것 먼저. */
export const listAdCreatives = async (
  entityKey: AdEntityKey,
): Promise<AdCreativeView[]> => {
  const body = await call<{ creatives: AdCreativeView[] }>(
    `listAdCreatives?${new URLSearchParams({ entityKey }).toString()}`,
  )
  return body.creatives
}

/** 소재 하나를 분석한다(수십 초, 비용이 든다) — 결과는 소재 문서에도 남는다. */
export const analyzeCreative = (creativeId: string) =>
  call<CreativeAnalysis>('analyzeCreative', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creativeId }),
  })

/** 직접 올릴 수 있는 형식·크기 — 서버(creatives/upload.ts)와 같은 선. */
export const CREATIVE_UPLOAD_TYPES: Record<string, 'video' | 'image'> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
}
export const CREATIVE_UPLOAD_MAX_MB = { video: 200, image: 30 } as const

/**
 * 소재 파일 하나를 직접 올린다 — 서버가 연 Storage 업로드 세션으로 파일을 바로
 * 보내고(함수를 거치지 않아 큰 영상도 된다), 다 오르면 서버가 프레임을 뽑아
 * 소재를 만든다. onProgress는 보낸 비율(0~1), 1이 된 뒤 처리에 수십 초 걸린다.
 */
export const uploadAdCreative = async (
  entityKey: AdEntityKey,
  file: File,
  onProgress: (sent: number) => void,
): Promise<AdCreativeView> => {
  const { creativeId, uploadUrl } = await call<{
    creativeId: string
    uploadUrl: string
  }>('startCreativeUpload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entityKey,
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  })
  // fetch는 올린 비율을 알려 주지 않아 XMLHttpRequest로 보낸다.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new CallableError(
              `파일을 올리지 못했습니다(HTTP ${xhr.status})`,
              xhr.status,
            ),
          )
    xhr.onerror = () =>
      reject(
        new CallableError('파일을 올리지 못했습니다(연결이 끊겼습니다)', 0),
      )
    xhr.send(file)
  })
  return call<AdCreativeView>('finishCreativeUpload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creativeId }),
  })
}

/** 직접 올린 소재를 지운다 — 저장한 장에 들어 있으면 서버가 거절한다(409). */
export const deleteAdCreativeUpload = (creativeId: string) =>
  call<{ deleted: string }>('deleteCreativeUpload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creativeId }),
  })

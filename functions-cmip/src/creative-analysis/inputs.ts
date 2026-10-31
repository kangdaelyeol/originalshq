/**
 * 소재 분석의 실제 입력 — Meta 광고 하나에서 퍼셉트론 입력 노드마다 값을
 * 모은다(영상·문구·타겟팅은 Meta, 성과·설정·테스트는 CMIP DB). 쓰기는 없다.
 * 노드 id와 값 이름은 퍼셉트론 기본 망의 입력 노드·카드 값 줄 이름과 같다 —
 * 조각의 {frames}·{CPA} 같은 자리에 들어간다(prompt-graph/compose.ts fill).
 */
import { getAdEntityDaily, getAdSettingsSnapshot } from '../ad-settings'
import type { AdSettingsSnapshot, AdSettingVersion } from '../ad-settings'
import {
  fetchMetaAdForAnalysis,
  type MetaAdForAnalysis,
} from '../channel/meta/creatives'
import type { DateSummary } from '../channel/meta/types'
import type { ComposeInputs, NodeInput } from '../prompt-graph'

// ── 프레임 계획 ──────────────────────────────────────────────────────────

/** 프레임 긴 변(px) — Claude 이미지 토큰은 가로×세로/750이라 크기가 비용을 정한다. */
export const FRAME_LONG_SIDE = 768
export const MAX_FRAMES = 30
/** 훅(첫 3초)은 촘촘히, 그 뒤는 듬성듬성. */
const HOOK_SEC = 3
const HOOK_STEP = 0.5
const REST_STEP = 1.5

/** 뽑을 시점(초) — 첫 3초는 0.5초마다, 그 뒤 1.5초마다, 최대 30장. */
export const framePlan = (lengthSec: number): number[] => {
  const times: number[] = []
  const end = Math.max(0.1, lengthSec)
  for (let t = 0; t < Math.min(HOOK_SEC, end); t += HOOK_STEP) times.push(t)
  for (let t = HOOK_SEC; t < end; t += REST_STEP) times.push(t)
  return times.slice(0, MAX_FRAMES).map((t) => Math.round(t * 10) / 10)
}

/** 프레임 한 장의 토큰 — 긴 변을 768로 줄인 크기로. 크기를 모르면 9:16로. */
export const frameTokens = (width: number | null, height: number | null) => {
  const w = width || 9
  const h = height || 16
  const k = FRAME_LONG_SIDE / Math.max(w, h)
  return Math.round((w * k * (h * k)) / 750)
}

/** 1080×1920 → '9:16'. 흔한 비율이 아니면 줄인 정수비. */
const ratioOf = (w: number | null, h: number | null) => {
  if (!w || !h) return '—'
  const common: [string, number][] = [
    ['9:16', 9 / 16],
    ['4:5', 4 / 5],
    ['1:1', 1],
    ['16:9', 16 / 9],
  ]
  const hit = common.find(([, r]) => Math.abs(w / h - r) < 0.02)
  if (hit) return hit[0]
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
  const g = gcd(w, h)
  return `${w / g}:${h / g}`
}

// ── 숫자 모양 ────────────────────────────────────────────────────────────

const won = (n: number) => Math.round(n).toLocaleString('ko-KR')
const pct = (n: number) => `${(n * 100).toFixed(2)} %`

const CTA_LABEL: Record<string, string> = {
  LEARN_MORE: '더 알아보기',
  SHOP_NOW: '지금 구매',
  SIGN_UP: '가입하기',
  CONTACT_US: '문의하기',
  APPLY_NOW: '지금 신청',
  GET_QUOTE: '견적 받기',
  SUBSCRIBE: '구독하기',
  BOOK_TRAVEL: '예약하기',
  DOWNLOAD: '다운로드',
  ORDER_NOW: '지금 주문',
  SEND_MESSAGE: '메시지 보내기',
  WATCH_MORE: '더 보기',
}

// ── 성과·설정·테스트 ─────────────────────────────────────────────────────

/** 마지막 데이터 날부터 14일 — 합계와 파생 지표. */
const last14 = (byDate: DateSummary[]) => {
  const days = byDate.slice(-14)
  const sum = days.reduce(
    (a, d) => ({
      spend: a.spend + d.spend,
      clicks: a.clicks + d.clicks,
      impressions: a.impressions + d.impressions,
      conversions: a.conversions + d.conversions,
    }),
    { spend: 0, clicks: 0, impressions: 0, conversions: 0 },
  )
  return { ...sum, days: days.length, end: days[days.length - 1]?.date ?? '' }
}

const today = () => new Date().toISOString().slice(0, 10)

/** 그 날 적용 중인 설정 한 장(시작일이 그 날 이전인 것 중 가장 늦은 것). */
const settingAt = (
  versions: AdSettingVersion[],
  entityKey: string,
  date: string,
) =>
  versions
    .filter((v) => v.entityKey === entityKey && v.effectiveFrom <= date)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
    .pop()

const budgetLabel = (b: AdSettingVersion['budget']) =>
  b
    ? `${b.period === 'daily' ? '일' : b.period === 'monthly' ? '월' : '총'} ${won(b.amount)}`
    : undefined

// ── 모으기 ───────────────────────────────────────────────────────────────

export interface GatheredInputs {
  ad: {
    id: string
    name: string
    adsetId: string
    campaignId: string
    thumbnailUrl: string | null
    hasVideo: boolean
    /** 영상에서 뽑을 시점(초) — 영상이 아니면 빈 배열. */
    frameTimes: number[]
  }
  /** 노드 id별 실제 값 — composeCase에 그대로 넘긴다. */
  inputs: ComposeInputs
  /** 값을 못 모은 이유 등 화면에 보여 줄 한 줄들. */
  notes: string[]
}

/** 정해진 값만 남긴다(undefined는 빼서 '—'로 표시되게). */
const vars = (v: Record<string, string | undefined>) => {
  const out: Record<string, string> = {}
  for (const k of Object.keys(v)) {
    const value = v[k]
    if (value !== undefined && value !== '') out[k] = value
  }
  return out
}

const videoInput = (ad: MetaAdForAnalysis, times: number[]): NodeInput => {
  const v = ad.video
  if (!v) {
    // 이미지 소재 — 한 장.
    return {
      result: '→ image · 1 frame',
      vars: vars({ frames: '1', length: '이미지', name: ad.adName }),
      tokens: frameTokens(1080, 1080),
    }
  }
  const ratio = ratioOf(v.width, v.height)
  return {
    result: `→ ${times.length} frames · ${ratio}`,
    vars: vars({
      frames: String(times.length),
      length: v.lengthSec !== null ? `${v.lengthSec.toFixed(1)} s` : undefined,
      ratio,
      name: ad.adName,
      copy: ad.body.slice(0, 300) || undefined,
      title: ad.title || undefined,
    }),
    tokens: times.length * frameTokens(v.width, v.height),
  }
}

/**
 * Meta 광고 하나의 실제 입력을 모은다 — 광고(문구·영상·타겟팅)는 Meta에서,
 * 14일 성과·광고 설정·매체별 테스트는 그 광고셋 기준으로 CMIP DB에서.
 */
export async function gatherAdInputs(
  adId: string,
  accessToken: string,
): Promise<GatheredInputs> {
  const ad = await fetchMetaAdForAnalysis(adId, accessToken)
  const adsetKey = `meta:adset:${ad.adsetId}`
  const campaignKey = `meta:campaign:${ad.campaignId}`
  const [byDate, snapshot] = await Promise.all([
    getAdEntityDaily('meta', 'adset', ad.adsetId),
    getAdSettingsSnapshot(),
  ])
  const notes: string[] = []
  const times = ad.video?.lengthSec ? framePlan(ad.video.lengthSec) : []
  const inputs: ComposeInputs = {}

  inputs['in:video'] = videoInput(ad, times)
  if (ad.video && ad.video.lengthSec === null)
    notes.push('영상 길이를 받지 못해 프레임 수를 셀 수 없습니다')

  // 14일 성과 — 광고셋.
  const perf = last14(byDate)
  if (perf.days === 0) notes.push('이 광고셋의 동기화된 성과가 없습니다')
  inputs['in:perf'] = {
    result: perf.days
      ? `→ CPA ${perf.conversions ? won(perf.spend / perf.conversions) : '—'} · ${perf.days} d`
      : undefined,
    vars: vars({
      CPA: perf.conversions ? won(perf.spend / perf.conversions) : undefined,
      CTR: perf.impressions ? pct(perf.clicks / perf.impressions) : undefined,
      CVR: perf.clicks ? pct(perf.conversions / perf.clicks) : undefined,
      spend: perf.days ? won(perf.spend) : undefined,
      conversions: perf.days ? String(perf.conversions) : undefined,
    }),
  }

  // 광고 설정 — 광고셋에서 비워 둔 칸은 캠페인 설정을 따른다.
  inputs['in:setting'] = settingInput(snapshot, adsetKey, campaignKey, notes)

  // 매체별 테스트 — 광고셋(없으면 캠페인)에 걸린 것.
  inputs['in:test'] = await testInput(snapshot, adsetKey, campaignKey, byDate)

  // 랜딩·CTA — 광고 문구에서(페이지 로딩 속도는 아직 재지 않는다).
  inputs['in:landing'] = {
    result: ad.cta ? `→ ${CTA_LABEL[ad.cta] ?? ad.cta}` : undefined,
    vars: vars({
      offer: ad.title || undefined,
      cta: ad.cta ? (CTA_LABEL[ad.cta] ?? ad.cta) : undefined,
      link: ad.link || undefined,
    }),
  }

  // 오디언스 — 광고셋 타겟팅.
  const t = ad.targeting
  inputs['in:audience'] = t
    ? {
        result: `→ ${t.narrowed ? '좁힘' : 'broad'} · ${t.countries.join(', ') || '—'}`,
        vars: vars({
          mode: t.narrowed ? '좁힘' : 'broad',
          exclude: t.excluded.length ? t.excluded.join(', ') : '없음',
          geo: t.countries.join(', ') || undefined,
          age:
            t.ageMin || t.ageMax
              ? `${t.ageMin ?? ''}–${t.ageMax ?? ''}`
              : undefined,
        }),
      }
    : { vars: {} }
  if (!t) notes.push('광고셋 타겟팅을 읽지 못했습니다')

  notes.push(
    '브랜드 가이드·소재 라이브러리는 아직 데이터가 없어 카드 값(설정)을 씁니다',
    '특징 질문의 답·신뢰도는 아직 목업입니다 — 3단계(특징·게이트)에서 실제로',
  )

  return {
    ad: {
      id: ad.adId,
      name: ad.adName,
      adsetId: ad.adsetId,
      campaignId: ad.campaignId,
      thumbnailUrl: ad.thumbnailUrl,
      hasVideo: !!ad.video,
      frameTimes: times,
    },
    inputs,
    notes,
  }
}

const settingInput = (
  snapshot: AdSettingsSnapshot,
  adsetKey: string,
  campaignKey: string,
  notes: string[],
): NodeInput => {
  const date = today()
  const own = settingAt(snapshot.versions, adsetKey, date)
  const parent = settingAt(snapshot.versions, campaignKey, date)
  if (!own && !parent) {
    notes.push('이 광고셋·캠페인에 등록한 광고 설정이 없습니다(광고 설정 탭)')
    return { vars: {} }
  }
  const pick = <K extends keyof AdSettingVersion>(k: K) =>
    own && own[k] !== null && own[k] !== '' ? own[k] : parent?.[k]
  const goalKey = pick('conversionGoal') as string | null | undefined
  const goal = snapshot.goals.find((g) => g.key === goalKey)?.label
  const setId = pick('creativeSetId') as string | null | undefined
  const set = snapshot.creativeSets.find((s) => s.id === setId)?.name
  const budget = budgetLabel(
    (pick('budget') as AdSettingVersion['budget']) ?? null,
  )
  return {
    result: goal ? `→ ${goal}` : undefined,
    vars: vars({ goal, budget, set }),
  }
}

const testInput = async (
  snapshot: AdSettingsSnapshot,
  adsetKey: string,
  campaignKey: string,
  adsetDaily: DateSummary[],
): Promise<NodeInput> => {
  const test =
    snapshot.tests.find((x) => x.entityKey === adsetKey) ??
    snapshot.tests.find((x) => x.entityKey === campaignKey)
  if (!test) return { vars: vars({ segments: '0' }) }
  const daily =
    test.entityKey === adsetKey
      ? adsetDaily
      : await getAdEntityDaily('meta', 'campaign', test.platformId)
  // 구간마다 CPA — 가장 싼 구간이 우세, 나머지 평균과의 차이.
  const rows = test.segments.map((seg) => {
    const days = daily.filter((d) => d.date >= seg.start && d.date <= seg.end)
    const spend = days.reduce((a, d) => a + d.spend, 0)
    const conv = days.reduce((a, d) => a + d.conversions, 0)
    return { label: seg.label, cpa: conv ? spend / conv : null }
  })
  const scored = rows.filter(
    (r): r is { label: string; cpa: number } => r.cpa !== null,
  )
  const best = scored.reduce<{ label: string; cpa: number } | null>(
    (b, r) => (!b || r.cpa < b.cpa ? r : b),
    null,
  )
  const others = scored.filter((r) => r !== best)
  const avg = others.length
    ? others.reduce((a, r) => a + r.cpa, 0) / others.length
    : null
  const delta =
    best && avg ? `${(((best.cpa - avg) / avg) * 100).toFixed(1)} %` : undefined
  return {
    result: best ? `→ ${best.label}${delta ? ` · ${delta}` : ''}` : undefined,
    vars: vars({
      segments: String(test.segments.length),
      winner: best?.label,
      delta,
      title: test.title || undefined,
    }),
  }
}

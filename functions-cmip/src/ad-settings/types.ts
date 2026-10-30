import type { ISODate } from '../types'

/**
 * 광고 설정 — 플랫폼에서 가져올 수 없는(또는 채널마다 달라 믿기 어려운) 운영
 * 정보를 캠페인·광고셋마다 손으로 등록한다. 전환 목표가 있어야 "목표가 같은
 * 광고셋끼리" KPI(문의 단가·ROAS 등)를 비교·추적할 수 있다.
 *
 * 컬렉션 네 개:
 *
 *   adEntities/{entityKey}          캠페인·광고셋 목록(자동) — 동기화 때 채운다.
 *   adSettingVersions/{entityKey}@{effectiveFrom}
 *                                   설정 기록 — 적용 시작일마다 한 장(스냅숏).
 *   adConversionGoals/{key}         전환 목표 목록(문의·구매·장바구니 …).
 *   adCreativeSets/{id}             소재 셋 — 여러 광고셋이 같이 쓰는 소재 묶음.
 *   adTests/{entityKey}             매체별 테스트 — 캠페인·광고셋마다 하나, 성과를
 *                                   나눠 볼 구간들(모두가 같이 본다).
 *
 * 설정은 덮어쓰지 않고 적용 시작일(effectiveFrom)이 다른 새 장을 쌓는다. 어느
 * 날의 설정 = 그 날 이전(포함)에 시작한 장 중 가장 늦은 것. 그래서
 *   · 바꾸기 전/후 비교 — 장과 장 사이가 한 구간이다(구간마다 성과를 나눠 본다).
 *   · 예약 — 시작일을 앞날로 넣으면 그 날부터 저절로 적용된다(따로 돌리는
 *     작업 없이, 날짜로만 정해진다).
 */

export type AdChannel = 'meta' | 'google' | 'naver' | 'openai'
export type AdLevel = 'campaign' | 'adset'

/** "meta:adset:1203…" — 채널·단위·플랫폼 ID. 이름은 바뀔 수 있어서 ID로 잇는다. */
export type AdEntityKey = string

export const adEntityKey = (
  channel: AdChannel,
  level: AdLevel,
  platformId: string,
): AdEntityKey => `${channel}:${level}:${platformId}`

/** adEntities — 동기화된 일별 행에서 뽑은 캠페인·광고셋 하나. */
export interface AdEntityDoc {
  channel: AdChannel
  level: AdLevel
  platformId: string
  name: string
  /** 광고셋이면 소속 캠페인(캠페인이면 자기 자신과 같다). */
  campaignId: string
  campaignName: string
  /** 데이터가 처음·마지막으로 잡힌 날 — 지금도 도는지, 언제 시작했는지. */
  firstSeenDate: ISODate
  lastSeenDate: ISODate
  /** Meta가 알려 주는 결과 유형(results[0].indicator) — 전환 목표를 처음 고를 때
   * 참고용. Google·Naver는 없다. */
  platformResultType: string | null
  updatedAt: number
}

export interface AdEntity extends AdEntityDoc {
  key: AdEntityKey
}

/** 성과를 무엇으로 판단하는 목표인지 — 같은 목표끼리 이 지표로 줄 세운다. */
export type GoalKpi = 'cpa' | 'roas' | 'cpc' | 'cpm' | 'ctr' | 'cvr'

/** adConversionGoals — 전환 목표 하나. */
export interface ConversionGoalDoc {
  label: string
  kpi: GoalKpi
  /** 보이는 순서(작은 것 먼저). */
  order: number
  /** 안 쓰게 된 목표 — 이미 붙은 기록이 있어 지우지 않고 숨긴다. */
  archived: boolean
  updatedAt: number
}

export interface ConversionGoal extends ConversionGoalDoc {
  key: string
}

export type CreativeFormat = 'image' | 'video' | 'carousel' | 'text' | 'other'

export interface Creative {
  name: string
  format: CreativeFormat
  /** 소재 파일·미리보기 링크(선택). */
  url: string
  memo: string
}

/** adCreativeSets — 소재 묶음. 소재를 바꾸면 새 셋을 만들어 설정 기록에 새로
 * 붙인다(셋 내용을 고치면 이미 지난 구간의 기록까지 바뀐 것처럼 보인다). */
export interface CreativeSetDoc {
  name: string
  description: string
  creatives: Creative[]
  createdAt: number
  updatedAt: number
}

export interface CreativeSet extends CreativeSetDoc {
  id: string
}

export type BudgetPeriod = 'daily' | 'lifetime' | 'monthly'

/** 소비 설정 비용 — 플랫폼에 걸어 둔 예산. */
export interface AdBudget {
  amount: number
  period: BudgetPeriod
}

/** 깔때기 단계 — 인지(TOFU) · 고려(MOFU) · 전환(BOFU). */
export type FunnelStage = 'awareness' | 'consideration' | 'conversion'

/** 설정 한 장의 내용 — null(빈 글자)은 "정하지 않음". 광고셋에서 정하지 않은
 * 칸은 그 날 캠페인 설정을 따른다(프론트가 합쳐 본다). */
export interface AdSettingFields {
  /** 전환 목표(adConversionGoals의 key). */
  conversionGoal: string | null
  /** 소비 설정 비용. */
  budget: AdBudget | null
  /** 소재 셋(adCreativeSets의 id). */
  creativeSetId: string | null
  /** 목표 전환 단가(원) — 이보다 비싸면 경고 대상. */
  targetCpa: number | null
  /** 목표 ROAS(%). */
  targetRoas: number | null
  funnelStage: FunnelStage | null
  /** 타깃 오디언스 메모(관심사·연령·리타깃 등). */
  audience: string
  /** 랜딩 페이지 URL. */
  landingUrl: string
  /** 바꾼 이유·메모 — 나중에 전후를 비교할 때 왜 바꿨는지. */
  memo: string
}

/** adSettingVersions — 설정 한 장. 문서 ID가 {entityKey}@{effectiveFrom}이라
 * 같은 날 시작하는 장은 하나뿐이다(같은 날 다시 저장하면 그 장을 고친다). */
export interface AdSettingVersionDoc extends AdSettingFields {
  entityKey: AdEntityKey
  channel: AdChannel
  level: AdLevel
  platformId: string
  /** 이 날부터 적용(포함). 다음 장의 시작일 전날까지. */
  effectiveFrom: ISODate
  createdAt: number
  updatedAt: number
}

export interface AdSettingVersion extends AdSettingVersionDoc {
  id: string
}

export interface AdSettingsSnapshot {
  entities: AdEntity[]
  goals: ConversionGoal[]
  creativeSets: CreativeSet[]
  versions: AdSettingVersion[]
  tests: AdTest[]
}

// ── 매체별 테스트 ────────────────────────────────────────────────────────

/** 테스트 구간 하나 — 이 날들의 성과를 묶어 다른 구간과 견준다. */
export interface AdTestSegment {
  /** 화면에서 줄을 구분하는 값(저장된 뒤에도 그대로). */
  id: string
  label: string
  start: ISODate
  end: ISODate
  /** 이 구간에 무엇이 달랐는지(소재 B안, 예산 증액 등). */
  note: string
}

export type AdTestStatus = 'running' | 'done'

/** adTests/{entityKey} — 캠페인·광고셋 하나의 테스트. 대상마다 하나라 문서
 * ID가 대상 키다(같은 대상을 다시 저장하면 그 테스트를 고친다). */
export interface AdTestDoc {
  entityKey: AdEntityKey
  channel: AdChannel
  level: AdLevel
  platformId: string
  /** 저장할 때의 대상 이름 — 목록에 바로 보이게(이름은 adEntities가 따라간다). */
  entityName: string
  title: string
  /** 가설·메모 — 무엇을 확인하려는 테스트인지. */
  hypothesis: string
  /** 승패를 가를 지표 — null이면 그 대상 전환 목표의 판단 지표를 따른다. */
  primaryKpi: GoalKpi | null
  status: AdTestStatus
  /** 시작일 순. */
  segments: AdTestSegment[]
  createdAt: number
  updatedAt: number
}

export interface AdTest extends AdTestDoc {
  id: string
}

export type AdTestInput = Pick<
  AdTestDoc,
  'entityKey' | 'title' | 'hypothesis' | 'primaryKpi' | 'status' | 'segments'
>

// ── 저장 요청(saveAdSettings) ──────────────────────────────────────────────

export type SaveAdSettingsAction =
  | { action: 'saveVersion'; version: AdSettingVersionInput }
  | { action: 'deleteVersion'; id: string }
  | { action: 'saveGoal'; key: string; goal: ConversionGoalInput }
  | { action: 'saveCreativeSet'; id: string | null; set: CreativeSetInput }
  | { action: 'deleteCreativeSet'; id: string }
  | { action: 'saveTest'; test: AdTestInput }
  | { action: 'deleteTest'; entityKey: AdEntityKey }

export interface AdSettingVersionInput extends AdSettingFields {
  entityKey: AdEntityKey
  effectiveFrom: ISODate
}

export type ConversionGoalInput = Pick<
  ConversionGoalDoc,
  'label' | 'kpi' | 'order' | 'archived'
>

export type CreativeSetInput = Pick<
  CreativeSetDoc,
  'name' | 'description' | 'creatives'
>

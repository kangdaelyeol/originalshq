import type {
  AdChannel,
  AdEntityKey,
  AdLevel,
  PlatformPastChange,
  PlatformSettingFields,
} from '../ad-settings/types'

export const AD_PLATFORM_SETTINGS = 'adPlatformSettings'

/** 매체에서 지금 읽은 대상 하나의 설정 — 집행 중인 캠페인·광고셋만 읽는다. */
export interface PlatformReading {
  entityKey: AdEntityKey
  channel: AdChannel
  level: AdLevel
  platformId: string
  name: string
  fields: PlatformSettingFields
}

/** 매체 변경 기록에서 읽은 지난 변경 하나와 그 대상. */
export interface PastChangeReading extends Omit<PlatformReading, 'fields'> {
  change: PlatformPastChange
}

export interface PlatformSettingsResult {
  /** 이번에 읽은 대상 수. */
  entities: number
  /** 처음 읽은 대상(기준 줄을 만든 것). */
  added: number
  /** 설정이 바뀐 대상. */
  changed: number
  /** 매체 변경 기록에서 새로 넣은 지난 변경 수(변경 기록이 없는 매체는 없다). */
  pastAdded?: number
}

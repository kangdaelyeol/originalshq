import type { Period } from '../period'
import type { TechBoardDoc, TechBoardKey } from '../tech-boards'
import { asRequestsKpis } from './as-requests'
import { fieldServiceKpis } from './field-service'
import { inquiryKpis } from './inquiry'
import { partsKpis } from './parts'
import { rentalsKpis } from './rentals'
import { repairKpis } from './repair'
import { serialsKpis } from './serials'
import { taskKpis } from './task'
import type { KpiCard } from './types'

// 보드 숫자 카드 네 장 — 보드마다 세는 법은 같은 폴더의 파일에 있고(표가 같이 쓰는 기준도 거기), 여기서는 키로 고른다.

export type { KpiCard, KpiIcon, KpiTint, KpiTone } from './types'

type CountKpis<K extends TechBoardKey> = (doc: TechBoardDoc<K>, period: Period, today: string) => KpiCard[]

const BOARD_KPIS: { [K in TechBoardKey]: CountKpis<K> } = {
  fieldService: fieldServiceKpis,
  repair: repairKpis,
  techInquiry: inquiryKpis,
  techTask: taskKpis,
  asRequests: asRequestsKpis,
  parts: partsKpis,
  rentals: rentalsKpis,
  serials: serialsKpis,
}

/**
 * 보드 하나의 숫자 카드 — 기간(… 완료 등)과 오늘(한국 날짜)로 센다. 키와 doc이 같은 보드라는 것은 부르는 쪽이
 * 맞춘다(useTechBoard(key).board를 넘긴다).
 */
export const boardKpis = (key: TechBoardKey, doc: TechBoardDoc, period: Period, today: string): KpiCard[] =>
  (BOARD_KPIS[key] as unknown as CountKpis<TechBoardKey>)(doc, period, today)

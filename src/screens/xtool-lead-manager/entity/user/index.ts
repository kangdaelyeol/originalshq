import type { Timestamp } from '../../types'
import type { Contact } from './contact'

export interface User {
  userId: string
  phone: string[] // PK
  orgName?: string
  nameRaw: string[]
  email: string[]
  aliases: string[]
  // 대표 주소 및 우편번호
  address?: string
  postalCode?: string

  /* ── 롤업: 리스트 화면이 users 컬렉션만 읽고 끝나도록 ── */
  lastContactAt?: Timestamp
  lastPurchaseAt?: Timestamp
  lifetimeValue: number // KRW

  /* ── 병합 이력 ── */
  mergedFrom: string[] // 흡수한 userId 목록
  canonicalUserId?: string // 이 문서가 패자면 승자 포인터 (tombstone)

  /** 이 유저를 만든 모든 원본 */
  sourceRefs: string[] // ["mon_1234_5678", ...]

  createdAt: Timestamp
  updatedAt: Timestamp
  contacts: Contact[]
}

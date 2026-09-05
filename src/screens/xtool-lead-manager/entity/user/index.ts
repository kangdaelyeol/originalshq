import type { Timestamp } from '../../types'
import type { OnlineContact } from './contact'

export interface User {
  userId: string
  phones: string[] // PK
  orgName?: string
  nameRaw: string[]
  contacts: OnlineContact[]
  emails: string[]
  aliases: string[]

  /** phones 기준 결정적 파생값. buildExternalId() 참조 */
  externalId?: string
  /** fn/ln 전송 가능 여부. 회사명뿐이거나 미결이면 false */
  nameSendable: boolean

  addresses?: string

  /* ── 롤업: 리스트 화면이 users 컬렉션만 읽고 끝나도록 ── */
  stage?: 'lead' | 'consulting' | 'experienced' | 'customer' | 'churned'
  lastContactAt?: Timestamp
  lastPurchaseAt?: Timestamp
  purchaseCount: number
  lifetimeValue: number // KRW
  asOpenCount: number
  tags: string[] // "B2B", "지원사업", "제주" 등

  /* ── 병합 이력 ── */
  mergedFrom: string[] // 흡수한 userId 목록
  canonicalUserId?: string // 이 문서가 패자면 승자 포인터 (tombstone)

  /** 이 유저를 만든 모든 원본 */
  sourceRefs: string[] // ["mon_1234_5678", ...]

  createdAt: Timestamp
  updatedAt: Timestamp
}

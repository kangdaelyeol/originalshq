import type { CardRecord } from '../entity/card'

// 지금은 예시 데이터 — 다음 단계에서 Firebase Realtime Database의
// `card/{cardId}` 조회로 바꾼다. 화면은 getCard만 쓰므로 이 파일만 바꾸면 된다.
const SAMPLE_CARDS: Record<string, CardRecord> = {
  abcd: {
    title: '내 차',
    phone: '01012345678',
    theme: 'mint',
    layout: 'b',
    custom: {
      accent: '#22c55e',
      scale: 1.1,
      message: '잠시 정차 중입니다. 연락 주세요',
    },
    updatedAt: 1793000000000,
    deviceId: 'PK-000123',
    ownerList: { uidA1b2c3: true },
  },
  // 예전 카드 + 규칙에 맞지 않는 저장값 — 관리자 화면에서 어떻게 보이는지 확인용.
  abce: {
    title: '회사 차',
    phone: '02-123-4567',
    theme: 'neon',
    layout: 'z',
    custom: { accent: 'blue', scale: 2 },
    message: '예전 위치의 메시지',
    updatedAt: '2026-09-30T09:12:00+09:00',
    ownerList: ['uidX', 'uidY'],
  },
}

/** 카드 1장 — 없으면(등록 전) null. */
export const getCard = async (cardId: string): Promise<CardRecord | null> => {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return SAMPLE_CARDS[cardId] ?? null
}

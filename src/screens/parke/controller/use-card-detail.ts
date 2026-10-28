import { useEffect, useState } from 'react'
import { getCard } from '../client/card-client'
import { normalizeCard, type ParkeCard } from '../entity/card'

type Result =
  | { cardId: string; status: 'ready'; card: ParkeCard | null }
  | { cardId: string; status: 'error' }

/**
 * 상세 모달이 보여줄 카드 1장. 시리얼이 바뀌면 다시 받고, 늦게 도착한 앞
 * 시리얼의 응답은 버린다. card가 null이면 등록되지 않은 Parké.
 */
export const useCardDetail = (cardId: string) => {
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const record = await getCard(cardId)
        if (!active) return
        setResult({
          cardId,
          status: 'ready',
          card: record ? normalizeCard(cardId, record) : null,
        })
      } catch {
        if (active) setResult({ cardId, status: 'error' })
      }
    })()
    return () => {
      active = false
    }
  }, [cardId])

  // 다른 시리얼의 결과가 남아 있으면 아직 불러오는 중으로 본다.
  if (!result || result.cardId !== cardId) {
    return { status: 'loading' as const, card: null }
  }
  return result.status === 'ready'
    ? { status: 'ready' as const, card: result.card }
    : { status: 'error' as const, card: null }
}

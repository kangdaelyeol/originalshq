import { useEffect } from 'react'
import { getLeadState, type Lead } from '@/screens/xtool-lead-manager/entity'

const byLatest = <T extends { at: number }>(records: readonly T[] = []): T[] =>
  [...records].sort((a, b) => b.at - a.at)

/*
 * 고객 상세 모달 컨트롤러.
 *
 * 모달이 떠 있는 동안의 동작(배경 스크롤 잠금, Esc로 닫기)과, 화면에 그리기
 * 전에 필요한 파생값(상태, 최신순으로 정렬한 접수/상담/구매 이력)을 다룬다.
 */
export const useDetailViewModel = (lead: Lead, onClose: () => void) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return {
    state: {
      leadState: getLeadState(lead),
      // 마이그레이션 전의 옛 리드 문서엔 이 배열 필드 자체가 없을 수 있어
      // byLatest가 빈 배열을 기본값으로 둔다.
      intakes: byLatest(lead.intakes),
      consultations: byLatest(lead.consultations),
      purchases: byLatest(lead.purchases),
    },
  }
}

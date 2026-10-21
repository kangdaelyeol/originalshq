import { koreaDate, pick, source } from './fields'
import { MondayBoardKind, MondayGaConsultation, MondayItem } from './types'

/** Monday의 GA ClientId 값을 GA4 BigQuery의 user_pseudo_id 형식("숫자.숫자")으로
 * 맞춘다. 폼은 "GA_123.456"으로 적고, _ga 쿠키 원문이면 "GA1.1.123.456"이다.
 * 형식이 맞지 않으면 null. */
export const normalizeGaClientId = (raw: string | null): string | null => {
  if (!raw) return null
  const value = raw
    .trim()
    .replace(/^GA_/i, '')
    .replace(/^GA\d+\.\d+\./i, '')
  return /^\d+\.\d+$/.test(value) ? value : null
}

/**
 * GA ClientId가 적힌 상담 기록(순수 함수) — "오기입 추적" 탭이 이 목록의 id로
 * GA4 BigQuery 이벤트를 찾는다. 오기입은 전화번호가 틀린 경우가 많아 통합
 * 고객에서 빠지므로, 고객이 아니라 상담 보드의 item에서 바로 모은다.
 */
export const buildGaConsultations = (
  items: MondayItem[],
  kindByBoardId: Map<string, MondayBoardKind>,
): MondayGaConsultation[] =>
  items.flatMap((item): MondayGaConsultation[] => {
    if (kindByBoardId.get(item.boardId) !== 'consultation') return []
    const gaClientId = normalizeGaClientId(pick(item, /^gaclientid$/i))
    if (!gaClientId) return []
    const status = pick(item, /^상담진행상태$/)
    return [
      {
        ...source(item),
        phoneRaw: item.phoneRaw,
        status,
        misentry: status !== null && /오기입/.test(status),
        receivedAt: koreaDate(pick(item, /^접수일$/)),
        gaClientId,
      },
    ]
  })

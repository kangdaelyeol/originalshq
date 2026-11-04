/**
 * 주소 검색 오류 → 읽을 말. 함수(techSearchAddress)가 보낸 한국어 메시지("주소를 찾지 못했어요…")는 그대로
 * 쓰고, 연결 끊김·에뮬레이터(함수 없음)처럼 메시지가 "internal"·"unavailable" 같은 코드 낱말뿐이면 바꿔 쓴다.
 * 주소 칸(LocationInput — 대시보드 편집 판·Monday 표 팝오버)과 물 주소 칸이 같이 쓴다.
 */
export function addressErrorText(e: unknown): string {
  const message = e instanceof Error ? e.message.replace(/\s*\[\d+\]$/, '').trim() : ''
  const bare = /^(functions\/)?(internal|unavailable|deadline-exceeded|unknown|not-found)$/i
  if (!message || bare.test(message)) return '주소 검색이 지금 안 돼요. 잠시 뒤 다시 찾아 주세요.'
  return message
}

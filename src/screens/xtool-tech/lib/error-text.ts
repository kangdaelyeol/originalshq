// 오류 → 읽을 문구 — 저장 대기열 토스트(tech-outbox)·파일 칸(tech-file-actions·use-file-column)·업데이트
// (use-item-updates)·설정 화면·주소 칸이 같이 쓴다. 함수(Firebase Functions) SDK는 오류 문구 끝에 상태 번호
// 꼬리표(" [500]")를 붙이니 그것은 뗀다. 자리마다 다른 것(겹친 꼬리표·대신 쓸 문장)은 옵션으로 준다.

// 끝의 꼬리표 하나 · 겹친 꼬리표 전부(함수가 보낸 문구에 이미 꼬리표가 있으면 " [404] [404]"처럼 겹친다)
const STATUS_TAIL = /\s*\[\d+\]$/
const STATUS_TAILS = /(\s*\[\d+\])+$/

interface ErrorTextOptions {
  /** 겹친 꼬리표까지 다 뗀다(저장 대기열 토스트) — 기본은 끝의 하나만 */
  allTails?: boolean
  /**
   * 문구가 비었거나 코드(internal)뿐일 때 대신 쓸 문장 — 함수가 문구 없이 실패하면 코드만 온다. 안 주면 꼬리표만
   * 뗀 문구를 그대로 쓴다.
   */
  fallback?: string
}

/** 오류 → 문구. Error면 message, 아니면 글자로 바꾼 뒤 끝의 상태 번호 꼬리표를 뗀다. */
export function errorText(error: unknown, { allTails = false, fallback }: ErrorTextOptions = {}): string {
  const message = (error instanceof Error ? error.message : String(error)).replace(allTails ? STATUS_TAILS : STATUS_TAIL, '')
  if (fallback === undefined) return message
  return message && !/^internal$/i.test(message) ? message : fallback
}

// 주소 검색이 코드 낱말만 보낼 때 — 연결 끊김·에뮬레이터(함수 없음) 등
const ADDRESS_CODES = /^(functions\/)?(internal|unavailable|deadline-exceeded|unknown|not-found)$/i

/**
 * 주소 검색 오류 → 읽을 말. 함수(techSearchAddress)가 보낸 한국어 메시지("주소를 찾지 못했어요…")는 그대로
 * 쓰고, 연결 끊김·에뮬레이터(함수 없음)처럼 메시지가 "internal"·"unavailable" 같은 코드 낱말뿐이면 바꿔 쓴다.
 * 앞뒤 빈칸은 떼고, Error가 아닌 것은 메시지로 보지 않는다. 주소 칸(LocationInput — 대시보드 편집 판·Monday 표
 * 팝오버)과 물 주소 칸이 같이 쓴다.
 */
export function addressErrorText(e: unknown): string {
  const message = e instanceof Error ? errorText(e).trim() : ''
  if (!message || ADDRESS_CODES.test(message)) return '주소 검색이 지금 안 돼요. 잠시 뒤 다시 찾아 주세요.'
  return message
}

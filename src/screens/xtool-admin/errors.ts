const errorCode = (e: unknown): string => (e as { code?: string }).code ?? ''

export function firestoreErrorMessage(e: unknown): string {
  switch (errorCode(e)) {
    case 'permission-denied':
      return '권한이 없어요. 관리자 계정인지, 보안 규칙이 배포됐는지 확인해 주세요.'
    case 'unavailable':
      return '서버에 연결할 수 없어요. 네트워크를 확인해 주세요.'
    case 'not-found':
      return '이미 지워진 구성원이에요.'
    default:
      return '저장하지 못했어요. 잠시 후 다시 해 주세요.'
  }
}

/** 마지막 로그인 — 방금 · 5분 전 · 3시간 전 · 2일 전 · 10. 3. */
export function relativeTime(ms: number, now = Date.now()): string {
  const minutes = Math.floor((now - ms) / 60_000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일 전`
  return new Date(ms).toLocaleDateString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' })
}

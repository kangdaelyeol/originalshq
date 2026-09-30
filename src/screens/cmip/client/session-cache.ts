/**
 * 세션 스토리지 기반 캐시 — 채널 인사이트 조회(useChannelInsightViewModel)가
 * 같은 (dateStart, dateEnd)를 다시 조회할 때 Meta/Google/Naver 라이브 API를
 * 또 호출하지 않고 재사용하는 용도. sessionStorage라 탭을 닫으면 자연히
 * 사라지고(OLAP 배치 동기화가 못 따라가는 "최근 7일 라이브 구간"만 세션
 * 동안 잠깐 들고 있는 셈), 새로고침 버튼(refresh)은 이 캐시를 무시하고 강제로
 * 다시 fetch한다.
 *
 * private 브라우징/저장공간 초과 등으로 sessionStorage 접근이 실패할 수 있어
 * 모든 호출을 try/catch로 감싼다 — 캐시는 있으면 좋고 없어도 정상 동작에
 * 지장이 없어야 한다(항상 fetch로 폴백).
 */
const PREFIX = 'cmip:insight-cache:'

export function readSessionCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeSessionCache<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // 용량 초과 등은 조용히 무시 — 다음 조회는 그냥 다시 fetch한다.
  }
}

// Monday 표의 색(웹·앱 같이 씀) — 보드 캐시에는 상태 라벨의 색이 없어서(라벨 글자만 온다) 라벨 뜻으로 Monday
// 기본 색을 고르고, 뜻을 모르는 라벨은 글자로 정한 색을 쓴다(같은 라벨은 늘 같은 색).

// Monday 라벨 팔레트(다크 모드에서 보이는 값)
const DONE = '#00c875'
const WORKING = '#fdab3d'
const STUCK = '#df2f4a'
const CONFIRMED = '#579bfc'
/** 빈 칸·신규 — Monday 다크 모드의 회색 라벨 */
export const NEUTRAL = '#6e7287'
// 뜻을 모르는 라벨 — 완료·멈춤으로 읽힐 초록·빨강은 뺀다.
const OTHERS = ['#a25ddc', '#66ccff', '#ff5ac4', '#9cd326', '#784bd1', '#ff642e', '#0086c0', '#cab641']

const hashOf = (text: string) => {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

/** 상태 라벨 색 */
export function labelColor(label: string | null | undefined): string {
  const text = (label ?? '').replace(/\s/g, '')
  if (!text) return NEUTRAL
  if (/완료|해결|반납|종료|처리됨|done/i.test(text)) return DONE
  if (/보류|취소|불가|반려|지연|문제|stuck/i.test(text)) return STUCK
  if (/신규|접수/.test(text)) return NEUTRAL
  if (/진행|작업|조율|확인|대기|처리중|working/i.test(text)) return WORKING
  if (/확정|예정|배정/.test(text)) return CONFIRMED
  return OTHERS[hashOf(text) % OTHERS.length]
}

// 그룹 막대·제목 색 — Monday가 새 그룹에 주는 차례대로
const GROUP_COLORS = ['#579bfc', '#a25ddc', '#00c875', '#fdab3d', '#e2445c', '#66ccff', '#ff5ac4', '#9cd326', '#784bd1', '#ff642e']

export const groupColor = (index: number): string => GROUP_COLORS[index % GROUP_COLORS.length]

// 사람 구분용 장식 색 — 이름으로 정해져서 어느 화면에서 봐도 같은 사람은 같은 색
// (사이드바 직원 목록의 점, Monday 표의 담당자 동그라미).
const PERSON_COLORS = ['#3a9ae6', '#de6a30', '#1fa878', '#9a7cf2', '#eda12a', '#e5609a', '#38b6c4', '#b8c24a']

export const personColor = (name: string): string => {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PERSON_COLORS[h % PERSON_COLORS.length]
}

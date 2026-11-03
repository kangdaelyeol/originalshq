// 사람 구분용 장식 색 — 이름으로 정해져서 어느 화면에서 봐도 같은 사람은 같은 색
// (사이드바 직원 목록의 점, Monday 표의 담당자 동그라미).
const PERSON_COLORS = ['#3a9ae6', '#de6a30', '#1fa878', '#9a7cf2', '#eda12a', '#e5609a', '#38b6c4', '#b8c24a']

export const personColor = (name: string): string => {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PERSON_COLORS[h % PERSON_COLORS.length]
}

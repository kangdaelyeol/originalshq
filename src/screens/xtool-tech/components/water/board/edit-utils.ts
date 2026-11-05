// 물 편집 칸이 같이 쓰는 작은 도구 — 담당자 동그라미 색(물 벽에 맞춘 차분한 색표라 lib/person-color와 따로 둔다).
// 한국 지금 시각(koreaNow)은 lib/dates.

/**
 * 담당자 동그라미 색 — 이름으로 늘 같은 색(사람 구분용 장식). 회색 벽 위에서 흰 이름 글자가 읽히는 중간
 * 밝기의 차분한 색(기본 부품 견본 WaterAvatar와 같은 계열)
 */
const PERSON_COLORS = [
  '#5b7fb8',
  '#3c8a63',
  '#b07a2a',
  '#7d8fa6',
  '#8a6fae',
  '#b0625c',
  '#4f8f8f',
]

export function personColor(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PERSON_COLORS[h % PERSON_COLORS.length]
}

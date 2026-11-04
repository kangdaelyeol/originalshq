// 편집 칸(물)이 같이 쓰는 작은 도구 — 기존 item-editor.tsx의 것과 같은 규칙(그쪽은 내보내지 않아 옮겨 둔다).

/** 한국 지금 시각 — 날짜(YYYY-MM-DD)와 시각(HH:MM) */
export const koreaNow = () => {
  const iso = new Date(Date.now() + 9 * 3600_000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

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

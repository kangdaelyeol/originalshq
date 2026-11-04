// Monday 테마 — 유리 대신 Monday 판·선·버튼 모양(styles/themes/_monday.scss)과 색 셋(_monday-palettes.scss).
// ThemeRoot theme="monday" palette=...로 고른다.

/** Monday 테마의 색 — 남색(Monday 다크) · 라이트 · 블랙(Monday 나이트) */
export type MondayPalette = 'navy' | 'light' | 'black'

export const MONDAY_PALETTES: readonly { value: MondayPalette; label: string; swatch: [string, string, string] }[] = [
  // 견본: 바탕 · 칸 · 선택(_monday-palettes.scss의 --mon-bg · --mon-surface · --mon-chip과 같게)
  { value: 'navy', label: '남색', swatch: ['#18192d', '#2b2c44', '#192f67'] },
  { value: 'light', label: '라이트', swatch: ['#ffffff', '#f5f6fa', '#cce5ff'] },
  { value: 'black', label: '블랙', swatch: ['#121212', '#272727', '#192f67'] },
]

/** Monday 글꼴(Figtree) — 테마를 고를 때 한 번만 불러온다(index.html은 다른 화면과 같이 써서 손대지 않는다). */
export const FIGTREE_HREF = 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap'

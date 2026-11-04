import type { ShareItem } from '../../charts/share-bar'

// 물 차트 색 — 바탕은 D7 회색 벽(#c7c5ca, 홈 바닥 #b0aeb3). 물 디자인은 거의 무채색이라 한 계열·강조는 어두운
// 알약(D7 표시 알약)과 흰 칩으로, 범주가 여럿일 때만 색을 쓴다.
//
// 범주 색은 dataviz 스킬 scripts/validate_palette.js로 회색 벽 위에서 고르고 검사했다(--mode light).
// - 앞 셋(파랑·녹슨 주황·초록): OKLCH L 0.44~0.58·C 0.105~0.155를 훑어 모든 쌍(--pairs all)을 통과하는 것 중
//   채도가 가장 낮은 조합 — 모든 쌍 CVD ΔE 8.1 · 정상 시각 17.8 · 벽 대비 3:1 이상 PASS. 청록(aqua)은 이 벽 위에서
//   3:1을 넘는 sRGB 색이 없어 초록으로 바꿨다.
// - 넷째~여섯째(보라·황토·자두): 앞 셋은 그대로 두고 보라·황토·장미 계열(L 0.42~0.6·C 0.105~0.145)을 훑어, 이웃
//   쌍(--pairs adjacent — dataviz가 쌓은 막대·막대·선에 쓰는 검사)을 모두 통과하고 여섯째 ↔ "기타" 회색도 구별되는
//   것 중 채도 합이 낮고 정상 시각 거리가 큰 조합. 6색 이웃 쌍 · 벽: 밝기 띠·채도 하한 PASS, CVD 최저 ΔE 8.1,
//   정상 시각 최저 ΔE 18.6, 벽 대비 6색 모두 3:1 이상 PASS. 홈 바닥 위에서는 초록 2.37·황토 2.53:1(경고) —
//   비중 막대는 범례에 이름과 %를 늘 같이 적어 보완한다. 여섯째 ↔ 기타 회색: CVD 14 · 정상 18.7.
// - 산점도·작은 그림 여러 장처럼 아무 둘이나 붙는 꼴(--pairs all)은 앞 3색까지만 통과한다(6색이면 파랑 ↔ 보라가
//   색각 이상에서 ΔE 0.7) — 그런 차트는 셋째 뒤를 "기타"로 묶거나 나눠 그린다.
// - 일곱째부터는 새 색을 만들지 않고 "기타"(무채 회색)로 묶는다(waterShareItems). 무늬(빗금)는 기본으로 깔지 않고
//   "대비 높이기"·인쇄일 때만 덧댄다(dataviz — 무늬는 접근성 설정일 때만, styles/_charts.scss).
// 물 화면은 늘 밝은 벽이라 어두운 모드 색은 없다.

/** 한 계열·이번 기간 — D7 표시 알약 잉크(벽 대비 6.5:1) */
export const WATER_SERIES_PRIMARY = '#3d3b40'
/** 견줄 계열(지난 기간) — D7 흰 칩·흰 테두리. 벽 대비 1.7:1이라 범례·툴팁·표로 값을 같이 준다 */
export const WATER_SERIES_COMPARE = '#ffffff'

/**
 * 범주 색 — 정해진 순서대로만(1 파랑 · 2 녹슨 주황 · 3 초록 · 4 보라 · 5 황토 · 6 자두), 돌려 쓰지 않는다. 쌓은
 * 막대·막대·선은 여섯까지, 아무 둘이나 붙는 차트는 셋까지. 넘으면 "기타"로 묶는다
 */
export const WATER_CATEGORICAL = ['#2b5991', '#803c1a', '#357a47', '#5d5294', '#806504', '#822f5c'] as const
/** "기타" — 무채 회색 */
export const WATER_OTHER = '#7c7a80'

/** 목표 초과처럼 뜻이 있는 막대 — 라벨("목표 초과")과 같이만 쓴다(_tokens.scss $w-warn) */
export const WATER_STATUS_WARN = '#c08a2e'

/** 점 둘레 2px 고리 — 유리 너머 벽 색에 가깝게(선이 겹쳐도 점이 또렷하게) */
export const WATER_RING = '#cbc9ce'

/**
 * 범주 → 비중 막대 조각 — 넘겨준 순서대로 1~6번 색을 붙이고, 일곱째부터는 "기타" 하나로 더해 무채 회색으로 묶는다.
 * 색은 항목을 따른다(순위가 아니라) — 값으로 정렬해 넘기면 값이 바뀔 때 색이 옮겨 다니니 늘 같은 순서로 넘긴다.
 */
export function waterShareItems(
  items: readonly { key: string; label: string; value: number }[],
  otherLabel = '기타',
): ShareItem[] {
  const cap = WATER_CATEGORICAL.length
  const head = items.slice(0, cap).map((item, i) => ({ ...item, color: WATER_CATEGORICAL[i] }))
  const rest = items.slice(cap)
  if (rest.length === 0) return head
  return [
    ...head,
    { key: '__other', label: otherLabel, value: rest.reduce((sum, item) => sum + item.value, 0), color: WATER_OTHER },
  ]
}

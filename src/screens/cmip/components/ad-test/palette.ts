// 구간 색 — 구간 A·B·C…를 그래프 띠·표 머리·편집 줄에서 같은 색으로 잇는다.
// 채널 색(Meta 파랑·Google 노랑·Naver 초록)과 헷갈리지 않는 색들.
const SEGMENT_COLORS = [
  '#8b7cf6',
  '#f59e0b',
  '#22c3a6',
  '#ec6aa6',
  '#38bdf8',
  '#f97362',
] as const

export const segmentColor = (index: number) =>
  SEGMENT_COLORS[index % SEGMENT_COLORS.length]

import { WATER_REVEAL } from './motion'

/**
 * 내용이 차례로 나타난다(D7 펼침 — 아이콘이 왼쪽부터 21ms 간격으로 55ms씩 선형으로 진해진다, F82 → F86,
 * WATER_REVEAL.stagger·fade). 합성기가 돌리는 WAAPI라 매 프레임 JS가 없다. startTime을 누른 시각(at,
 * waterClock 초)에 맞춰 React가 늦게 그려도 시간표가 어긋나지 않는다. from은 첫 항목이 나오기 시작하는 시각
 * (누른 뒤 초), cap은 이 차례 뒤로는 같은 시각에 나온다(긴 목록).
 */
export function revealStagger(
  nodes: readonly Element[],
  o: { at: number; from: number; stagger?: number; fade?: number; cap?: number },
): Animation[] {
  const cap = o.cap ?? 8
  const stagger = o.stagger ?? WATER_REVEAL.stagger
  const fade = o.fade ?? WATER_REVEAL.fade
  return nodes.map((node, i) => {
    const anim = node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: fade * 1000,
      delay: (o.from + Math.min(i, cap) * stagger) * 1000,
      fill: 'backwards',
      easing: 'linear',
    })
    anim.startTime = o.at * 1000
    return anim
  })
}

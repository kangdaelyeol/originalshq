import { StyleSheet } from 'react-native';

// 대시보드 화면의 배치 — 줄·쌓기·늘이기만(flex·gap). 색·글꼴·둥글기·그림자·안쪽 여백은 부품(parts.ts)이 정한다.

export const layout = StyleSheet.create({
  /** 위아래로 쌓기 */
  stack: { gap: 10 },
  /** 촘촘히 쌓기 */
  tight: { gap: 6 },
  /** 가로 한 줄 */
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  /** 넘치면 다음 줄로 */
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  /** 남은 폭 차지 */
  flex: { flex: 1, minWidth: 0 },
  /** 오른쪽으로 모으기(시트 아래 단추) */
  end: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },
});

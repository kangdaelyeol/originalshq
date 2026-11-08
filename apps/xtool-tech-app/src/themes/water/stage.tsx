import { memo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { W } from './theme';
import { useWater } from './theme-context';

// 물 무대(D7 d7-scene, 웹 ohq-ui/water/styles/_stage.scss) — 연회색 유리 타일 벽. 왼쪽 위가 밝은 135° 사선
// 그러데이션(벽 색조 hi → lo) 위에 465×196 타일의 타일마다 다른 밝기(3×3 반복, 검은 막)와 2px 격자선(16.5%, 왼쪽·위)을
// 얹는다. 화면에 붙박이(스크롤해도 그대로) — 설정이 바뀔 때만 다시 그린다.

const TILE_W = 465;
const TILE_H = 196;
/** 타일 밝기 3×3(행 우선) — 웹 무대 SVG의 검은 막 불투명도 */
const TILE_SHADE = [
  [0.005, 0, 0.036],
  [0.063, 0, 0.036],
  [0.061, 0.034, 0.053],
] as const;
const LINE = 2;

/** CSS linear-gradient(각도)의 시작·끝점 — w×h 상자 기준 */
function cssLinear(deg: number, w: number, h: number) {
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  return {
    start: vec(w / 2 - (dx * len) / 2, h / 2 - (dy * len) / 2),
    end: vec(w / 2 + (dx * len) / 2, h / 2 + (dy * len) / 2),
  };
}

export const WaterStage = memo(function WaterStageView() {
  const p = useWater();
  const { width, height } = useWindowDimensions();
  const g = cssLinear(135, width, height);
  const cols = Math.ceil(width / TILE_W);
  const rows = Math.ceil(height / TILE_H);
  const tiles: { x: number; y: number; a: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = TILE_SHADE[r % 3][c % 3];
      if (a > 0) tiles.push({ x: c * TILE_W, y: r * TILE_H, a });
    }
  }
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={g.start} end={g.end} colors={[p.wallHi, p.wallLo]} />
      </Rect>
      <Group color="#000000">
        {tiles.map(t => (
          <Rect key={`${t.x}:${t.y}`} x={t.x} y={t.y} width={TILE_W} height={TILE_H} opacity={t.a} />
        ))}
      </Group>
      <Group color={W.line}>
        {Array.from({ length: rows }, (_, r) => (
          <Rect key={`h${r}`} x={0} y={r * TILE_H} width={width} height={LINE} />
        ))}
        {Array.from({ length: cols }, (_, c) => (
          <Rect key={`v${c}`} x={c * TILE_W} y={0} width={LINE} height={height} />
        ))}
      </Group>
    </Canvas>
  );
});

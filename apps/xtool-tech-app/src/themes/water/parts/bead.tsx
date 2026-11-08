import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

// 물방울 한 알(반지름 5.5 유리구슬, D7 liquid-drop · 웹 water/glass.tsx WaterBead) — 아래쪽 밝은 초승달, 왼쪽 위
// 반짝임, 옅게 어두운 가장자리. 빈 상태·기다리는 단추에 쓴다(움직이는 물방울은 Skia — fx.tsx SkBead).

export function SvgBead({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="-7 -7 14 14">
      <Circle r={5.5} fill="#ffffff" fillOpacity={0.16} stroke="#2a282d" strokeOpacity={0.42} strokeWidth={0.9} />
      <Path d="M-4.9 1.1A5 5 0 0 0 4.9 1.1A6.8 6.8 0 0 1-4.9 1.1Z" fill="#ffffff" fillOpacity={0.92} />
      <Ellipse cx={-1.9} cy={-2.4} rx={1.6} ry={1.3} fill="#ffffff" fillOpacity={0.95} />
    </Svg>
  );
}

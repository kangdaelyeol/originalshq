import { useState, type ReactNode } from 'react';
import { Dimensions, View, type LayoutChangeEvent, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import {
  darkFill,
  dropShadow,
  GROOVE_FILL,
  glassShadow,
  grooveShadow,
  indicatorShadow,
  paneFill,
  solidFill,
  solidShadow,
  type WaterPalette,
} from '../theme';
import { useWater } from '../theme-context';

// 물 바탕 조각 — 유리 판(w-glass)·불투명 유리 단추 속(w-solid)·홈(w-groove)·어두운 표시 알약(D7 indicator).
// 그림자(inset 포함)는 내용 뒤 형제 바탕 층에만 칠한다: iOS는 테두리 없는 뷰의 그림자 층을 자식 위에 얹을 수 있고,
// 포커스로 조상 스타일이 바뀌면 키보드가 내려가는 함정(Fabric)도 피한다. 바탕 층 스타일은 설정·크기마다 한 번 만들어
// 두고, 그린 결과는 Backing이 비트맵 한 장으로 캐시한다.

type Fill = 'glass' | 'pane' | 'none';

/** 부모를 꽉 채우는 바탕 층 */
const FILL = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 } as const;

const cache = new WeakMap<WaterPalette, Map<string, ViewStyle>>();

function memo(p: WaterPalette, key: string, make: () => ViewStyle): ViewStyle {
  let byKey = cache.get(p);
  if (!byKey) {
    byKey = new Map();
    cache.set(p, byKey);
  }
  let style = byKey.get(key);
  if (!style) {
    style = make();
    byKey.set(key, style);
  }
  return style;
}

/** 유리 판 바탕 층 스타일 — fill: glass(거의 투명한 몸) · pane(불투명 판 속 사선) · none */
export function glassLayer(p: WaterPalette, k: number, lift: number, radius: number, fill: Fill = 'glass'): ViewStyle {
  return memo(p, `g:${k}:${lift}:${radius}:${fill}`, () => ({
    ...FILL,
    borderRadius: radius,
    ...(fill === 'glass' ? { backgroundColor: p.pane } : fill === 'pane' ? { backgroundImage: paneFill(p) } : null),
    boxShadow: glassShadow(p, k, lift),
  }));
}

/** 불투명 유리 단추 속 바탕 층 — drop을 주면 떨어지는 그림자(wc-drop)도 */
export function solidLayer(
  p: WaterPalette,
  k: number,
  radius: number,
  shape: 'circle' | 'ellipse' = 'circle',
  drop?: number,
): ViewStyle {
  return memo(p, `s:${k}:${radius}:${shape}:${drop ?? ''}`, () => ({
    ...FILL,
    borderRadius: radius,
    backgroundImage: solidFill(shape),
    boxShadow: drop ? [...dropShadow(drop), ...solidShadow(k)] : solidShadow(k),
  }));
}

/** 홈 바탕 층 */
export function grooveLayer(p: WaterPalette, k: number, radius: number): ViewStyle {
  return memo(p, `r:${k}:${radius}`, () => ({
    ...FILL,
    borderRadius: radius,
    backgroundColor: GROOVE_FILL,
    boxShadow: grooveShadow(k),
  }));
}

/** 어두운 표시 알약 바탕 층 — em은 그림자 기준 글자 크기(D7 0 0.35em 0.8em), 0이면 그림자 없음 */
export function darkLayer(p: WaterPalette, radius: number, em = 10): ViewStyle {
  return memo(p, `d:${radius}:${em}`, () => ({
    ...FILL,
    borderRadius: radius,
    backgroundImage: darkFill(p),
    ...(em ? { boxShadow: indicatorShadow(em) } : null),
  }));
}

/**
 * 바탕 층 — 그림자 겹을 처음 한 번 비트맵으로 그려 두고 그 뒤로는 그림 한 장으로 옮긴다(shouldRasterizeIOS). iOS는
 * 그림자 한 겹마다 마스크 층을 따로 만들어 화면이 움직일 때마다 화면 밖 그림판에서 다시 그리니, 움직이지 않는 바탕은
 * 캐시가 훨씬 싸다. 크기·설정이 바뀌면 한 번 다시 그린다. 화면보다 큰 판은 캐시에 들지 못해 매 프레임 다시 그리게 되므로
 * fit이면 재어 보고 화면 높이 안일 때만 캐시한다. 크기가 매 프레임 바뀌는 층(표시 알약)에는 쓰지 않는다.
 */
export function Backing({ style, fit = false }: { style: StyleProp<ViewStyle>; fit?: boolean }) {
  const [fits, setFits] = useState(!fit);
  return (
    <View
      pointerEvents="none"
      style={style}
      shouldRasterizeIOS={fits}
      onLayout={
        fit
          ? (e: LayoutChangeEvent) => setFits(e.nativeEvent.layout.height <= Dimensions.get('window').height)
          : undefined
      }
    />
  );
}

interface BoxProps extends ViewProps {
  radius: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/** 유리 판(w-glass) — 거의 투명한 몸 + 테두리·안쪽 그림자 + 떨어지는 그림자(lift). fill="pane"이면 불투명 판(서랍·토스트).
 * bare면 바탕 층 없이 자리만(판 안에서 판을 겹치지 않을 때) */
export function Glass({
  k = 1,
  lift = 0.3,
  fill = 'glass',
  bare = false,
  radius,
  style,
  children,
  ...rest
}: BoxProps & { k?: number; lift?: number; fill?: Fill; bare?: boolean }) {
  const p = useWater();
  return (
    <View {...rest} style={[{ borderRadius: radius }, style]}>
      {bare ? null : <Backing style={glassLayer(p, k, lift, radius, fill)} fit />}
      {children}
    </View>
  );
}

/** 불투명 유리 단추 속(w-solid) — 가운데 밝고 가장자리 어두운 둥근 유리, drop이면 떨어지는 그림자 */
export function Solid({
  k,
  shape = 'circle',
  drop,
  radius,
  style,
  children,
  ...rest
}: BoxProps & { k: number; shape?: 'circle' | 'ellipse'; drop?: number }) {
  const p = useWater();
  return (
    <View {...rest} style={[{ borderRadius: radius }, style]}>
      <Backing style={solidLayer(p, k, radius, shape, drop)} />
      {children}
    </View>
  );
}

/** 홈(w-groove) — 유리 안에 파인 길 */
export function Groove({ k = 1, radius, style, children, ...rest }: BoxProps & { k?: number }) {
  const p = useWater();
  return (
    <View {...rest} style={[{ borderRadius: radius }, style]}>
      <Backing style={grooveLayer(p, k, radius)} />
      {children}
    </View>
  );
}

/** 어두운 표시 알약(D7 고른 것) — 위 #555358 → 아래 #2b292e + 아래로 번지는 그림자 */
export function DarkPill({ radius, em = 10, style, children, ...rest }: BoxProps & { em?: number }) {
  const p = useWater();
  return (
    <View {...rest} style={[{ borderRadius: radius }, style]}>
      <Backing style={darkLayer(p, radius, em)} />
      {children}
    </View>
  );
}

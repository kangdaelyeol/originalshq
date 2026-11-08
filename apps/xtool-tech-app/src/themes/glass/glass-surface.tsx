import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { GLASS_DROP, GLASS_SHEEN, glassInset, glassRim, glassTint } from './theme';
import { useGlass } from './theme-context';

// 유리 판 — 웹 glass 믹스인(반투명 바탕 + backdrop-filter: blur saturate + 위쪽 빛 테두리 + 아래 그림자)을 폰에서.
//
// 웹 유리는 고정 배경을 판마다 흐려 비춘다. 앱은 배경이 고정 그림 한 장이라, 그 그림을 미리 한 번 흐린 작은 그림
// (Frame이 Skia로 만든 data URI — blur·saturate 값은 CSS 그대로)을 판마다 화면 좌표에 맞춰 깐다. 판마다 진짜 블러
// (UIVisualEffectView)를 까는 것보다 훨씬 가볍고(같은 작은 비트맵을 같이 쓴다), 흐림·채도가 웹 식과 같다.
// 판이 스크롤되면 그림이 반대로 움직여 화면에 붙어 있는다 — "공간"(GlassSpace)이 판의 화면 위치를 UI 스레드 값으로 준다.

/** 흐린 배경 그림 — 화면(창) 크기에 맞춰 만든 것 */
export interface Backdrop {
  uri: string | null;
  width: number;
  height: number;
}

export const BackdropContext = createContext<Backdrop>({ uri: null, width: 0, height: 0 });

/**
 * 판이 놓인 공간 — node(판이 자기 위치를 잴 기준 뷰)의 (0,0)이 창에서 어디인지(x, y — UI 스레드 값, 스크롤하면 바뀐다).
 * 안의 배치가 바뀌면(내용 크기 등) subscribe한 판들이 다시 잰다.
 */
export interface GlassSpace {
  node: RefObject<ViewInstance | null>;
  x: SharedValue<number>;
  y: SharedValue<number>;
  subscribe: (fn: () => void) => () => void;
}

export const SpaceContext = createContext<GlassSpace | null>(null);

/** 다시 재라는 알림 — 듣는 쪽 목록 */
function useSignal() {
  const listeners = useRef(new Set<() => void>()).current;
  const subscribe = useCallback(
    (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    [listeners],
  );
  const emit = useCallback(() => listeners.forEach(fn => fn()), [listeners]);
  return { subscribe, emit };
}

/**
 * 고정 공간 — 창 (originX, originY)에 붙은 뷰(Frame 뿌리·모달 뿌리). 뿌리 뷰에 ref·onLayout을 단다.
 */
export function useFixedSpace(): { space: GlassSpace; ref: RefObject<ViewInstance | null>; onLayout: () => void } {
  const ref = useRef<ViewInstance | null>(null);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const { subscribe, emit } = useSignal();
  const onLayout = useCallback(() => {
    ref.current?.measureInWindow((wx, wy) => {
      x.value = wx;
      y.value = wy;
      emit();
    });
  }, [emit, x, y]);
  const space = useMemo<GlassSpace>(() => ({ node: ref, x, y, subscribe }), [subscribe, x, y]);
  return { space, ref, onLayout };
}

/**
 * 스크롤 공간 — 화면(Screen)·상세 본문·시트 본문의 ScrollView. viewport(ScrollView를 감싼 뷰)의 자리는 바깥 공간
 * 기준으로 재고, 안쪽 content 뷰가 판들의 기준이 된다. 스크롤 값은 Reanimated 스크롤 처리기로 UI 스레드에서 받는다.
 */
export function useScrollSpace() {
  const parent = useContext(SpaceContext);
  const viewport = useRef<ViewInstance | null>(null);
  const content = useRef<ViewInstance | null>(null);
  const scrollY = useSharedValue(0);
  const offset = useSharedValue({ x: 0, y: 0 });
  const zero = useSharedValue(0);
  const px = parent?.x ?? zero;
  const py = parent?.y ?? zero;
  const x = useDerivedValue(() => px.value + offset.value.x);
  const y = useDerivedValue(() => py.value + offset.value.y - scrollY.value);
  const { subscribe, emit } = useSignal();

  const measure = useCallback(() => {
    const base = parent?.node.current;
    const me = viewport.current;
    if (!me) return;
    if (!base) {
      me.measureInWindow((wx, wy) => {
        offset.value = { x: wx, y: wy };
        emit();
      });
      return;
    }
    me.measureLayout(
      base,
      (left, top) => {
        offset.value = { x: left, y: top };
        emit();
      },
      () => undefined,
    );
  }, [emit, offset, parent]);

  useEffect(() => parent?.subscribe(measure), [parent, measure]);

  const space = useMemo<GlassSpace>(
    () => ({ node: content, x: x as SharedValue<number>, y: y as SharedValue<number>, subscribe }),
    [subscribe, x, y],
  );
  return { space, viewport, content, scrollY, onViewportLayout: measure, onContentChange: emit };
}

/** 이 안의 판은 주어진 공간 기준 */
export function SpaceProvider({ space, children }: { space: GlassSpace; children: ReactNode }) {
  return <SpaceContext.Provider value={space}>{children}</SpaceContext.Provider>;
}

/** 판 바탕 짙기 — base: 설정 농도 · strong: +0.3(서랍·토스트) · solid: 0.92(확인 모달) · 숫자: 그 농도 */
export type GlassTint = 'base' | 'strong' | 'solid' | number;

export interface GlassSurfaceProps {
  /** 바깥 자리·크기·안쪽 여백(웹 padding 그대로 — 1px 테두리는 판이 따로 둔다) */
  style?: StyleProp<ViewStyle>;
  radius: number;
  tint?: GlassTint;
  /** 아래 그림자(웹 0 24px 48px -24px) — 기본 켬 */
  drop?: boolean;
  /** 테두리 색을 바꿀 때(오류 토스트 등) — 기본은 테두리 빛 */
  borderColor?: string;
  /** 흐린 바탕 위에 깔 막 — 시트(웹 서랍 뒤 막이 배경을 누르는 것과 같게) */
  scrim?: string;
  /** 판이 Reanimated로 세로로 움직이는 만큼(시트 올라오기) — 흐린 바탕이 화면에 붙어 있게 */
  shiftY?: SharedValue<number>;
  /** 위 모서리만 둥글게(아래에서 올라오는 시트) */
  topOnly?: boolean;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  onLayout?: (e: LayoutChangeEvent) => void;
  children?: ReactNode;
}

/** 유리 판 하나 — 흐린 배경 · 바탕 칠 · 150deg 빛 · 테두리 빛 · 위쪽 안 빛 · 아래 그림자 */
export function GlassSurface({
  style,
  radius,
  tint = 'base',
  drop = true,
  borderColor,
  scrim,
  shiftY,
  topOnly,
  pointerEvents,
  onLayout,
  children,
}: GlassSurfaceProps) {
  const { glass } = useGlass();
  const backdrop = useContext(BackdropContext);
  const space = useContext(SpaceContext);
  const ref = useRef<ViewInstance | null>(null);
  const offset = useSharedValue({ x: 0, y: 0 });
  const placed = useSharedValue(0);
  const zero = useSharedValue(0);
  const sx = space?.x ?? zero;
  const sy = space?.y ?? zero;
  const shift = shiftY ?? zero;

  const measure = useCallback(() => {
    const me = ref.current;
    const base = space?.node.current;
    if (!me) return;
    const done = (left: number, top: number) => {
      offset.value = { x: left, y: top };
      placed.value = 1;
    };
    if (base) me.measureLayout(base, done, () => undefined);
    else me.measureInWindow(done);
  }, [offset, placed, space]);

  useEffect(() => space?.subscribe(measure), [space, measure]);

  const image = useAnimatedStyle(() => ({
    opacity: placed.value,
    transform: [
      { translateX: -(sx.value + offset.value.x) },
      { translateY: -(sy.value + offset.value.y + shift.value) },
    ],
  }));

  const level =
    typeof tint === 'number' ? tint : tint === 'strong' ? glass.opacity + 0.3 : tint === 'solid' ? 0.92 : glass.opacity;
  // 흐린 바탕을 아직 못 만들었으면 웹의 흐림 없는 환경처럼 거의 불투명하게(뒤 선이 글을 가리지 않게)
  const fillLevel = backdrop.uri ? level : Math.max(level, 0.92);
  const corners: ViewStyle = topOnly
    ? { borderTopLeftRadius: radius, borderTopRightRadius: radius }
    : { borderRadius: radius };

  return (
    <View
      ref={ref}
      collapsable={false}
      pointerEvents={pointerEvents}
      onLayout={e => {
        measure();
        onLayout?.(e);
      }}
      style={[styles.box, corners, drop && styles.drop, style]}
    >
      <View style={[styles.layer, corners, styles.clip]} pointerEvents="none">
        {backdrop.uri ? (
          <Animated.Image
            source={{ uri: backdrop.uri }}
            resizeMode="stretch"
            style={[{ position: 'absolute', left: 0, top: 0, width: backdrop.width, height: backdrop.height }, image]}
          />
        ) : null}
        {scrim ? <View style={[StyleSheet.absoluteFill, { backgroundColor: scrim }]} /> : null}
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: glassTint(fillLevel), backgroundImage: GLASS_SHEEN }]}
        />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.layer,
          corners,
          { borderWidth: 1, borderColor: borderColor ?? glassRim(glass.rim), boxShadow: glassInset(glass.rim) },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // 1px 투명 테두리 — 웹처럼 안쪽 여백이 테두리 안에서 시작하게. 겹(layer)은 -1로 테두리까지 덮는다.
  box: { borderWidth: 1, borderColor: 'transparent' },
  drop: { boxShadow: GLASS_DROP },
  layer: { position: 'absolute', left: -1, top: -1, right: -1, bottom: -1 },
  clip: { overflow: 'hidden' },
});

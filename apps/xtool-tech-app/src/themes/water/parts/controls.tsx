import { useEffect, useId, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, FeGaussianBlur, Filter, G, Path } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';
import {
  DANGER_FILL,
  darkChipFill,
  darkFill,
  DOT_SHADOW,
  dropShadow,
  QUICK_MS,
  shadow,
  solidFill,
  solidShadow,
  springConfig,
  W,
  WATER_SPRING,
  type WaterPalette,
} from '../theme';
import { useWater } from '../theme-context';
import { SvgBead } from './bead';
import { WText } from './text';

// 물 단추·칩·알약(웹 ohq-ui/water/controls) — 누르면 D7 버튼처럼 출렁이며 줄고(wobble ζ0.3·ω46), 떼면 부풀며
// 돌아온다(swell ζ0.35·ω20). 색이 바뀌는 것(칩 고름·겹친 빛)은 0.1초.

export type WTone = 'good' | 'warn' | 'crit' | 'info' | 'neutral';

/** 상태 점 색 — 색은 점에만, 글자는 잉크 */
export const TONE_DOT: Record<WTone, string> = {
  good: W.ok,
  warn: W.warn,
  crit: W.crit,
  info: W.info,
  neutral: W.ink3,
};

const WOBBLE = springConfig(WATER_SPRING.wobble);
const SWELL = springConfig(WATER_SPRING.swell);

/** 누름 출렁임 — 누르면 scale까지 wobble, 떼면 1로 swell */
export function usePressWobble(scale: number) {
  const s = useSharedValue(1);
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return {
    style,
    onPressIn: () => {
      if (!reduced) s.value = withSpring(scale, WOBBLE);
    },
    onPressOut: () => {
      s.value = reduced ? 1 : withSpring(1, SWELL);
    },
  };
}

// ── 단추 ─────────────────────────────────────────────────────────────────────

export type WButtonVariant = 'primary' | 'ghost' | 'glass' | 'danger';
export type WButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_SIZE: Record<WButtonSize, { h: number; px: number; font: number }> = {
  sm: { h: 30, px: 13, font: 12 },
  md: { h: 36, px: 17, font: 13 },
  lg: { h: 44, px: 22, font: 14.5 },
};

function buttonFill(p: WaterPalette, variant: WButtonVariant, h: number): ViewStyle {
  const base: ViewStyle = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: h / 2 };
  if (variant === 'primary') return { ...base, backgroundImage: darkChipFill(p) };
  if (variant === 'danger')
    return { ...base, backgroundImage: DANGER_FILL, boxShadow: [shadow(0, 3, 7, 0, 'rgba(80, 20, 16, 0.26)')] };
  if (variant === 'ghost') return { ...base, backgroundColor: W.chip };
  return { ...base, backgroundImage: solidFill('ellipse'), boxShadow: [...dropShadow(0.3), ...solidShadow(0.42)] };
}

export interface WButtonProps {
  variant?: WButtonVariant;
  size?: WButtonSize;
  icon?: LucideIcon;
  /** 기다리는 중 — 아이콘 자리에서 물방울이 통통 튀고, 눌러도 아무 일 없다 */
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** 아이콘을 글 뒤에 */
  iconAfter?: boolean;
  /** 폭을 가득 */
  block?: boolean;
}

/** 물 단추 — primary: 어두운 알약(D7 고른 칩) · ghost: 반투명 흰 칩 · glass: 불투명 유리 · danger: 붉은 알약 */
export function WButton({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  onPress,
  children,
  style,
  accessibilityLabel,
  iconAfter = false,
  block = false,
}: WButtonProps) {
  const p = useWater();
  const sz = BUTTON_SIZE[size];
  const press = usePressWobble(0.97);
  const onDark = variant === 'primary' || variant === 'danger';
  const ink = onDark ? '#ffffff' : variant === 'ghost' ? W.ink2 : W.ink;
  const iconSize = Math.round(sz.font * 1.15);
  return (
    <Animated.View style={[press.style, block ? styles.block : styles.inline, disabled && styles.disabled, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, busy: loading }}
        disabled={disabled}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={loading ? undefined : onPress}
        style={[styles.button, { height: sz.h, paddingHorizontal: sz.px, borderRadius: sz.h / 2, gap: sz.font * 0.45 }]}
      >
        {({ pressed }) => (
          <>
            {/* 바탕(그러데이션·그림자 겹)은 한 장으로 캐시 — 반투명 흰 칩(ghost)은 색 한 겹이라 그대로 */}
            <View pointerEvents="none" style={buttonFill(p, variant, sz.h)} shouldRasterizeIOS={variant !== 'ghost'} />
            {/* 겹친 빛(웹 hover ::before 흰 13%) — 폰은 누르는 동안 */}
            <View
              pointerEvents="none"
              style={[styles.fill, { borderRadius: sz.h / 2 }, pressed && !loading ? styles.glow : null]}
            />
            {loading ? (
              <HopBead size={Math.round(sz.font * 1.05)} />
            ) : Icon && !iconAfter ? (
              <View style={[{ marginLeft: -sz.font * 0.2 }, onDark && styles.iconShadow]}>
                <Icon size={iconSize} color={pressed && variant === 'ghost' ? W.ink : ink} strokeWidth={2} />
              </View>
            ) : null}
            {children != null && (
              <WText size={sz.font} weight="600" color={pressed && variant === 'ghost' ? W.ink : ink} onDark={onDark}>
                {children}
              </WText>
            )}
            {!loading && Icon && iconAfter ? (
              <View style={[{ marginRight: -sz.font * 0.2 }, onDark && styles.iconShadow]}>
                <Icon size={iconSize} color={pressed && variant === 'ghost' ? W.ink : ink} strokeWidth={2} />
              </View>
            ) : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** 기다리는 중 물방울 — 오를 때 1-(1-u)², 내릴 때 u², 바닥에서 납작(0.5초 반복, 웹 water-bead-hop) */
function HopBead({ size }: { size: number }) {
  const t = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: reduced ? 1600 : 500, easing: Easing.linear }), -1);
  }, [t, reduced]);
  const style = useAnimatedStyle(() => {
    const u = t.value;
    const em = size / 1.05;
    // 키프레임 0 → 12% → 50% → 92% → 100%
    let y: number;
    let sx: number;
    let sy: number;
    if (u < 0.12) {
      const k = u / 0.12;
      const e = 1 - (1 - k) * (1 - k);
      y = 0.12 * em * (1 - e);
      sx = 1.18 + (0.9 - 1.18) * e;
      sy = 0.82 + (1.12 - 0.82) * e;
    } else if (u < 0.5) {
      const k = (u - 0.12) / 0.38;
      const e = 1 - (1 - k) * (1 - k);
      y = -0.42 * em * e;
      sx = 0.9 + (1 - 0.9) * e;
      sy = 1.12 + (1 - 1.12) * e;
    } else if (u < 0.92) {
      const k = (u - 0.5) / 0.42;
      const e = k * k;
      y = -0.42 * em * (1 - e);
      sx = 1 + (0.92 - 1) * e;
      sy = 1 + (1.1 - 1) * e;
    } else {
      const k = (u - 0.92) / 0.08;
      y = 0.12 * em * k;
      sx = 0.92 + (1.18 - 0.92) * k;
      sy = 1.1 + (0.82 - 1.1) * k;
    }
    return { transform: [{ translateY: y }, { scaleX: sx }, { scaleY: sy }] };
  });
  return (
    <Animated.View style={[{ width: size, height: size, marginLeft: -size * 0.19 }, style]}>
      <SvgBead size={size} />
    </Animated.View>
  );
}

// ── 아이콘 단추 ────────────────────────────────────────────────────────────────

const ICON_BUTTON = { sm: 32, md: 38, lg: 44 } as const;

/**
 * 물 아이콘 단추(D7 접힌 메뉴 버튼을 작게) — 불투명 유리 원 + 떨어지는 그림자, 왼쪽 위 가는 반사광과 왼쪽 아래 사선
 * 윤광, 그림자 진 흰 아이콘. 누르면 5% 출렁이며 줄고(wobble), 떼면 부풀며 돌아온다. pressed면 어두운 알약으로 채운다.
 */
export function WIconButton({
  icon: Icon,
  label,
  size = 'md',
  pressed: on = false,
  disabled = false,
  onPress,
  style,
}: {
  icon: LucideIcon;
  label: string;
  size?: keyof typeof ICON_BUTTON;
  pressed?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useWater();
  const d = ICON_BUTTON[size];
  const k = d / 121;
  const press = usePressWobble(0.95);
  const blurId = `wib${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Animated.View style={[press.style, disabled && styles.disabled, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, selected: on }}
        disabled={disabled}
        hitSlop={6}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={onPress}
        style={[styles.center, { width: d, height: d, borderRadius: d / 2 }]}
      >
        <View
          pointerEvents="none"
          shouldRasterizeIOS
          style={[
            styles.fill,
            {
              borderRadius: d / 2,
              backgroundImage: solidFill('circle'),
              boxShadow: [...dropShadow(k), ...solidShadow(k)],
            },
          ]}
        />
        {on && (
          <View pointerEvents="none" style={[styles.fill, { borderRadius: d / 2, backgroundImage: darkFill(p) }]} />
        )}
        {/* 장식 좌표는 D7 버튼(반지름 60.5) 그대로 — viewBox로 줄인다 */}
        <Svg pointerEvents="none" style={styles.fill} viewBox="-60.5 -60.5 121 121">
          <Defs>
            <Filter id={blurId} x="-60%" y="-60%" width="220%" height="220%">
              <FeGaussianBlur stdDeviation={2.4} />
            </Filter>
          </Defs>
          <G fill="none" stroke="#ffffff" strokeLinecap="round">
            <Path d="M-47.2-27.3A54.5 54.5 0 0 1-23-49.4" strokeOpacity={0.55} strokeWidth={2.6} />
            <Path d="M-19.5 34.5L2.5 16" strokeOpacity={0.5} strokeWidth={6} filter={`url(#${blurId})`} />
          </G>
        </Svg>
        <View style={styles.iconShadowStrong}>
          <Icon size={Math.round(d * 0.46)} color="#ffffff" strokeWidth={2} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── 칩(하나만 고르기) ────────────────────────────────────────────────────────────

const CHIP_SCALE = { sm: 0.9, md: 1, lg: 1.2 } as const;

export interface WChipOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

/**
 * 물 칩(D7 Bounce | Splash) — 하나만 고른다. 고른 칩은 어두운 알약에 흰 글자, 아닌 칩은 반투명 흰 알약에 회색 글자.
 * 바뀔 때 0.1초. md가 D7 그대로(글자 11, 높이 26.5, 옆 12, 사이 4.5).
 */
export function WChips<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  disabled = false,
  style,
}: {
  options: readonly WChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: keyof typeof CHIP_SCALE;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const m = CHIP_SCALE[size];
  return (
    <View accessibilityRole="radiogroup" style={[styles.chips, { gap: 4.5 * m }, disabled && styles.dim, style]}>
      {options.map(o => (
        <WChip
          key={o.value}
          option={o}
          on={o.value === value}
          m={m}
          disabled={disabled}
          onPress={() => onChange(o.value)}
        />
      ))}
    </View>
  );
}

function WChip<T extends string>({
  option,
  on,
  m,
  disabled,
  onPress,
}: {
  option: WChipOption<T>;
  on: boolean;
  m: number;
  disabled: boolean;
  onPress: () => void;
}) {
  const p = useWater();
  const dark = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    dark.value = withTiming(on ? 1 : 0, { duration: QUICK_MS, easing: Easing.out(Easing.quad) });
  }, [on, dark]);
  const darkStyle = useAnimatedStyle(() => ({ opacity: dark.value }));
  const font = 11 * m;
  const h = 26.5 * m;
  const Icon = option.icon;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on, disabled }}
      disabled={disabled}
      onPress={() => {
        if (!on) onPress();
      }}
      style={[styles.chip, { height: h, paddingHorizontal: 12 * m, borderRadius: 13.2 * m, gap: 0.4 * font }]}
    >
      {({ pressed }) => (
        <>
          <View
            pointerEvents="none"
            style={[styles.fill, { borderRadius: 13.2 * m, backgroundColor: pressed && !on ? W.chipHover : W.chip }]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.fill, { borderRadius: 13.2 * m, backgroundImage: darkChipFill(p) }, darkStyle]}
          />
          {Icon && (
            <Icon size={Math.round(font * 1.15)} color={on ? '#ffffff' : W.ink2} style={{ marginLeft: -0.15 * font }} />
          )}
          <WText size={font} weight="600" color={on ? '#ffffff' : pressed ? W.ink : W.ink2}>
            {option.label}
          </WText>
        </>
      )}
    </Pressable>
  );
}

// ── 상태 알약 · 표시 · 증감 ─────────────────────────────────────────────────────────

/** 물 상태 알약 — 반투명 흰 칩 + 상태 색 유리 점(색은 점에만, 글자는 잉크). pulse면 점에서 물결이 퍼진다(Live) */
export function WPill({
  tone,
  children,
  dot = true,
  onDark = false,
  style,
}: {
  tone: WTone;
  children: ReactNode;
  dot?: boolean | 'pulse';
  /** 어두운 알약(고른 줄) 위 — 흰 14% 바탕에 흰 글자 */
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pill, onDark && styles.pillOnDark, style]}>
      {dot && <Dot color={TONE_DOT[tone]} pulse={dot === 'pulse'} />}
      <WText size={11} weight="600" color={onDark ? '#ffffff' : W.ink} numberOfLines={1}>
        {children}
      </WText>
    </View>
  );
}

function Dot({ color, pulse }: { color: string; pulse: boolean }) {
  const t = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!pulse || reduced) return;
    t.value = withRepeat(withSequence(withTiming(1, { duration: 1800, easing: Easing.linear })), -1);
  }, [pulse, reduced, t]);
  const ring = useAnimatedStyle(() => {
    // 0.6초 동안 반지름이 고르게 커지고(×3.4) 1-u²로 흐려진다, 1.8초마다
    const u = Math.min(1, (t.value * 1.8) / 0.6);
    return { opacity: t.value === 0 ? 0 : 1 - u * u, transform: [{ scale: 1 + 2.4 * u }] };
  });
  return (
    // 유리구슬 그림자 두 겹은 한 장으로 캐시 — 물결(pulse)이 퍼지는 점은 매 프레임 바뀌니 그대로
    <View style={[styles.dot, { backgroundColor: color, boxShadow: DOT_SHADOW }]} shouldRasterizeIOS={!pulse}>
      {pulse && <Animated.View style={[styles.dotRing, { borderColor: color }, ring]} />}
    </View>
  );
}

/** 상태 표시(water-flag) — 반투명 흰 칩 + 상태 점 + 글자 */
export function WFlag({ tone, children, style }: { tone: WTone; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.flag, style]}>
      <View style={[styles.flagDot, { backgroundColor: TONE_DOT[tone] }]} />
      <WText size={11} weight="600" numberOfLines={1}>
        {children}
      </WText>
    </View>
  );
}

/** 저장 표시·말풍선 같은 반투명 흰 알약(흰 1px 테 — 그림자 대신 테두리) */
export function WChipBox({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.chipBox, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.5 },
  dim: { opacity: 0.55 },
  inline: { alignSelf: 'flex-start' },
  block: { alignSelf: 'stretch' },
  center: { alignItems: 'center', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  glow: { backgroundColor: 'rgba(255, 255, 255, 0.13)' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  // 흰 아이콘 아래로 번지는 그림자(D7 0 0.6px 0.8px 20%)
  iconShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 0.8,
    shadowOffset: { width: 0, height: 0.6 },
  },
  iconShadowStrong: {
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 0.8,
    shadowOffset: { width: 0, height: 0.6 },
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: W.chip,
  },
  pillOnDark: { backgroundColor: W.onDarkFill },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dotRing: {
    position: 'absolute',
    left: -0.5,
    top: -0.5,
    right: -0.5,
    bottom: -0.5,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 22,
    paddingLeft: 8,
    paddingRight: 9,
    borderRadius: 11,
    backgroundColor: W.chip,
  },
  flagDot: { width: 6, height: 6, borderRadius: 3 },
  chipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: W.chipRing,
    backgroundColor: W.chip,
  },
});

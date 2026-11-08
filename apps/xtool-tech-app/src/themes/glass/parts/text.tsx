import { useEffect, useState, type ReactNode } from 'react';
import { Text as RNText, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type EntryAnimationsValues,
  type LayoutAnimation,
} from 'react-native-reanimated';
import { LoaderCircle, type LucideIcon } from 'lucide-react-native';
import type { IconProps, SpinnerProps, TextProps, TextTone, TextVariant } from '../../dashboard/parts';
import { font, T, TABULAR, TONE } from '../theme';
import { useGlass } from '../theme-context';

// 글자·아이콘·돌아가는 표시·카드 등장 — 글라스 부품이 같이 쓰는 바탕 조각.

/** 글자 변형(계약 TextVariant) — 웹 값: 제목 17/700 · 카드 제목 15/600 · 본문 13 · 이름 13/600 · 메타 11.5 · 설명 12 · 이름표(dt) 13 · 숫자 26/700 */
const VARIANT: Record<TextVariant, TextStyle> = {
  title: { ...font(17, 700, { ls: -0.01, lh: 1.35 }), color: T.text1 },
  heading: { ...font(15, 600, { ls: -0.01, lh: 1.4 }), color: T.text1 },
  body: { ...font(13, 400, { lh: 1.5 }), color: T.text1 },
  strong: { ...font(13, 600, { lh: 1.5 }), color: T.text1 },
  small: { ...font(11.5, 400, { lh: 1.45 }), color: T.text3 },
  caption: { ...font(12, 400, { lh: 1.45 }), color: T.text3 },
  label: { ...font(13, 400, { lh: 1.5 }), color: T.text4 },
  number: { ...font(26, 700, { ls: -0.025, lh: 1.15 }), ...TABULAR, color: '#ffffff' },
};

/** 글자 색(계약 TextTone) */
export function useToneColor(tone: TextTone | undefined, fallback: string): string {
  const { a } = useGlass();
  if (!tone) return fallback;
  if (tone === 'default') return T.text1;
  if (tone === 'muted') return T.text3;
  if (tone === 'accent') return a.accent;
  return TONE[tone].color;
}

/** 화면 글 — 변형·색만 고르고, style은 배치(flex·margin)만 */
export function Text({
  variant = 'body',
  tone,
  numberOfLines,
  align,
  selectable,
  onPress,
  style,
  children,
}: TextProps) {
  const base = VARIANT[variant];
  const color = useToneColor(tone, base.color as string);
  return (
    <RNText
      style={[base, { color }, align ? { textAlign: align } : null, style]}
      numberOfLines={numberOfLines}
      selectable={selectable}
      onPress={onPress}
      suppressHighlighting
    >
      {children}
    </RNText>
  );
}

/** 테마 색 아이콘 — 기본 text-2, 흐림 text-4(쉐브론·안내) */
export function Icon({ icon: I, size = 16, tone }: IconProps) {
  const color = useToneColor(tone === 'muted' ? undefined : tone, tone === 'muted' ? T.text4 : T.text2);
  return <I size={size} strokeWidth={2} color={color} />;
}

/** 도는 아이콘 — 웹 .is-spinning(LoaderCircle, 0.9초 한 바퀴) */
export function SpinIcon({
  size = 16,
  color = T.text3,
  icon: I = LoaderCircle,
}: {
  size?: number;
  color?: string;
  icon?: LucideIcon;
}) {
  const turn = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    turn.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
  }, [reduced, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <I size={size} strokeWidth={2} color={color} />
    </Animated.View>
  );
}

/** 불러오는 중 표시(계약 Spinner) */
export function Spinner({ size = 'small', style }: SpinnerProps) {
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <SpinIcon size={size === 'large' ? 26 : 16} />
    </View>
  );
}

// ── 카드 등장(웹 cardEnter — opacity 0→1, y 14→0, 0.42초, 형제 사이 45ms) ─────────────────────────────────────

const ENTER_EASING = Easing.bezier(0.22, 1, 0.36, 1);
let batchAt = 0;
let batchCount = 0;

/** 같은 순간에 그려지는 카드끼리 45ms씩 늦춘다(웹 pageStagger: 첫 20ms, 다음부터 45ms) */
function nextDelay(): number {
  const now = Date.now();
  if (now - batchAt > 60) {
    batchAt = now;
    batchCount = 0;
  }
  return 20 + 45 * batchCount++;
}

function cardEnter(delay: number) {
  return (_values: EntryAnimationsValues): LayoutAnimation => {
    'worklet';
    const timing = { duration: 420, easing: ENTER_EASING };
    return {
      initialValues: { opacity: 0, transform: [{ translateY: 14 }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, timing)),
        transform: [{ translateY: withDelay(delay, withTiming(0, timing)) }],
      },
    };
  };
}

/**
 * 판 하나가 처음 그려질 때 떠오르기. collapsable={false} — 움직임(opacity·transform)이 끝나도 뷰가 평탄화되지 않게
 * (안에 입력칸이 있어도 키보드가 내려가지 않게).
 */
export function Enter({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduced = useReducedMotion();
  // 늦춤은 처음 그릴 때 한 번만 정한다(다시 그려도 차례가 밀리지 않게)
  const [entering] = useState(() => (reduced ? undefined : cardEnter(nextDelay())));
  return (
    <Animated.View collapsable={false} entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

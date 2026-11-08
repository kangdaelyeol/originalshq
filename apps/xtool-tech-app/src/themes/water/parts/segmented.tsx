import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { nowSec } from '../motion';
import { QUICK_MS, shadow, W } from '../theme';
import { useWater } from '../theme-context';
import { DropLayer, DropRippleLayer, useDropFx } from './fx';
import { darkLayer, Glass } from './glass';
import { WText } from './text';
import { useWaterIndicator } from './use-indicator';

// 물 고르기(D7 펼친 메뉴, 웹 ohq-ui/water/controls/segmented.tsx) — 유리 알약 안에서 어두운 표시 알약이 스프링
// (ζ0.65·ω30.5, 7% 넘침)으로 옮겨 가며 달리는 빠르기만큼 늘어나고, 고른 글자는 흰색이 되며 1.15배로 커진다(0.1s).
// 알약이 지나가는 칸은 알약을 따라가는 창(같은 글을 흰 글자로 한 벌 더)으로 희게 보인다. 고르면 표시 알약 윗변에서
// 물방울이 튀어 올랐다 통통 튀고(bounce) 닿은 자리에 물결이 두 겹 퍼진다(표시 알약 밑).

/** 크기 — 표시 알약 높이(ih)·둘레(pad)·글자·옆 여백. k = ih / 50.5 */
const SEG = {
  sm: { ih: 26, pad: 3, font: 12, padx: 12 },
  md: { ih: 32, pad: 4, font: 13, padx: 15 },
  lg: { ih: 40, pad: 5, font: 14.5, padx: 18 },
} as const;

/** 움직임이 끝났다고 보는 때 — 표시 알약 엔진과 같다(0.9s) */
const SETTLE = 0.9;

export interface WSegOption<T extends string> {
  value: T;
  label: string;
}

export function WSegmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  effect = 'bounce',
  disabled = false,
  accessibilityLabel,
  style,
}: {
  options: readonly WSegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: keyof typeof SEG;
  effect?: 'bounce' | 'none';
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useWater();
  const s = SEG[size];
  const k = s.ih / 50.5;
  const reduced = useReducedMotion();
  const index = options.findIndex(o => o.value === value);
  const ind = useWaterIndicator();
  const fx = useDropFx(ind.pose);
  const [fxOn, setFxOn] = useState(false);
  const [boxes, setBoxes] = useState<({ x: number; w: number } | undefined)[]>([]);
  const [rowW, setRowW] = useState(0);
  const [outer, setOuter] = useState({ w: 0, h: 0 });
  const rowWidth = useSharedValue(0);
  const pressedAt = useRef<number | undefined>(undefined);
  const shown = useRef(-1);
  const movedAt = useRef(-Infinity);

  // 칸마다 잰 자리 — 글이 바뀌면 바뀐 칸만 다시 알려 온다(onLayout). 지금 칸 수만큼만 본다
  const measured = options.map((_, i) => boxes[i]);
  const ready = measured.every(Boolean);
  const targets = ready ? (measured as { x: number; w: number }[]).map(b => ({ pos: b.x + b.w / 2, size: b.w })) : null;
  const step =
    targets && targets.length > 1 ? (targets[targets.length - 1].pos - targets[0].pos) / (targets.length - 1) : s.ih;

  // 표시 알약 — 처음·모양이 바뀌면 바로(움직이는 중이면 이어서), 고른 칸이 바뀌면 누른 시각부터 스프링으로 + 물방울
  const sig = targets ? targets.map(t => `${t.pos.toFixed(2)}:${t.size.toFixed(2)}`).join('|') : '';
  useEffect(() => {
    if (!targets || index < 0) return;
    const t = targets[index];
    const prev = shown.current;
    shown.current = index;
    const at = pressedAt.current;
    pressedAt.current = undefined;
    if (prev < 0 || prev === index || reduced) {
      const moving = nowSec() - movedAt.current < SETTLE && !reduced;
      ind.set(t, moving ? { step } : { instant: true });
      return;
    }
    ind.set(t, { at, step });
    movedAt.current = at ?? nowSec();
    if (effect === 'none') return;
    setFxOn(true);
    fx.trigger({
      x: s.pad + t.pos,
      surface: s.pad,
      rippleY: s.pad + s.ih / 2,
      scale: k,
      steps: Math.abs(index - prev),
      clip: { x: 0, y: 0, width: outer.w, height: outer.h, radius: outer.h / 2 },
      ago: at === undefined ? 0 : nowSec() - at,
    });
    // 칸 자리(sig)·고른 칸이 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, sig]);

  const indicatorStyle = useAnimatedStyle(() => {
    const q = ind.pose.value;
    return {
      opacity: q.placed ? 1 : 0,
      width: q.size,
      transform: [{ translateX: q.pos - q.size / 2 }, { scaleX: q.along }, { scaleY: q.across }],
    };
  });
  const innerStyle = useAnimatedStyle(() => {
    const q = ind.pose.value;
    const px = q.size / 2 - rowWidth.value / 2;
    return {
      transform: [
        { translateX: px },
        { scaleX: 1 / q.along },
        { scaleY: 1 / q.across },
        { translateX: -px },
        { translateX: -(q.pos - q.size / 2) },
      ],
    };
  });

  const radius = (s.ih + s.pad * 2) / 2;
  return (
    <Glass
      radius={radius}
      k={k}
      lift={1}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.root, { padding: s.pad }, disabled && styles.disabled, style]}
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (Math.abs(width - outer.w) > 0.5 || Math.abs(height - outer.h) > 0.5) setOuter({ w: width, h: height });
      }}
    >
      {fxOn && <DropRippleLayer fx={fx} />}
      <View
        style={styles.rowBox}
        onLayout={e => {
          const w = e.nativeEvent.layout.width;
          if (Math.abs(w - rowW) > 0.5) {
            setRowW(w);
            rowWidth.value = w;
          }
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { height: s.ih, borderRadius: s.ih / 2 }, indicatorStyle]}
        >
          <View
            style={[darkLayer(p, s.ih / 2, 0), { boxShadow: [shadow(0, 3.5 * k, 8 * k, 0, 'rgba(0, 0, 0, 0.26)')] }]}
          />
        </Animated.View>
        <View style={styles.row}>
          {options.map((o, i) => (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: i === index, disabled }}
              accessibilityLabel={o.label}
              disabled={disabled}
              onLayout={e => {
                const { x, width } = e.nativeEvent.layout;
                setBoxes(cur => {
                  const prev = cur[i];
                  if (prev && Math.abs(prev.x - x) < 0.25 && Math.abs(prev.w - width) < 0.25) return cur;
                  const next = cur.slice();
                  next.length = options.length;
                  next[i] = { x, w: width };
                  return next;
                });
              }}
              onPress={() => {
                if (o.value === value) return;
                pressedAt.current = nowSec();
                onChange(o.value);
              }}
              style={[styles.item, { height: s.ih, paddingHorizontal: s.padx }]}
            >
              {({ pressed }) => <SegLabel label={o.label} on={i === index} font={s.font} hover={pressed} />}
            </Pressable>
          ))}
        </View>
        {/* 알약을 따라가는 창 — 알약과 겹친 곳만 흰 글자(읽어 주기·누르기에서는 빠진다) */}
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.window, { height: s.ih, borderRadius: s.ih / 2 }, indicatorStyle]}
        >
          <Animated.View style={[styles.inner, { width: rowW, height: s.ih }, innerStyle]}>
            {options.map((o, i) => (
              <View key={o.value} style={[styles.item, { height: s.ih, paddingHorizontal: s.padx }]}>
                <SegLabel label={o.label} on={i === index} font={s.font} white />
              </View>
            ))}
          </Animated.View>
        </Animated.View>
      </View>
      {fxOn && <DropLayer fx={fx} />}
    </Glass>
  );
}

/**
 * 칸 글자 — 고르면 1.15배(0.1s). 바깥 줄은 잉크 글자 위에 흰 겹(고른 칸에서만 0.1초에 떠오르고, 다 떠오르면 잉크 글자를
 * 감춘다 — 풀 때는 곧바로 다시 보인다). white면 창 안의 흰 한 벌.
 */
function SegLabel({
  label,
  on,
  font,
  white = false,
  hover = false,
}: {
  label: string;
  on: boolean;
  font: number;
  white?: boolean;
  hover?: boolean;
}) {
  const reduced = useReducedMotion();
  const grow = useSharedValue(on ? 1 : 0);
  const face = useSharedValue(on ? 1 : 0);
  const ink = useSharedValue(on ? 0 : 1);
  useEffect(() => {
    grow.value = reduced ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: QUICK_MS });
    face.value = withTiming(on ? 1 : 0, { duration: QUICK_MS });
    ink.value = on ? withDelay(QUICK_MS, withTiming(0, { duration: 0 })) : 1;
  }, [on, reduced, grow, face, ink]);
  const scale = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.15 * grow.value }] }));
  const inkStyle = useAnimatedStyle(() => ({ opacity: ink.value }));
  const faceStyle = useAnimatedStyle(() => ({ opacity: face.value }));
  if (white) {
    return (
      <Animated.View style={scale}>
        <WText size={font} weight="600" onDark numberOfLines={1}>
          {label}
        </WText>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={scale}>
      <Animated.View style={inkStyle}>
        <WText size={font} weight="600" color={hover ? W.ink : W.ink2} numberOfLines={1}>
          {label}
        </WText>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, faceStyle]}>
        <WText size={font} weight="600" onDark numberOfLines={1}>
          {label}
        </WText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'flex-start', maxWidth: '100%' },
  disabled: { opacity: 0.55 },
  rowBox: { position: 'relative' },
  row: { flexDirection: 'row', alignItems: 'center' },
  item: { alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', left: 0, top: 0 },
  window: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  inner: { position: 'absolute', left: 0, top: 0, flexDirection: 'row', alignItems: 'center' },
});

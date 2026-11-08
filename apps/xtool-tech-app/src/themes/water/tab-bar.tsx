import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useFocusFade } from '../../features/focus-fade';
import { TAB_META } from '../../navigation/tab-meta';
import type { TabParams } from '../../navigation/types';
import { nowSec } from './motion';
import { RippleLayer, rippleAt, useRippleFx } from './parts/fx';
import { darkLayer, Glass } from './parts/glass';
import { WText } from './parts/text';
import { useWaterIndicator } from './parts/use-indicator';
import { QUICK_MS, W } from './theme';
import { useWater } from './theme-context';

// 아래 탭 — 웹 물 사이드바(water-sidebar.tsx)를 폰 아래로 눕혔다. 유리 판(w-glass 1·0.3, 둥글기 22) 위 메뉴 칸,
// 지금 보는 칸 뒤에 D7 표시 알약(어두운 알약 + 0 3 7 26% 그림자)이 깔리고, 칸을 옮기면 알약이 표시 알약 스프링
// (ζ0.65·ω30.5)으로 미끄러지며 달리는 만큼 늘었다 준다. 지나가는 칸은 알약을 따라가는 창(같은 메뉴를 흰 글자로 한 벌
// 더)으로 희게 보이고, 누른 칸은 그 자리에서 물결이 퍼진다(고른 칸이 아닐 때).

const ITEM_H = 50;
const GAP = 4;
const PAD = 6;
const ICON = 20;

export function WaterTabBar({ state, navigation }: BottomTabBarProps) {
  const p = useWater();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const fadeStyle = useFocusFade();
  const [rowW, setRowW] = useState(0);
  const count = state.routes.length;
  const itemW = rowW > 0 ? (rowW - GAP * (count - 1)) / count : 0;
  const ind = useWaterIndicator();
  const ripple = useRippleFx();
  const pressedAt = useRef<number | undefined>(undefined);
  const shown = useRef(-1);
  const rowWidth = useSharedValue(0);

  // 알약 자리 — 처음·폭이 바뀌면 바로, 칸을 옮기면 누른 시각부터 스프링으로
  useEffect(() => {
    if (itemW <= 0) return;
    const target = { pos: state.index * (itemW + GAP) + itemW / 2, size: itemW };
    const first = shown.current < 0;
    const moved = shown.current !== state.index;
    shown.current = state.index;
    const at = pressedAt.current;
    pressedAt.current = undefined;
    ind.set(target, first || !moved || reduced ? { instant: true } : { at });
  }, [state.index, itemW, reduced, ind]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - rowW) > 0.5) {
      setRowW(w);
      rowWidth.value = w;
    }
  };

  const indicatorStyle = useAnimatedStyle(() => {
    const q = ind.pose.value;
    return {
      opacity: q.placed ? 1 : 0,
      width: q.size,
      transform: [{ translateX: q.pos - q.size / 2 }, { scaleX: q.along }, { scaleY: q.across }],
    };
  });
  // 창 안의 흰 메뉴를 제자리에 — 창의 역(1/늘어남, -왼쪽)을 창 가운데를 기준으로
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

  // 위에 화면을 밀어 넣으면(보드·항목 — 투명한 화면) 아래 탭이 비치지 않게 감춘다
  return (
    <Animated.View
      collapsable={false}
      style={[styles.bar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }, fadeStyle]}
    >
      <Glass radius={22} k={1} lift={0.3} style={styles.plate}>
        <View style={styles.row} onLayout={onLayout}>
          <Animated.View pointerEvents="none" style={[styles.indicator, indicatorStyle]}>
            <View style={[darkLayer(p, ITEM_H / 2, 0), styles.indicatorShadow]} />
          </Animated.View>
          {state.routes.map((route, index) => {
            const on = state.index === index;
            const meta = TAB_META[route.name as keyof TabParams];
            const left = index * (itemW + GAP);
            const press = (e: GestureResponderEvent) => {
              pressedAt.current = nowSec();
              if (!on && !reduced && itemW > 0) {
                const { locationX, locationY } = e.nativeEvent;
                ripple.play(
                  rippleAt({ x: left, y: 0, width: itemW, height: ITEM_H }, { x: left + locationX, y: locationY }),
                );
              }
            };
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={meta.label}
                onPressIn={press}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!on && !event.defaultPrevented) navigation.navigate(route.name);
                }}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                style={styles.item}
              >
                <TabFace label={meta.label} Icon={meta.icon} on={on} />
              </Pressable>
            );
          })}
          <RippleLayer fx={ripple} />
          {/* 알약을 따라가는 창 — 같은 메뉴를 흰 글자로 한 벌 더(누르기·읽어 주기에서는 빠진다) */}
          <Animated.View
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[styles.window, indicatorStyle]}
          >
            <Animated.View style={[styles.inner, { width: rowW }, innerStyle]}>
              {state.routes.map(route => {
                const meta = TAB_META[route.name as keyof TabParams];
                const Icon = meta.icon;
                return (
                  <View key={route.key} style={[styles.item, styles.face]}>
                    <View style={styles.iconShadow}>
                      <Icon size={ICON} strokeWidth={2} color="#ffffff" />
                    </View>
                    <WText size={11} weight="500" onDark>
                      {meta.label}
                    </WText>
                  </View>
                );
              })}
            </Animated.View>
          </Animated.View>
        </View>
      </Glass>
    </Animated.View>
  );
}

/**
 * 칸 글자 — 잉크 글자 위에 흰 겹(고른 칸에서만 0.1초에 떠오른다). 흰 겹이 다 떠오르면 밑의 잉크 글자를 감춘다(가장자리가
 * 비치지 않게), 풀 때는 곧바로 다시 보인다(웹 .wl-nav__face--on·--ink).
 */
function TabFace({ label, Icon, on }: { label: string; Icon: (typeof TAB_META)['MyWork']['icon']; on: boolean }) {
  const white = useSharedValue(on ? 1 : 0);
  const ink = useSharedValue(on ? 0 : 1);
  useEffect(() => {
    white.value = withTiming(on ? 1 : 0, { duration: QUICK_MS });
    ink.value = on ? withDelay(QUICK_MS, withTiming(0, { duration: 0 })) : 1;
  }, [on, white, ink]);
  const inkStyle = useAnimatedStyle(() => ({ opacity: ink.value }));
  const whiteStyle = useAnimatedStyle(() => ({ opacity: white.value }));
  return (
    <>
      <Animated.View style={[styles.face, inkStyle]}>
        <Icon size={ICON} strokeWidth={2} color={W.ink2} />
        <WText size={11} weight="500" color={W.ink2}>
          {label}
        </WText>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.face, whiteStyle]}>
        <View style={styles.iconShadow}>
          <Icon size={ICON} strokeWidth={2} color="#ffffff" />
        </View>
        <WText size={11} weight="500" onDark>
          {label}
        </WText>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: { paddingTop: PAD, paddingHorizontal: 12, backgroundColor: 'transparent' },
  plate: { padding: PAD },
  row: { flexDirection: 'row', gap: GAP, height: ITEM_H },
  item: { flex: 1, height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  face: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  indicator: { position: 'absolute', left: 0, top: 0, height: ITEM_H, borderRadius: ITEM_H / 2 },
  // 웹 사이드바 알약 그림자(0 3px 7px 26%)
  indicatorShadow: { boxShadow: [{ offsetX: 0, offsetY: 3, blurRadius: 7, color: 'rgba(0, 0, 0, 0.26)' }] },
  window: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: ITEM_H,
    borderRadius: ITEM_H / 2,
    overflow: 'hidden',
  },
  inner: { position: 'absolute', left: 0, top: 0, height: ITEM_H, flexDirection: 'row', gap: GAP },
  // 흰 아이콘 아래로 번지는 옅은 그림자(D7 0 0.08em 0.08em 12%) — iOS는 filter drop-shadow가 없어 그림자 속성으로
  iconShadow: { shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 1, shadowOffset: { width: 0, height: 1.6 } },
});

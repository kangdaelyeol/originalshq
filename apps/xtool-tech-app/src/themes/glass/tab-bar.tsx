import { Pressable, StyleSheet, Text as RNText } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useFocusFade } from '../../features/focus-fade';
import { TAB_META } from '../../navigation/tab-meta';
import type { TabParams } from '../../navigation/types';
import { EDGE, font, RADIUS, RAISED, T } from './theme';
import { useGlass } from './theme-context';
import { GlassSurface } from './glass-surface';

/**
 * 아래 탭 — 웹 사이드바(유리 판 r18)의 메뉴를 가로로. 메뉴 한 칸은 웹 .nav-item(r11, 쉴 때 아이콘 text-3 · 글 text-2),
 * 고른 칸은 볼록 칸(raised) + 글 text-1 + 아이콘 강조색. 화면 가장자리에서 12 띄워 떠 있다.
 * 위에 화면을 밀어 넣으면(보드·항목 — 투명한 화면) 아래 탭이 비치지 않게 흐려진다.
 */
export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const { a } = useGlass();
  const insets = useSafeAreaInsets();
  const fadeStyle = useFocusFade();

  return (
    <Animated.View
      collapsable={false}
      style={[styles.wrap, { paddingBottom: insets.bottom > 0 ? insets.bottom - 6 : 6 }, fadeStyle]}
    >
      <GlassSurface radius={RADIUS.card} style={styles.bar}>
        {state.routes.map((route, index) => {
          const on = state.index === index;
          const meta = TAB_META[route.name as keyof TabParams];
          const Icon = meta.icon;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={meta.label}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!on && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => [styles.item, on ? RAISED : pressed ? styles.pressed : null]}
            >
              <Icon size={18} strokeWidth={2} color={on ? a.accent : T.text3} />
              <RNText style={[styles.label, { color: on ? T.text1 : T.text2 }]} numberOfLines={1}>
                {meta.label}
              </RNText>
            </Pressable>
          );
        })}
      </GlassSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 6, paddingHorizontal: EDGE },
  bar: { flexDirection: 'row', gap: 4, padding: 6 },
  // 웹 .nav-item — r11, 테두리 1px(쉴 때 투명)
  item: {
    flex: 1,
    height: 48,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.045)', borderColor: 'rgba(255, 255, 255, 0.06)' },
  label: font(11, 500),
});

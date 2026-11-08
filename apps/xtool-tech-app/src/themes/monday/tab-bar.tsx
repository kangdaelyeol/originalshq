import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { TAB_META } from '../../navigation/tab-meta';
import type { TabParams } from '../../navigation/types';
import { MText } from './parts/basics';
import { useMon } from './theme-context';

/** 아래 탭 — 사이드바 모양: --mon-nav 바탕, 위 1px 줄, 고른 탭은 --mon-selected-nav 알약에 흰 글자(웹 메뉴 고른 모양) */
export function MondayTabBar({ state, navigation }: BottomTabBarProps) {
  const p = useMon();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: p.nav,
        borderTopWidth: 1,
        borderColor: p.line,
        paddingTop: 6,
        paddingBottom: insets.bottom || 8,
        paddingHorizontal: 8,
        gap: 6,
      }}
    >
      {state.routes.map((route, index) => {
        const on = state.index === index;
        const meta = TAB_META[route.name as keyof TabParams];
        const Icon = meta.icon;
        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!on && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={({ pressed }) => ({
              flex: 1,
              height: 50,
              borderRadius: 4,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              backgroundColor: on ? p.selectedNav : pressed ? p.overlay : 'transparent',
            })}
          >
            <Icon size={21} strokeWidth={2} color={on ? p.selectedInk : p.text2} />
            <MText size={11} color={on ? p.selectedInk : p.textSoft}>
              {meta.label}
            </MText>
          </Pressable>
        );
      })}
    </View>
  );
}

import { useEffect } from 'react';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';

// 포커스를 잃은 화면 감추기 — 배경을 Frame이 한 장 그리는 테마(글라스·물)는 화면 바탕이 투명해서, 위에 밀어 넣은
// 화면이 미끄러져 들어올 때 아래 화면 내용이 비친다. 그래서 포커스를 잃은 화면(과 아래 탭)은 내용을 감춘다.

/**
 * 포커스를 잃으면 0.12초에 사라지고, 돌아오면 0.22초에 나타나는 opacity — 받는 뷰는 collapsable={false}(Fabric 재부모화
 * 방지). instantOut이면 잃을 때 바로 감춘다(물 — 그림자 겹이 많은 화면을 흐리게 하는 동안 매 프레임 다시 그리지 않게).
 */
export function useFocusFade(instantOut = false) {
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const v = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    v.value =
      reduced || (instantOut && !focused)
        ? focused
          ? 1
          : 0
        : withTiming(focused ? 1 : 0, { duration: focused ? 220 : 120 });
  }, [focused, reduced, instantOut, v]);
  return useAnimatedStyle(() => ({ opacity: v.value }));
}

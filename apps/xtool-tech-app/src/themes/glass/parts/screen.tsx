import { RefreshControl, StyleSheet, Text as RNText, View } from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, CloudCheck } from 'lucide-react-native';
import { useSyncStatus } from '@xtool-core/tech-outbox';
import type { ScreenHeaderProps, ScreenProps } from '../../dashboard/parts';
import { EDGE, font, GAP, RADIUS, T } from '../theme';
import { useStyles } from '../theme-context';
import { GlassSurface, SpaceProvider, useScrollSpace } from '../glass-surface';
import { IconButton } from './controls';
import { SpinIcon } from './text';
import { useFocusFade } from '../../../features/focus-fade';

// 화면 틀 — 웹 셸(.shell padding 12 · 판 사이 20)과 상단바(.topbar 유리 판). 배경은 Frame이 화면 뒤에 한 장 그리고
// 화면은 투명하다. 그래서 밀어 넣은 화면이 미끄러져 들어올 때 아래 화면이 비치지 않게, 포커스를 잃은 화면은 내용을
// 흐리게 감춘다(useFocusFade — 물도 같이 쓴다).

/**
 * 화면 바탕 — 위 고정 머리(없으면 위 안전 영역), 세로 스크롤(키보드 피하기·당겨서 새로고침), 판 사이 20, 좌우 12,
 * 아래 고정 자리(고르기 막대). 판들은 스크롤 공간 안이라 흐린 바탕이 스크롤을 따라 화면에 붙어 있다.
 */
export function Screen({ children, header, footer, scroll = true, refreshing, onRefresh, inTabs }: ScreenProps) {
  const s = useStyles(screenStyles);
  const insets = useSafeAreaInsets();
  const fade = useFocusFade();
  const { space, viewport, content, scrollY, onViewportLayout, onContentChange } = useScrollSpace();
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });
  const top = header ? 8 : insets.top + 12;
  const bottom = (inTabs ? 12 : Math.max(insets.bottom, 12) + 8) + (footer ? 72 : 0);

  return (
    <Animated.View collapsable={false} style={[s.screen, fade]}>
      {header}
      <View ref={viewport} collapsable={false} onLayout={onViewportLayout} style={s.viewport}>
        <SpaceProvider space={space}>
          {scroll ? (
            <Animated.ScrollView
              onScroll={onScroll}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}
              indicatorStyle="white"
              onContentSizeChange={onContentChange}
              refreshControl={
                onRefresh ? (
                  <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={T.text3} />
                ) : undefined
              }
            >
              <View
                ref={content}
                collapsable={false}
                onLayout={onContentChange}
                style={[s.content, { paddingTop: top, paddingBottom: bottom }]}
              >
                {children}
              </View>
            </Animated.ScrollView>
          ) : (
            <View
              ref={content}
              collapsable={false}
              onLayout={onContentChange}
              style={[s.content, s.fill, { paddingTop: top, paddingBottom: bottom }]}
            >
              {children}
            </View>
          )}
        </SpaceProvider>
      </View>
      {footer ? (
        <View pointerEvents="box-none" style={[s.footer, { bottom: inTabs ? 12 : Math.max(insets.bottom, 12) }]}>
          {footer}
        </View>
      ) : null}
    </Animated.View>
  );
}

const screenStyles = () => ({
  screen: { flex: 1 },
  viewport: { flex: 1 },
  fill: { flex: 1 },
  content: { paddingHorizontal: EDGE, gap: GAP },
  footer: { position: 'absolute' as const, left: EDGE, right: EDGE, alignItems: 'center' as const },
});

/** 저장 표시(웹 SyncStatus) — 저장 중 N건(도는 아이콘) · 모두 저장됨. 아직 고친 게 없으면 안 그린다 */
export function SyncStatus() {
  const { saving, savedAt } = useSyncStatus();
  if (saving > 0) {
    return (
      <View style={sync.row} accessibilityRole="text" accessibilityLabel={`저장 중 ${saving}건`}>
        <SpinIcon size={14} color={T.text2} />
        <RNText style={[sync.text, { color: T.text2 }]}>저장 중 {saving}건</RNText>
      </View>
    );
  }
  if (savedAt === null) return null;
  return (
    <View style={sync.row} accessibilityLabel="고친 것을 모두 Monday에 저장했어요">
      <CloudCheck size={15} strokeWidth={2} color={T.text3} />
      <RNText style={sync.text}>모두 저장됨</RNText>
    </View>
  );
}

const sync = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { ...font(12.5), color: T.text3 },
});

/**
 * 화면 머리(웹 상단바 .topbar) — 유리 판 r18, 높이 64 이상, 제목 17/700. 뒤로가 있으면 왼쪽에 오목 단추.
 * 위 안전 영역을 이 머리가 맡는다.
 */
export function ScreenHeader({ title, eyebrow, subtitle, onBack, right, sync: showSync = true }: ScreenHeaderProps) {
  const s = useStyles(headerStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.wrap, { paddingTop: insets.top + 6 }]}>
      <GlassSurface radius={RADIUS.card} style={[s.bar, onBack ? s.barBack : null]}>
        {onBack ? <IconButton icon={ChevronLeft} label="뒤로" onPress={onBack} /> : null}
        <View style={s.heading}>
          {eyebrow ? (
            <RNText style={s.eyebrow} numberOfLines={1}>
              {eyebrow}
            </RNText>
          ) : null}
          <RNText style={s.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </RNText>
          {subtitle ? (
            <RNText style={s.subtitle} numberOfLines={1}>
              {subtitle}
            </RNText>
          ) : null}
        </View>
        {right || showSync ? (
          <View style={s.controls}>
            {showSync ? <SyncStatus /> : null}
            {right}
          </View>
        ) : null}
      </GlassSurface>
    </View>
  );
}

const headerStyles = () => ({
  wrap: { paddingHorizontal: EDGE },
  bar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    minHeight: 64,
    paddingVertical: 12,
    paddingLeft: 18,
    paddingRight: 14,
  },
  barBack: { paddingLeft: 12 },
  heading: { flex: 1, minWidth: 0 },
  eyebrow: { ...font(11.5), color: T.text4, marginBottom: 1 },
  title: { ...font(17, 700, { ls: -0.01, lh: 1.35 }), color: T.text1 },
  subtitle: { ...font(12), color: T.text3, marginTop: 2 },
  controls: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
});

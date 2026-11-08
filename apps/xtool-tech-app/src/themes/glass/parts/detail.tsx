import { Fragment } from 'react';
import { Pressable, RefreshControl, Text as RNText, View } from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, PenLine } from 'lucide-react-native';
import type { DetailFieldsProps, DetailListProps, DetailShellProps, DetailTextProps } from '../../dashboard/parts';
import { EDGE, font, LABEL_CAPS, RADIUS, T, TABULAR, WELL } from '../theme';
import { useStyles } from '../theme-context';
import { GlassSurface, SpaceProvider, useScrollSpace } from '../glass-surface';
import { Button, IconButton, Segmented, StagePill, StatusPill } from './controls';
import { useFocusFade } from '../../../features/focus-fade';
import { InPanelContext } from './surfaces';

// 상세 — 웹 RecordDrawer(가운데 뜨는 유리 판: 막 위 바탕 농도+0.3, r20 · 머리 아래 줄 · 정보/업데이트 탭 · 본문 스크롤)를
// 폰에서는 화면 하나를 채우는 판으로(웹 ≤720px 서랍처럼 가장자리 12 띄움). 이름/값·긴 글·작은 목록은 서랍 본문 모양 그대로.

/** 상세 화면 틀 — 머리(뒤로 · 보드 이름 · 이름 18/700 · 단계 · 수정/삭제), 탭, 본문 스크롤(키보드 피하기), 아래 고정 */
export function DetailShell({
  title,
  eyebrow,
  onPressEyebrow,
  stage,
  pill,
  onBack,
  actions,
  tabs,
  children,
  footer,
  refreshing,
  onRefresh,
}: DetailShellProps) {
  const s = useStyles(shellStyles);
  const insets = useSafeAreaInsets();
  const fade = useFocusFade();
  const body = useScrollSpace();
  const onScroll = useAnimatedScrollHandler(e => {
    body.scrollY.value = e.contentOffset.y;
  });
  return (
    <Animated.View
      collapsable={false}
      style={[s.screen, { paddingTop: insets.top + 6, paddingBottom: Math.max(insets.bottom, 12) }, fade]}
    >
      <GlassSurface radius={RADIUS.drawer} tint="strong" scrim={T.scrim} style={s.panel}>
        <View style={s.header}>
          <View style={s.topRow}>
            <IconButton icon={ChevronLeft} label="뒤로" onPress={onBack} />
            <View style={s.flex} />
            {actions?.map(action =>
              action.danger ? (
                <IconButton
                  key={action.key}
                  icon={action.icon}
                  label={action.label}
                  onPress={action.onPress}
                  tone="danger"
                />
              ) : (
                <Button
                  key={action.key}
                  label={action.label}
                  icon={action.icon}
                  variant="secondary"
                  size="sm"
                  onPress={action.onPress}
                />
              ),
            )}
          </View>
          <View style={s.heading}>
            {eyebrow ? (
              onPressEyebrow ? (
                <Pressable onPress={onPressEyebrow} hitSlop={6} accessibilityRole="link">
                  {({ pressed }) => (
                    <RNText style={[s.eyebrow, s.eyebrowLink, pressed && { opacity: 0.7 }]} numberOfLines={1}>
                      {eyebrow} ›
                    </RNText>
                  )}
                </Pressable>
              ) : (
                <RNText style={s.eyebrow} numberOfLines={1}>
                  {eyebrow}
                </RNText>
              )
            ) : null}
            <RNText style={s.title} selectable accessibilityRole="header">
              {title || '(이름 없음)'}
            </RNText>
            {stage ? <StagePill stage={stage.stage} status={stage.status} /> : null}
            {pill ? <StatusPill tone={pill.tone} label={pill.label} dot={pill.dot} /> : null}
          </View>
        </View>
        {tabs ? (
          <View style={s.tabs}>
            <Segmented options={tabs.options} value={tabs.value} onChange={tabs.onChange} size="sm" label="상세 보기" />
          </View>
        ) : null}
        <View ref={body.viewport} collapsable={false} onLayout={body.onViewportLayout} style={s.flex}>
          <SpaceProvider space={body.space}>
            <Animated.ScrollView
              onScroll={onScroll}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets
              onContentSizeChange={body.onContentChange}
              refreshControl={
                onRefresh ? (
                  <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={T.text3} />
                ) : undefined
              }
            >
              <View ref={body.content} collapsable={false} style={s.body}>
                <InPanelContext.Provider value>{children}</InPanelContext.Provider>
              </View>
            </Animated.ScrollView>
          </SpaceProvider>
        </View>
        {footer ? <View style={s.footer}>{footer}</View> : null}
      </GlassSurface>
    </Animated.View>
  );
}

const shellStyles = () => ({
  screen: { flex: 1, paddingHorizontal: EDGE },
  panel: { flex: 1, overflow: 'hidden' as const },
  flex: { flex: 1 },
  // 웹 .drawer__header — p 20/20/16, gap 12, 아래 줄
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  topRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  heading: { paddingHorizontal: 4, alignItems: 'flex-start' as const, gap: 6 },
  eyebrow: { ...font(11.5), color: T.text4 },
  eyebrowLink: { color: T.text3 },
  title: { ...font(18, 700, { lh: 1.35 }), color: T.text1 },
  tabs: { paddingTop: 12, paddingHorizontal: 20 },
  // 웹 .drawer__body — p 16/20/20, 사이 18
  body: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20, gap: 18 },
  footer: { paddingVertical: 14, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: T.line },
});

/** 상세 구역 제목(웹 .drawer__section h3 — label-caps, 아래 8) */
export function SectionTitle({ text }: { text: string }) {
  return <RNText style={[LABEL_CAPS, { marginBottom: 8 }]}>{text}</RNText>;
}

/** 이름/값 목록(웹 .drawer__fields — 84px | 나머지, 사이 9/12, 13px: 이름 text-4 · 값 text-1). 고칠 수 있으면 연필 */
export function DetailFields({ title, fields, style }: DetailFieldsProps) {
  const s = useStyles(fieldStyles);
  return (
    <View style={style}>
      {title ? <SectionTitle text={title} /> : null}
      <View style={s.list}>
        {fields.map(field => {
          const empty = field.value === null || field.value === undefined || field.value === '';
          const value = field.content ?? (
            <RNText style={[s.value, empty && s.dash]} selectable={!field.onPress}>
              {empty ? '—' : field.value}
            </RNText>
          );
          const inner = (
            <Fragment>
              <RNText style={s.label}>{field.label}</RNText>
              <View style={s.valueBox}>{value}</View>
              {field.onPress ? <PenLine size={13} strokeWidth={2} color={T.text4} style={s.pen} /> : null}
            </Fragment>
          );
          return field.onPress ? (
            <Pressable
              key={field.key}
              onPress={field.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${field.label} 고치기`}
              style={({ pressed }) => [s.row, s.editable, pressed && s.pressed]}
            >
              {inner}
            </Pressable>
          ) : (
            <View key={field.key} style={s.row}>
              {inner}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const fieldStyles = () => ({
  list: { gap: 9 - 6 },
  row: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 12, paddingVertical: 3 },
  editable: { marginHorizontal: -6, paddingHorizontal: 6, borderRadius: 8 },
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  label: { ...font(13, 400, { lh: 1.5 }), color: T.text4, width: 84 },
  valueBox: { flex: 1, minWidth: 0, alignItems: 'flex-start' as const },
  value: { ...font(13, 400, { lh: 1.5 }), color: T.text1 },
  dash: { color: T.text3 },
  pen: { marginTop: 3 },
});

/** 긴 글(웹 .drawer__section + .drawer__text — 오목 칸 p 12/14 r12, 13 lh1.6 text-2) */
export function DetailText({ label, text, onPress, style }: DetailTextProps) {
  const s = useStyles(textStyles);
  const box = (pressed: boolean) => (
    <View style={[s.box, pressed && s.pressed]}>
      <RNText style={s.text} selectable={!onPress}>
        {text}
      </RNText>
      {onPress ? <PenLine size={13} strokeWidth={2} color={T.text4} style={s.pen} /> : null}
    </View>
  );
  return (
    <View style={style}>
      <SectionTitle text={label} />
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} 고치기`}>
          {({ pressed }) => box(pressed)}
        </Pressable>
      ) : (
        box(false)
      )}
    </View>
  );
}

const textStyles = () => ({
  box: { ...WELL, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row' as const, gap: 8 },
  pressed: { backgroundColor: 'rgba(0, 0, 0, 0.32)' },
  text: { ...font(13, 400, { lh: 1.6 }), color: T.text2, flex: 1 },
  pen: { marginTop: 4 },
});

/** 작은 목록(웹 DrawerList — 줄 py7 아래 줄, 12.5 text-2 · 오른쪽 흐린 수) */
export function DetailList({ title, items, style }: DetailListProps) {
  const s = useStyles(listStyles);
  return (
    <View style={style}>
      <SectionTitle text={title} />
      <View style={s.list}>
        {items.map(item => (
          <View key={item.key} style={s.row}>
            <RNText style={s.label}>{item.label}</RNText>
            {item.meta ? <RNText style={s.meta}>{item.meta}</RNText> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const listStyles = () => ({
  list: { gap: 2 },
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  label: { ...font(12.5, 400, { lh: 1.5 }), color: T.text2, flex: 1 },
  meta: { ...font(12.5, 400, { lh: 1.5 }), ...TABULAR, color: T.text3 },
});

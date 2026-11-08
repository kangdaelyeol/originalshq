import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text as RNText,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, TriangleAlert, X } from 'lucide-react-native';
import type { ConfirmDialogProps, OptionRowProps, SelectionBarProps, SheetProps } from '../../dashboard/parts';
import { alpha, font, RADIUS, T, TABULAR } from '../theme';
import { useGlass, useStyles, type GlassState } from '../theme-context';
import { GlassSurface, SpaceProvider, useFixedSpace, useScrollSpace } from '../glass-surface';
import { Button, IconButton } from './controls';
import { InPanelContext, markRow } from './surfaces';

// 떠 있는 판 — 웹 서랍(.drawer: 막 rgba(0,0,0,.38) 위 유리 판, 바탕 농도+0.3, r20)을 폰에서는 아래에서 올라오는 시트로,
// 확인 모달(.confirm), 고르기 막대(.selbar). 모달 안은 따로 뜬 창이라 그 뿌리를 판들의 공간으로 둔다.

const DRAWER_SPRING = { stiffness: 420, damping: 38, mass: 1 };

/** 아래에서 올라오는 판 — 막(0.38) + 유리 판(위 모서리 20, 농도+0.3) · 머리(제목 18/700)·본문(스크롤)·아래 고정 */
export function Sheet({ visible, onClose, title, subtitle, children, footer, tall, scroll = true }: SheetProps) {
  const s = useStyles(sheetStyles);
  const { height: winH } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const shift = useSharedValue(winH);
  const dim = useSharedValue(0);
  const panelH = useRef(0);
  const root = useFixedSpace();

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    // 닫기 — 내려가며 막이 걷힌 뒤 모달을 뗀다
    const out = Math.max(panelH.current, 320);
    shift.value = reduced ? out : withTiming(out, { duration: 200 });
    dim.value = reduced ? 0 : withTiming(0, { duration: 200 });
    const id = setTimeout(
      () => {
        panelH.current = 0;
        setMounted(false);
      },
      reduced ? 0 : 210,
    );
    return () => clearTimeout(id);
  }, [visible, mounted, reduced, shift, dim]);

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: shift.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const maxH = winH * 0.88;

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View ref={root.ref} onLayout={root.onLayout} collapsable={false} style={StyleSheet.absoluteFill}>
        <SpaceProvider space={root.space}>
          <Animated.View style={[StyleSheet.absoluteFill, s.scrim, scrimStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
          </Animated.View>
          <KeyboardAvoidingView behavior="padding" style={s.kav} pointerEvents="box-none">
            <Animated.View
              collapsable={false}
              onLayout={e => {
                const h = e.nativeEvent.layout.height;
                const first = panelH.current === 0;
                panelH.current = h;
                if (first && visible) {
                  // 처음 자리 잡을 때 판 높이만큼 아래에서 올라온다(웹 서랍 spring 420/38)
                  shift.value = h;
                  shift.value = reduced ? 0 : withSpring(0, DRAWER_SPRING);
                  dim.value = reduced ? 1 : withTiming(1, { duration: 180 });
                }
                // 키보드에 밀려 판 자리가 바뀌면 판의 흐린 바탕도 다시 맞춘다
                root.onLayout();
              }}
              style={[{ maxHeight: maxH }, tall && { height: maxH }, panelStyle]}
            >
              <GlassSurface
                radius={RADIUS.drawer}
                topOnly
                tint="strong"
                scrim={T.scrim}
                shiftY={shift}
                style={[s.panel, tall && s.fill]}
              >
                <SheetBody title={title} subtitle={subtitle} footer={footer} scroll={scroll} onClose={onClose}>
                  {children}
                </SheetBody>
              </GlassSurface>
            </Animated.View>
          </KeyboardAvoidingView>
        </SpaceProvider>
      </View>
    </Modal>
  );
}

/** 시트 안 — 모달 뿌리 공간 안에서 본문 스크롤 공간을 만든다 */
function SheetBody({
  title,
  subtitle,
  footer,
  scroll,
  onClose,
  children,
}: Pick<SheetProps, 'title' | 'subtitle' | 'footer' | 'scroll' | 'onClose' | 'children'>) {
  const s = useStyles(sheetStyles);
  const insets = useSafeAreaInsets();
  const body = useScrollSpace();
  const onScroll = useAnimatedScrollHandler(e => {
    body.scrollY.value = e.contentOffset.y;
  });
  const endPad = !footer ? { paddingBottom: Math.max(insets.bottom, 12) + 8 } : null;
  return (
    <InPanelContext.Provider value>
      <View style={s.grabber} />
      {title || subtitle ? (
        <View style={s.header}>
          <View style={s.heading}>
            {title ? (
              <RNText style={s.title} accessibilityRole="header">
                {title}
              </RNText>
            ) : null}
            {subtitle ? <RNText style={s.subtitle}>{subtitle}</RNText> : null}
          </View>
          <IconButton icon={X} label="닫기" onPress={onClose} />
        </View>
      ) : null}
      {scroll ? (
        <View ref={body.viewport} collapsable={false} onLayout={body.onViewportLayout} style={s.shrink}>
          <SpaceProvider space={body.space}>
            <Animated.ScrollView
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              scrollEventThrottle={16}
              onContentSizeChange={body.onContentChange}
            >
              <View ref={body.content} collapsable={false} style={[s.body, endPad]}>
                {children}
              </View>
            </Animated.ScrollView>
          </SpaceProvider>
        </View>
      ) : (
        <View style={[s.body, s.shrink, endPad]}>{children}</View>
      )}
      {footer ? <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>{footer}</View> : null}
    </InPanelContext.Provider>
  );
}

const sheetStyles = () => ({
  scrim: { backgroundColor: T.scrim },
  kav: { flex: 1, justifyContent: 'flex-end' as const },
  panel: { borderBottomWidth: 0, paddingTop: 6 },
  fill: { flex: 1 },
  shrink: { flexShrink: 1 },
  grabber: {
    alignSelf: 'center' as const,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginBottom: 4,
  },
  // 웹 .drawer__header — p 20/20/16, 아래 줄
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  heading: { flex: 1, minWidth: 0, gap: 4 },
  title: { ...font(18, 700, { lh: 1.35 }), color: T.text1 },
  subtitle: { ...font(12.5, 400, { lh: 1.45 }), color: T.text3 },
  // 웹 .drawer__body — p 16/20/20, 사이 18
  body: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20, gap: 18 },
  // 웹 .drawer__footer — p 14/20, 위 줄(안의 배치는 화면이 — 단추 줄은 오른쪽 정렬로 넘긴다)
  footer: {
    paddingTop: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
});

/** 고르기 줄 — 시트 안 목록·설정 목록. 고른 것은 옅은 판 + 강조 체크 */
export function OptionRow({
  label,
  onPress,
  description,
  selected,
  icon: I,
  left,
  right,
  danger,
  disabled,
  style,
}: OptionRowProps) {
  const s = useStyles(optionStyles);
  const { a } = useGlass();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={({ pressed }) => [s.row, selected && s.on, pressed && s.pressed, disabled && s.off, style]}
    >
      {left ?? (I ? <I size={18} strokeWidth={2} color={danger ? T.crit : selected ? a.accent : T.text3} /> : null)}
      <View style={s.body}>
        <RNText style={[s.label, danger && { color: T.crit }]} numberOfLines={2}>
          {label}
        </RNText>
        {description ? (
          <RNText style={s.description} numberOfLines={2}>
            {description}
          </RNText>
        ) : null}
      </View>
      {right}
      {selected ? <Check size={16} strokeWidth={2.6} color={a.accent} /> : null}
    </Pressable>
  );
}

const optionStyles = () => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    minHeight: 46,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  on: { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  off: { opacity: 0.45 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  label: { ...font(13.5, 500, { lh: 1.45 }), color: T.text1 },
  description: { ...font(12, 400, { lh: 1.45 }), color: T.text3 },
});

/** 확인 창(웹 .confirm) — 막 .5 위 유리 카드(바탕 .92) r18, 아이콘 원 36, 제목 16/700, 글 13, 취소·확인 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = '취소',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const s = useStyles(confirmStyles);
  const { a } = useGlass();
  const root = useFixedSpace();
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View ref={root.ref} onLayout={root.onLayout} collapsable={false} style={s.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel={cancelLabel} />
        <SpaceProvider space={root.space}>
          <GlassSurface radius={RADIUS.card} tint="solid" style={s.card}>
            <View style={s.top}>
              <View style={[s.icon, danger ? s.iconDanger : { backgroundColor: alpha(a.accent, 0.16) }]}>
                <TriangleAlert size={18} strokeWidth={2} color={danger ? T.crit : a.accent} />
              </View>
              <View style={s.body}>
                <RNText style={s.title} accessibilityRole="header">
                  {title}
                </RNText>
                {message ? <RNText style={s.message}>{message}</RNText> : null}
              </View>
            </View>
            <View style={s.actions}>
              <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
              <Button label={confirmLabel} variant={danger ? 'danger' : 'primary'} onPress={onConfirm} />
            </View>
          </GlassSurface>
        </SpaceProvider>
      </View>
    </Modal>
  );
}

const confirmStyles = () => ({
  scrim: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 24,
    backgroundColor: T.scrimStrong,
  },
  card: { width: '100%' as const, maxWidth: 420, paddingTop: 22, paddingHorizontal: 22, paddingBottom: 18, gap: 14 },
  top: { flexDirection: 'row' as const, gap: 14 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center' as const, justifyContent: 'center' as const },
  iconDanger: { backgroundColor: 'rgba(248, 113, 113, 0.14)' },
  body: { flex: 1, minWidth: 0 },
  title: { ...font(16, 700, { lh: 1.4 }), color: T.text1, marginTop: 6 },
  message: { ...font(13, 400, { lh: 1.6 }), color: T.text2, marginTop: 6 },
  actions: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    gap: 8,
    marginTop: 4,
  },
});

/** 고르기 막대(웹 .selbar) — 유리 r16, 개수 원(강조색) + "개 선택" + 동작(보조 sm) + 풀기 */
export function SelectionBar({ count, actions, onClear, style }: SelectionBarProps) {
  const s = useStyles(selbarStyles);
  return (
    <GlassSurface radius={RADIUS.bar} drop={false} style={[s.bar, style]}>
      <View style={s.count}>
        <RNText style={s.countText}>{count}</RNText>
      </View>
      <RNText style={s.label}>개 선택</RNText>
      {actions.map(action => (
        <SelectionActionButton
          key={action.key}
          label={action.label}
          icon={action.icon}
          danger={action.danger}
          onPress={action.onPress}
        />
      ))}
      <IconButton icon={X} label="선택 해제" onPress={onClear} />
    </GlassSurface>
  );
}

function SelectionActionButton({
  label,
  icon: I,
  danger,
  onPress,
}: {
  label: string;
  icon?: SelectionBarProps['actions'][number]['icon'];
  danger?: boolean;
  onPress: () => void;
}) {
  if (!danger) return <Button label={label} icon={I} variant="secondary" size="sm" onPress={onPress} />;
  // 위험(삭제) — 같은 보조 단추에 위험 색 글자
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [selbarDanger.box, pressed && selbarDanger.on]}
    >
      {I ? <I size={13} strokeWidth={2.4} color={T.crit} /> : null}
      <RNText style={selbarDanger.text}>{label}</RNText>
    </Pressable>
  );
}

const selbarDanger = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  on: { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.14)' },
  text: { ...font(11.5, 500), color: T.crit },
});

const selbarStyles = ({ a }: GlassState) => ({
  bar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'center' as const,
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 10,
    boxShadow: '0 18px 40px -12px rgba(0, 0, 0, 0.6)',
  },
  count: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 7,
    borderRadius: 999,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: a.accent,
  },
  countText: { ...font(13, 700), ...TABULAR, color: a.ink },
  label: { ...font(13), color: T.text2, marginRight: 6 },
});

markRow(OptionRow, 'inset');

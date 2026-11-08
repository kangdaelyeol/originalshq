import { useEffect, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusFade } from '../../../features/focus-fade';
import {
  Check,
  ChevronLeft,
  CircleAlert,
  CloudCheck,
  Info,
  LoaderCircle,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useSyncStatus } from '@xtool-core/tech-outbox';
import type {
  ConfirmDialogProps,
  EmptyStateProps,
  NoticeProps,
  OptionRowProps,
  ScreenHeaderProps,
  ScreenProps,
  SectionProps,
  SheetProps,
  SkeletonProps,
  SpinnerProps,
} from '../../dashboard/parts';
import { clamp01, shade, smooth, spring } from '../motion';
import {
  DANGER_ICON_FILL,
  darkFill,
  DIALOG_FILL,
  glassShadow,
  shadow,
  springArrival,
  springConfig,
  W,
  WATER_REVEAL,
  WATER_SPRING,
} from '../theme';
import { useWater } from '../theme-context';
import { WButton, WChipBox, WIconButton } from './controls';
import { DarkPill, Glass, glassLayer, Groove, solidLayer } from './glass';
import { WEmpty } from './surfaces';
import { InCard, useInCard } from './context';
import { WText } from './text';

// 물 화면 틀(웹 water-shell·water-topbar·drawer-shell·WaterDialog) — 화면 바탕은 비워 두고(틀의 무대 벽이 비친다)
// 판 사이 20px(웹 --wl-gap)·좌우 12px(웹 좁은 화면 셸 여백). 화면이 바뀌면 0.18초에 진해지며 6px 아래에서 move
// 스프링으로 떠오른다. 시트는 불투명 유리 판이 아래에서 move 스프링으로 들어오고 trail(임계 감쇠)로 나간다. 확인 창은
// 유리 판이 물방울에서 가로로 뻗고(extend) 세로로 떨어져 나가듯(detach) 펼쳐진다(D7 펼침·접힘).

const PAGE_X = 12;
const PAGE_GAP = 20;
const MOVE = springConfig(WATER_SPRING.move);
const TRAIL = springConfig(WATER_SPRING.trail);

// ── 돌아가는 표시 ──────────────────────────────────────────────────────────────

export function Spin({ size = 16, color = W.ink2 }: { size?: number; color?: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1);
  }, [t]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <LoaderCircle size={size} color={color} strokeWidth={2} />
    </Animated.View>
  );
}

export function Spinner({ size = 'small', style }: SpinnerProps) {
  return (
    <View style={[styles.center, style]} accessibilityRole="progressbar" accessibilityLabel="불러오는 중">
      <Spin size={size === 'large' ? 28 : 16} />
    </View>
  );
}

// ── 화면 ─────────────────────────────────────────────────────────────────────

/** 화면이 새로 그려질 때 — 0.18초에 진해지고 6px 아래에서 move 스프링으로 떠오른다(웹 .wl-page) */
function useEnter() {
  const reduced = useReducedMotion();
  const o = useSharedValue(0);
  const y = useSharedValue(reduced ? 0 : 6);
  useEffect(() => {
    o.value = withTiming(1, { duration: reduced ? 120 : 180, easing: Easing.out(Easing.quad) });
    if (!reduced) y.value = withSpring(0, MOVE);
    // 붙을 때 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
}

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  refreshing,
  onRefresh,
  inTabs = false,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const enter = useEnter();
  const fade = useFocusFade();
  const top = header ? 6 : insets.top + 12;
  const bottom = (footer ? 84 : 0) + (inTabs ? PAGE_GAP : insets.bottom + PAGE_GAP);
  // 화면 바탕이 투명해(무대는 Frame이 한 장 그린다) 포커스를 잃으면 내용을 감춘다 — 위에 밀어 넣은 화면에 비치지 않게
  return (
    <Animated.View collapsable={false} style={[styles.flex, fade]}>
      {header}
      {/* 움직임 층은 처음부터 끝까지 같은 뷰 — 안의 입력 칸 포커스가 풀리지 않게(Fabric) */}
      <Animated.View collapsable={false} style={[styles.flex, enter]}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.page, { paddingTop: top, paddingBottom: bottom }]}
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={W.ink2} />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.page, { paddingTop: top, paddingBottom: bottom }]}>{children}</View>
        )}
      </Animated.View>
      {footer ? (
        <View pointerEvents="box-none" style={[styles.footer, { bottom: inTabs ? 12 : insets.bottom + 12 }]}>
          {footer}
        </View>
      ) : null}
    </Animated.View>
  );
}

/** 저장 표시(웹 sync-status) — 보내는 중이면 "저장 중 N건", 다 보냈으면 "모두 저장됨", 고친 게 없으면 안 그린다 */
function SyncPill() {
  const { saving, savedAt } = useSyncStatus();
  if (saving > 0) {
    return (
      <WChipBox>
        <Spin size={14} color={W.ink} />
        <WText size={12} weight="500" numberOfLines={1}>
          저장 중 {saving}건
        </WText>
      </WChipBox>
    );
  }
  if (savedAt === null) return null;
  return (
    <WChipBox>
      <CloudCheck size={15} color={W.ink2} strokeWidth={2} />
      <WText size={12} weight="500" color={W.ink2} numberOfLines={1}>
        모두 저장됨
      </WText>
    </WChipBox>
  );
}

/** 화면 머리(웹 water-topbar) — 유리 판 없이 무대 위에 바로. 제목 21/700, 오른쪽 저장 표시 */
export function ScreenHeader({ title, eyebrow, subtitle, onBack, right, sync = true }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      {onBack && <WIconButton icon={ChevronLeft} label="뒤로" size="sm" onPress={onBack} />}
      <View style={styles.flex}>
        {eyebrow ? (
          <WText size={11.5} weight="600" color={W.ink2} numberOfLines={1}>
            {eyebrow}
          </WText>
        ) : null}
        <WText size={onBack ? 19 : 21} weight="700" em={-0.015} numberOfLines={1} accessibilityRole="header">
          {title}
        </WText>
        {subtitle ? (
          <WText size={12} color={W.ink2} numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </WText>
        ) : null}
      </View>
      {right}
      {sync && <SyncPill />}
    </View>
  );
}

/** 구역 — 판 밖의 제목(웹 water-attention__title 15/700) + 오른쪽 + 내용 */
export function Section({ title, aside, right, children, style }: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      {title || right ? (
        <View style={styles.sectionHead}>
          {title ? (
            <WText size={15} weight="700" accessibilityRole="header" style={styles.flexShrink}>
              {title}
              {aside ? (
                <WText size={12} weight="500" color={W.ink2}>
                  {`  ${aside}`}
                </WText>
              ) : null}
            </WText>
          ) : (
            <View style={styles.flex} />
          )}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** 빈 화면·불러오는 중·오류 — 홀로 선 유리 판(lift 0.55) 속 불투명 유리 우물 */
export function EmptyState({ title, text, icon, loading, tone = 'default', action, style }: EmptyStateProps) {
  const inCard = useInCard();
  const Icon: LucideIcon | undefined = tone === 'error' && !icon ? CircleAlert : icon;
  return (
    <Glass radius={22} k={1} lift={0.55} fill={inCard ? 'none' : 'glass'} bare={inCard} style={[styles.empty, style]}>
      {loading ? (
        <View style={styles.emptyMd}>
          <WellSpinner />
          <WText size={15} weight="600" align="center">
            {title}
          </WText>
          {text ? (
            <WText size={12.5} color={W.ink2} lh={1.55} align="center">
              {text}
            </WText>
          ) : null}
        </View>
      ) : (
        <WEmpty
          size="md"
          title={title}
          description={text}
          icon={Icon}
          iconColor={tone === 'error' ? W.crit : undefined}
          action={
            action ? (
              <WButton variant="ghost" size="sm" onPress={action.onPress}>
                {action.label}
              </WButton>
            ) : undefined
          }
        />
      )}
    </Glass>
  );
}

/** 불러오는 중 우물 — 불투명 유리 단추 속에서 도는 표시 */
function WellSpinner() {
  const p = useWater();
  return (
    <View style={styles.wellShadow}>
      <View style={styles.well}>
        <View pointerEvents="none" style={solidLayer(p, 0.46, 28)} />
        <Spin size={24} color="#ffffff" />
      </View>
    </View>
  );
}

/** 안내 줄 — 판 안의 짧은 알림. 옅은 흰 줄 + 상태 아이콘(색은 아이콘에만) + 할 일 링크 */
export function Notice({ text, tone = 'info', loading, action, style }: NoticeProps) {
  const Icon = tone === 'error' ? CircleAlert : tone === 'warn' ? TriangleAlert : Info;
  const color = tone === 'error' ? W.crit : tone === 'warn' ? W.warn : W.info;
  return (
    <View style={[styles.notice, style]} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      {loading ? <Spin size={14} /> : <Icon size={14} color={color} strokeWidth={2.2} />}
      <WText
        size={12.5}
        weight={tone === 'error' ? '600' : '500'}
        color={tone === 'error' ? W.ink : W.ink2}
        style={styles.flex}
      >
        {text}
      </WText>
      {action ? (
        <Pressable hitSlop={8} onPress={action.onPress} accessibilityRole="button">
          <WText size={12.5} weight="600" style={styles.link}>
            {action.label}
          </WText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** 뼈대 블록 — 유리에 파인 빈 홈(D7 track, k = 높이 / 23) */
export function Skeleton({ width = '100%', height, radius = 'md', style }: SkeletonProps) {
  const r = radius === 'pill' ? height / 2 : radius === 'sm' ? 6 : radius === 'lg' ? 14 : 10;
  const k = Math.min(1, Math.max(0.43, height / 23));
  return <Groove k={k} radius={r} style={[{ width, height }, style]} />;
}

// ── 아래에서 올라오는 판 ───────────────────────────────────────────────────────────

/**
 * 시트(웹 서랍·팝오버를 폰에서는 아래 판으로) — 불투명 유리 판(wb-panel 1·1, 둥글기 24)이 화면 아래에서 move 스프링
 * (3.8% 넘침)으로 들어오고, 나갈 때는 trail(넘치지 않음)로 내려가며 끝에 걷힌다. 막은 판이 들어온 만큼 짙어진다.
 * 머리·내용·아래 단추는 판이 처음 제자리에 닿는 0.132초부터 21ms 간격으로 나타난다.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  tall = false,
  scroll = true,
}: SheetProps) {
  const p = useWater();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const [kept, setKept] = useState<ReactNode>(children);
  if (visible && !mounted) setMounted(true);
  if (visible && kept !== children) setKept(children);
  const [panelH, setPanelH] = useState(0);
  const x = useSharedValue(0);
  const fade = useSharedValue(1);
  const reveal = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];

  useEffect(() => {
    if (!mounted || panelH === 0) return;
    if (visible) {
      fade.value = 1;
      x.value = reduced ? withTiming(1, { duration: 100 }) : withSpring(1, MOVE);
      reveal.forEach((r, i) => {
        r.value = reduced
          ? 1
          : withDelay(
              (springArrival(WATER_SPRING.move) + i * WATER_REVEAL.stagger) * 1000,
              withTiming(1, { duration: WATER_REVEAL.fade * 1000, easing: Easing.linear }),
            );
      });
    } else {
      const gone = () => setMounted(false);
      reveal.forEach(r => {
        r.value = withDelay(15, withTiming(0, { duration: WATER_REVEAL.out * 1000 }));
      });
      if (reduced) {
        x.value = withTiming(0, { duration: 100 }, done => {
          if (done) runOnJS(gone)();
        });
        return;
      }
      x.value = withSpring(0, TRAIL);
      // 끝에 유리가 걷힌다(D7 pillOn 0.17 → 0.30s)
      fade.value = withDelay(
        170,
        withTiming(0, { duration: 130 }, done => {
          if (done) runOnJS(gone)();
        }),
      );
    }
    // 공유 값은 처음 만든 그대로다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mounted, panelH]);

  const off = panelH + insets.bottom + 96;
  const panelStyle = useAnimatedStyle(() => ({
    // 크기를 재기 전에는 숨긴다(제자리 아래에 한 프레임 보이지 않게)
    opacity: panelH > 0 ? smooth(fade.value) : 0,
    transform: [{ translateY: (1 - x.value) * off }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: clamp01(x.value) * smooth(fade.value) }));
  const r0 = useAnimatedStyle(() => ({ opacity: reveal[0].value }));
  const r1 = useAnimatedStyle(() => ({ opacity: reveal[1].value }));
  const r2 = useAnimatedStyle(() => ({ opacity: reveal[2].value }));

  if (!mounted) return null;
  const maxH = (tall ? 0.88 : 0.75) * (screenH - insets.top);
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
          <Pressable style={styles.flex} onPress={visible ? onClose : undefined} accessibilityLabel="닫기" />
        </Animated.View>
        <View pointerEvents="box-none" style={[styles.sheetDock, { paddingBottom: insets.bottom + 8 }]}>
          <Animated.View
            collapsable={false}
            pointerEvents={visible ? 'auto' : 'none'}
            onLayout={(e: LayoutChangeEvent) => setPanelH(e.nativeEvent.layout.height)}
            style={[styles.sheet, { maxHeight: maxH }, tall && { height: maxH }, panelStyle]}
          >
            <View pointerEvents="none" style={glassLayer(p, 1, 1, 24, 'pane')} />
            {title ? (
              <Animated.View style={[styles.sheetHead, r0]}>
                <View style={styles.flex}>
                  <WText size={17} weight="700" lh={1.35} accessibilityRole="header">
                    {title}
                  </WText>
                  {subtitle ? (
                    <WText size={12} color={W.ink2} style={styles.subtitle}>
                      {subtitle}
                    </WText>
                  ) : null}
                </View>
                <WIconButton icon={X} label="닫기" size="sm" onPress={onClose} />
              </Animated.View>
            ) : null}
            <Animated.View style={[styles.sheetBodyWrap, r1]}>
              {scroll ? (
                <ScrollView
                  contentContainerStyle={styles.sheetBody}
                  keyboardShouldPersistTaps="handled"
                  automaticallyAdjustKeyboardInsets
                >
                  <InCard.Provider value>{visible ? children : kept}</InCard.Provider>
                </ScrollView>
              ) : (
                <View style={[styles.sheetBody, styles.flexGrow]}>
                  <InCard.Provider value>{visible ? children : kept}</InCard.Provider>
                </View>
              )}
            </Animated.View>
            {footer ? <Animated.View style={[styles.sheetFoot, r2]}>{footer}</Animated.View> : null}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── 고르기 줄 ─────────────────────────────────────────────────────────────────

/** 고른 표시 — 어두운 표시 알약 구슬(D7 고른 것) 속 흰 체크 */
export function PickedMark({ size = 20 }: { size?: number }) {
  return (
    <DarkPill radius={size / 2} em={6} style={[styles.picked, { width: size, height: size }]}>
      <Check size={Math.round(size * 0.62)} color="#ffffff" strokeWidth={3} />
    </DarkPill>
  );
}

/**
 * 고르기 줄 — 누르면 흰 칩이 깔린다(D7 hover 칩). 고른 줄은 밝은 흰 판(웹 물 팝오버 hilite — 위 흰 1px·옅은 그림자)에
 * 진한 이름과 어두운 체크 구슬. 화면이 넣는 왼쪽·오른쪽 것(글·아바타)이 늘 밝은 바탕 위에 오게 한다.
 */
export function OptionRow({
  label,
  onPress,
  description,
  selected = false,
  icon: Icon,
  left,
  right,
  danger,
  disabled,
  style,
}: OptionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[disabled && styles.dim, style]}
    >
      {({ pressed }) => (
        <View style={styles.option}>
          {selected ? (
            <View style={[StyleSheet.absoluteFill, styles.optionOn]} />
          ) : pressed ? (
            <View style={[StyleSheet.absoluteFill, styles.optionPressed]} />
          ) : null}
          {left ?? (Icon ? <Icon size={18} color={danger ? W.crit : W.ink2} strokeWidth={2} /> : null)}
          <View style={styles.flex}>
            <WText size={14} weight={selected ? '700' : '600'} color={danger ? W.critInk : W.ink} numberOfLines={2}>
              {label}
            </WText>
            {description ? (
              <WText size={12} color={W.ink2} numberOfLines={2} style={styles.subtitle}>
                {description}
              </WText>
            ) : null}
          </View>
          {right}
          {selected ? <PickedMark /> : null}
        </View>
      )}
    </Pressable>
  );
}

// ── 확인 창 ─────────────────────────────────────────────────────────────────

/** 펼침 시각(D7 openPose) — 세로로 떨어져 나가기 시작, 첫 내용이 나오는 때 */
const OPEN = { detach: 0.165, item: 0.247, settle: 0.75 };
/** 접힘 — 1단계(다시 붙음) 길이, 판이 걷히는 구간 */
const CLOSE = { gather: 0.188, fadeFrom: 0.17, fadeLen: 0.13 };
const CLOSE_END = CLOSE.gather + CLOSE.fadeFrom + CLOSE.fadeLen;
const DIALOG_R = 26;

/**
 * 확인 창(웹 WaterDialog) — 유리 판이 물방울에서 가로로 뻗고(extend, 16% 넘침) 0.165초 뒤 세로로 떨어져 나가듯
 * 펼쳐지고(detach), 0.247초부터 내용이 21ms 간격으로 나타난다. 닫을 때는 내용이 곧바로 걷히고 세로가 먼저 모이고
 * (gather) 가로가 넘치지 않고 끌려와(trail) 흐려진다.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = '취소',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const p = useWater();
  const reduced = useReducedMotion();
  const { width: screenW } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const t = useSharedValue(0);
  const open = useSharedValue(1);
  const bw = useSharedValue(0);
  const bh = useSharedValue(0);

  useEffect(() => {
    if (!mounted || !box) return;
    const end = reduced ? WATER_REVEAL.indicator : visible ? OPEN.settle : CLOSE_END;
    open.value = visible ? 1 : 0;
    t.value = 0;
    t.value = withTiming(end, { duration: end * 1000, easing: Easing.linear }, done => {
      if (done && !visible) runOnJS(setMounted)(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mounted, box !== null]);

  const pose = (i: number) => {
    'worklet';
    const tt = t.value;
    const w = bw.value;
    const h = bh.value;
    const r0 = Math.min(DIALOG_R, w / 2, h / 2);
    if (reduced) {
      const k = clamp01(tt / WATER_REVEAL.indicator);
      const v = open.value ? k : 1 - k;
      return { hx: w / 2, hy: h / 2, glass: v, scrim: v, item: v };
    }
    if (open.value) {
      return {
        hx: r0 + (w / 2 - r0) * spring(tt, WATER_SPRING.extend),
        hy: r0 + (h / 2 - r0) * spring(tt - OPEN.detach, WATER_SPRING.detach),
        glass: clamp01(tt / WATER_REVEAL.out),
        scrim: shade(tt / WATER_REVEAL.indicator),
        item: clamp01((tt - OPEN.item - i * WATER_REVEAL.stagger) / WATER_REVEAL.fade),
      };
    }
    const tb = tt - CLOSE.gather;
    return {
      hx: w / 2 + (r0 - w / 2) * spring(tb, WATER_SPRING.trail),
      hy: h / 2 + (r0 - h / 2) * spring(tt, WATER_SPRING.gather),
      glass: 1 - smooth((tb - CLOSE.fadeFrom) / CLOSE.fadeLen),
      scrim: 1 - smooth(tt / CLOSE_END),
      item: 1 - clamp01((tt - 0.015) / WATER_REVEAL.out),
    };
  };
  const glassStyle = useAnimatedStyle(() => {
    const q = pose(0);
    const hx = Math.max(0.5, q.hx);
    const hy = Math.max(0.5, q.hy);
    return {
      opacity: q.glass,
      width: hx * 2,
      height: hy * 2,
      left: bw.value / 2 - hx,
      top: bh.value / 2 - hy,
      borderRadius: Math.min(DIALOG_R, hx, hy),
    };
  });
  const scrimStyle = useAnimatedStyle(() => ({ opacity: pose(0).scrim }));
  const i0 = useAnimatedStyle(() => ({ opacity: pose(0).item }));
  const i1 = useAnimatedStyle(() => ({ opacity: pose(1).item }));
  const i2 = useAnimatedStyle(() => ({ opacity: pose(2).item }));

  if (!mounted) return null;
  const IconC = danger ? TriangleAlert : Info;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.dialogLayer}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.dialogScrim, scrimStyle]}>
          <Pressable style={styles.flex} onPress={visible ? onCancel : undefined} accessibilityLabel={cancelLabel} />
        </Animated.View>
        <View
          pointerEvents={visible ? 'box-none' : 'none'}
          accessibilityViewIsModal
          style={[styles.dialog, { width: Math.min(420, screenW - 48) }]}
          onLayout={(e: LayoutChangeEvent) => {
            const { width, height } = e.nativeEvent.layout;
            bw.value = width;
            bh.value = height;
            if (!box || Math.abs(box.w - width) > 0.5 || Math.abs(box.h - height) > 0.5)
              setBox({ w: width, h: height });
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.dialogGlass, { backgroundImage: DIALOG_FILL, boxShadow: glassShadow(p, 1, 1) }, glassStyle]}
          />
          <View style={styles.dialogBody}>
            <Animated.View
              style={[styles.dialogIcon, { backgroundImage: danger ? DANGER_ICON_FILL : darkFill(p) }, i0]}
            >
              <View style={styles.iconShadow}>
                <IconC size={18} color="#ffffff" strokeWidth={2} />
              </View>
            </Animated.View>
            <Animated.View style={[styles.flex, i1]}>
              <WText size={16} weight="700" lh={1.3} style={styles.dialogTitle} accessibilityRole="header">
                {title}
              </WText>
              {message ? (
                <WText size={13} color={W.ink2} lh={1.6} style={styles.dialogMessage}>
                  {message}
                </WText>
              ) : null}
            </Animated.View>
          </View>
          <Animated.View style={[styles.dialogActions, i2]}>
            <WButton variant="ghost" onPress={onCancel}>
              {cancelLabel}
            </WButton>
            <WButton variant={danger ? 'danger' : 'primary'} onPress={onConfirm}>
              {confirmLabel}
            </WButton>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  flexGrow: { flexGrow: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.5 },
  page: { paddingHorizontal: PAGE_X, gap: PAGE_GAP },
  footer: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 46,
    paddingLeft: 18,
    paddingRight: 14,
    paddingBottom: 6,
  },
  subtitle: { marginTop: 3 },
  section: { gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  empty: { paddingHorizontal: 20 },
  emptyMd: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  wellShadow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 8,
    boxShadow: [shadow(4.8, 10.1, 8.3, 4.6, 'rgba(0, 0, 0, 0.13)'), shadow(0, 0, 5.5, 0, 'rgba(0, 0, 0, 0.06)')],
  },
  well: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: W.rowFill,
  },
  link: { textDecorationLine: 'underline', textDecorationColor: W.linkLineStrong },
  scrim: { backgroundColor: W.drawerScrim },
  sheetDock: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 8 },
  sheet: { borderRadius: 24, overflow: 'visible' },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 20,
    paddingBottom: 14,
    paddingLeft: 22,
    paddingRight: 16,
    boxShadow: [shadow(0, -1, 0, 0, W.rule, true)],
  },
  sheetBodyWrap: { flexShrink: 1 },
  sheetBody: { paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  sheetFoot: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    boxShadow: [shadow(0, 1, 0, 0, W.rule, true)],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 46,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  optionPressed: { borderRadius: 14, backgroundColor: W.chip },
  // 웹 water-multi-pop__hilite — 흰 42% + 위 흰 1px + 옅은 그림자
  optionOn: {
    borderRadius: 14,
    backgroundColor: W.chipHover,
    boxShadow: [shadow(0, 1, 0, 0, 'rgba(255, 255, 255, 0.5)', true), shadow(0, 1, 2, 0, 'rgba(0, 0, 0, 0.06)')],
  },
  picked: { alignItems: 'center', justifyContent: 'center' },
  dialogLayer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogScrim: { backgroundColor: W.scrim },
  dialog: { paddingTop: 24, paddingHorizontal: 24, paddingBottom: 20, gap: 14 },
  dialogGlass: { position: 'absolute' },
  dialogBody: { flexDirection: 'row', gap: 14 },
  dialogIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: [shadow(0, 2.6, 6, 0, 'rgba(0, 0, 0, 0.26)')],
  },
  iconShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 0.8,
    shadowOffset: { width: 0, height: 0.6 },
  },
  dialogTitle: { marginTop: 8 },
  dialogMessage: { marginTop: 6 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
});

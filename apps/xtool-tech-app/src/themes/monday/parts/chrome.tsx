import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  makeMutable,
  SlideInDown,
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  CloudCheck,
  Inbox,
  Plus,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useSyncStatus } from '@xtool-core/tech-outbox';
import { FONT, INK, type MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';
import { MText, withAlpha } from './basics';

// 화면 틀의 부품 — 머리(웹 .mon-board__head: 26/500 제목 + 저장 상태 + 종), 밑줄 탭, 도구 단추·도구 탭, 검색 칸, 아래에서
// 올라오는 시트(웹 팝오버를 폰에서는 시트로), 빈 화면, 불러오는 중 뼈대.

/** 저장 상태 — 이번에 저장한 적이 있을 때만: 저장 중이면 돌아가는 표시 + "저장 중 N건", 끝나면 구름 체크(웹 15) */
export function SyncStatus() {
  const p = useMon();
  const { saving, savedAt } = useSyncStatus();
  if (saving > 0) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <ActivityIndicator size="small" color={p.textSoft} />
        <MText size={12.5} color={p.textSoft}>
          저장 중 {saving}건
        </MText>
      </View>
    );
  }
  if (!savedAt) return null;
  return <CloudCheck size={15} color={p.text2} accessibilityLabel="모두 저장됨" />;
}

/** 머리 — 제목 26/500(항목 화면은 24), 오른쪽 저장 상태·종. back이 있으면 왼쪽에 뒤로 단추. */
export function ScreenHeader({
  title,
  onBack,
  right,
  titleSize = 26,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  titleSize?: number;
}) {
  const p = useMon();
  const insets = useSafeAreaInsets();
  const [bell, setBell] = useState(false);
  return (
    <View
      style={{
        paddingTop: insets.top + 10,
        paddingHorizontal: 16,
        paddingBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: p.bg,
      }}
    >
      {onBack && (
        <Pressable onPress={onBack} hitSlop={10} style={{ marginLeft: -6 }} accessibilityLabel="뒤로">
          <ChevronLeft size={26} strokeWidth={2.2} color={p.text} />
        </Pressable>
      )}
      <MText size={titleSize} numberOfLines={1} style={{ flex: 1, letterSpacing: -0.01 * titleSize }}>
        {title}
      </MText>
      {right}
      <SyncStatus />
      <IconButton icon={Bell} size={16} onPress={() => setBell(true)} label="알림" />
      <Sheet visible={bell} onClose={() => setBell(false)} title="알림">
        <EmptyState icon={Inbox} text="알림이 없어요" />
      </Sheet>
    </View>
  );
}

/** 아이콘 단추 36×36, 반경 4(웹 .icon-button) */
export function IconButton({
  icon: Icon,
  onPress,
  color,
  size = 18,
  label,
}: {
  icon: LucideIcon;
  onPress: () => void;
  color?: string;
  size?: number;
  label?: string;
}) {
  const p = useMon();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? p.overlay : 'transparent',
      })}
    >
      <Icon size={size} color={color ?? p.textSoft} />
    </Pressable>
  );
}

/**
 * 보기 탭 — 높이 36, 탭 사이 2, 고른 탭은 2px 파란 밑줄(웹 .mon-tab). onMore가 있으면 고른 탭(moreFor) 안에 22×22 아래
 * 갈매기(보기 메뉴), onAdd가 있으면 맨 끝 "+" 탭(보기 추가).
 */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  style,
  moreFor,
  onMore,
  onAdd,
}: {
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  moreFor?: (value: T) => boolean;
  onMore?: (value: T) => void;
  onAdd?: () => void;
}) {
  const p = useMon();
  return (
    <View style={[{ borderBottomWidth: 1, borderColor: p.line, marginHorizontal: 16 }, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 2, alignItems: 'flex-end' }}
      >
        {tabs.map(tab => {
          const on = tab.value === value;
          const more = on && onMore && moreFor?.(tab.value);
          return (
            <View
              key={tab.value}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: 2,
                borderColor: on ? p.primary : 'transparent',
                marginBottom: -1,
              }}
            >
              <Pressable
                onPress={() => onChange(tab.value)}
                style={{ height: 34, paddingHorizontal: 6, justifyContent: 'center' }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <MText color={on ? p.text : p.text2}>{tab.label}</MText>
              </Pressable>
              {more && (
                <Pressable
                  onPress={() => onMore(tab.value)}
                  hitSlop={6}
                  accessibilityLabel={`${tab.label} 보기 메뉴`}
                  style={({ pressed }) => ({
                    width: 22,
                    height: 22,
                    marginRight: 2,
                    borderRadius: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: pressed ? p.overlay : 'transparent',
                  })}
                >
                  <ChevronDown size={14} color={p.text2} />
                </Pressable>
              )}
            </View>
          );
        })}
        {onAdd && (
          <Pressable
            onPress={onAdd}
            accessibilityLabel="보기 추가"
            style={({ pressed }) => ({
              width: 32,
              height: 34,
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? p.overlay : 'transparent',
            })}
          >
            <Plus size={16} color={p.text2} />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

/** 도구 줄 밑줄 탭 — 높이 32, 옆 10(웹 .mon-tabs .mon-tab: 내 업무 상태·요약 기간) */
export function ToolTabs<T extends string>({
  tabs,
  value,
  onChange,
  style,
}: {
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useMon();
  return (
    <View style={[{ flexDirection: 'row' }, style]} accessibilityRole="radiogroup">
      {tabs.map(tab => {
        const on = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={{
              height: 32,
              paddingHorizontal: 10,
              justifyContent: 'center',
              borderBottomWidth: 2,
              borderColor: on ? p.primary : 'transparent',
            }}
          >
            <MText color={on ? p.text : p.text2}>{tab.label}</MText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 도구 단추 — 높이 32, 반경 4, 켜지면 파란 기운 바탕(웹 .mon-tool). primary면 파란 "새로운 …" 단추. */
export function ToolChip({
  icon: Icon,
  label,
  on,
  primary,
  onPress,
  trailing,
}: {
  icon?: LucideIcon;
  label: string;
  on?: boolean;
  primary?: boolean;
  onPress: () => void;
  trailing?: ReactNode;
}) {
  const p = useMon();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        height: 32,
        paddingLeft: primary ? 10 : 9,
        paddingRight: primary ? 14 : 9,
        marginRight: primary ? 14 : 0,
        borderRadius: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: primary ? 6 : 7,
        backgroundColor: primary
          ? pressed
            ? p.primaryHi
            : p.primary
          : on
          ? p.toolOn
          : pressed
          ? p.overlay
          : 'transparent',
      })}
    >
      {primary ? <Plus size={15} strokeWidth={2.4} color={INK} /> : Icon && <Icon size={15} color={p.text} />}
      <MText color={primary ? INK : p.text}>{label}</MText>
      {trailing}
    </Pressable>
  );
}

/**
 * 검색 칸 — 높이 32, 1px 파란 테두리, 반경 4(웹 .mon-search). 테두리는 입력 칸 자신에 둔다(돋보기는 위에 겹친 형제) —
 * 포커스 때 조상 스타일을 바꾸지 않게(Fabric 키보드 함정).
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  onClose,
  autoFocus = true,
  focusBorder,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  onClose?: () => void;
  autoFocus?: boolean;
  /** 고르기 목록 검색처럼 평소엔 회색 줄, 포커스 때만 파란 줄 */
  focusBorder?: boolean;
}) {
  const p = useMon();
  const s = useStyles(searchStyles);
  const [focused, setFocused] = useState(false);
  return (
    <View collapsable={false}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={p.text2}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        keyboardAppearance={p.scheme}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[s.input, { borderColor: !focusBorder || focused ? p.primary : p.line }]}
      />
      <View pointerEvents="none" style={s.icon}>
        <Search size={focusBorder ? 13 : 15} color={p.text2} />
      </View>
      {(value || onClose) && (
        <Pressable
          onPress={() => (value ? onChange('') : onClose?.())}
          hitSlop={8}
          style={s.clear}
          accessibilityLabel={value ? '검색 지우기' : '검색 닫기'}
        >
          <X size={13} color={p.text2} />
        </Pressable>
      )}
    </View>
  );
}

const searchStyles = (p: MonPalette) => ({
  input: {
    height: 32,
    borderWidth: 1,
    borderRadius: 4,
    paddingLeft: 29,
    paddingRight: 28,
    paddingVertical: 0,
    fontFamily: FONT.medium,
    fontSize: 14,
    color: p.text,
    backgroundColor: p.bg,
  },
  icon: { position: 'absolute' as const, left: 8, top: 0, bottom: 0, justifyContent: 'center' as const },
  clear: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});

/**
 * 아래에서 올라오는 시트 — 웹 팝오버(--mon-pop 바탕, 반경, 그림자)를 폰에서는 시트로. 바깥·X·뒤로 가기는 모두 onClose
 * (편집기는 거기서 저장할지 정한다 — 웹 팝오버 바깥 누르기와 같다). 움직이는 판에는 collapsable={false}(키보드 함정).
 * 모달 자체 애니메이션은 끈다(들어올 때는 reanimated로, 닫을 때는 바로) — iOS는 닫히는 중인 모달이 있으면 같은 화면에서
 * 새 모달을 띄우지 못해, 시트를 닫자마자 다른 칸을 눌러도 바로 뜨게. 메뉴에서 다른 창을 열 때는 onDismissed 뒤에 연다.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  tall,
  closeButton = true,
  footer,
  onDismissed,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** 화면 높이 거의 끝까지 */
  tall?: boolean;
  /** 제목 줄 X — 끄면 시트 안 단추(취소·적용)로 닫는다 */
  closeButton?: boolean;
  /** 아래에 붙는 줄(단추들) — 본문이 길어도 늘 보인다 */
  footer?: ReactNode;
  /** 다 닫힌 뒤(iOS) — 메뉴 시트에서 다음 창(확인·편집)을 열 때 */
  onDismissed?: () => void;
}) {
  const p = useMon();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      onDismiss={onDismissed}
      statusBarTranslucent
    >
      <Animated.View entering={FadeIn.duration(150)} style={{ flex: 1, backgroundColor: p.scrim }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="닫기" />
      </Animated.View>
      {/* 화면 전체 높이의 판(빈 곳은 바깥 누르기로 통과) — 키보드가 오르면 아래 여백만큼 시트가 줄어든다 */}
      <KeyboardAvoidingView
        behavior="padding"
        collapsable={false}
        style={{
          position: 'absolute',
          top: insets.top + 24,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'flex-end',
          pointerEvents: 'box-none',
        }}
      >
        <Animated.View
          entering={SlideInDown.duration(220)}
          collapsable={false}
          style={{
            flexShrink: 1,
            backgroundColor: p.pop,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            borderTopWidth: 1,
            borderColor: p.overlay,
            paddingBottom: footer ? 0 : insets.bottom + 12,
            maxHeight: tall ? '100%' : '82%',
            boxShadow: `0 -10px 34px ${p.shadow}`,
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: p.lineStrong }} />
          </View>
          {!!title && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingTop: 10,
                paddingBottom: 6,
              }}
            >
              <MText size={16} style={{ flex: 1 }} numberOfLines={1}>
                {title}
              </MText>
              {closeButton && (
                <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="닫기">
                  <X size={20} color={p.text2} />
                </Pressable>
              )}
            </View>
          )}
          {children}
          {footer && (
            <View
              style={{
                borderTopWidth: 1,
                borderColor: p.line,
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: insets.bottom + 12,
              }}
            >
              {footer}
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** 시트 안 목록 줄 — 최소 높이 44, 반경 4, 고른 줄은 파란 기운(웹 메뉴·고르기 목록) */
export function SheetRow({
  label,
  on,
  onPress,
  left,
  right,
  danger,
  disabled,
}: {
  label: string;
  on?: boolean;
  onPress: () => void;
  left?: ReactNode;
  right?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  const p = useMon();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 12,
        borderRadius: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        opacity: disabled ? 0.45 : 1,
        backgroundColor: on ? p.toolOn : pressed ? p.overlay : 'transparent',
      })}
    >
      {left}
      <MText style={{ flex: 1 }} numberOfLines={1} color={danger ? p.dangerText : p.text}>
        {label}
      </MText>
      {right}
    </Pressable>
  );
}

/** 메뉴 제목 — 12 흐린 글(웹 .mon-menu__title) */
export function MenuTitle({ children }: { children: ReactNode }) {
  const p = useMon();
  return (
    <MText size={12} color={p.text2} style={{ marginHorizontal: 16, marginTop: 4, marginBottom: 8 }}>
      {children}
    </MText>
  );
}

/**
 * 빈 화면 글. card면 웹 .card.empty(가운데, 1px 줄, 반경 12) — 제목 17/700, 아래 13 흐린 글(보드를 못 불러옴·동기화 전).
 */
export function EmptyState({
  icon: Icon,
  text,
  sub,
  card,
}: {
  icon?: LucideIcon;
  text: string;
  sub?: string;
  card?: boolean;
}) {
  const p = useMon();
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[
        { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 10 },
        card && {
          margin: 16,
          paddingVertical: 64,
          borderWidth: 1,
          borderColor: p.line,
          borderRadius: 12,
          backgroundColor: p.page,
        },
      ]}
    >
      {Icon && (
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            backgroundColor: p.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={22} color={p.text2} />
        </View>
      )}
      <MText
        size={card ? 17 : 14}
        weight={card ? 'bold' : 'medium'}
        color={card ? p.text : p.text2}
        style={{ textAlign: 'center' }}
      >
        {text}
      </MText>
      {!!sub && (
        <MText size={13} color={card ? p.text2 : p.text4} style={{ textAlign: 'center', lineHeight: 19 }}>
          {sub}
        </MText>
      )}
    </Animated.View>
  );
}

// ── 뼈대 ────────────────────────────────────────────────────────────────────────────────────────────────

// 반짝임 — 모든 뼈대 블록이 같은 시계(2초, 일정한 속도)로 함께 빛난다(웹은 블록 전체를 한 줄기 빛이 쓸고 지나간다).
// 뼈대가 하나라도 있을 때만 돈다.
// 시계는 처음 쓸 때 만든다(앱을 열 때 모듈에서 바로 만들지 않게).
let shineClock: SharedValue<number> | null = null;
let shineUsers = 0;
const getShine = (): SharedValue<number> => (shineClock ??= makeMutable(0));

function useShine(reduce: boolean): SharedValue<number> {
  const shine = getShine();
  useEffect(() => {
    if (reduce) return;
    shineUsers += 1;
    if (shineUsers === 1) {
      shine.value = 0;
      shine.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.linear }), -1, false);
    }
    return () => {
      shineUsers -= 1;
      if (shineUsers === 0) cancelAnimation(shine);
    };
  }, [reduce, shine]);
  return shine;
}

/** 불러오는 중 블록 — 본문 색 8%, 대각선 빛 띠가 2초마다 지나간다(동작 줄이기면 멈춤). */
export function SkeletonBlock({
  width,
  height,
  radius = 6,
  style,
  color,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** 블록 색(기본 본문 8%) — 그룹 막대는 12% */
  color?: string;
}) {
  const p = useMon();
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const shine = useShine(reduce);
  const band = useAnimatedStyle(() => ({ transform: [{ translateX: -w + shine.value * 2 * w }] }));
  return (
    <View
      onLayout={e => setW(e.nativeEvent.layout.width)}
      style={[
        {
          width,
          height,
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: color ?? withAlpha(p.text, 0.08),
        },
        style,
      ]}
    >
      {!reduce && w > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: w,
              backgroundImage: `linear-gradient(100deg, transparent 40%, ${withAlpha(
                p.text,
                0.09,
              )} 50%, transparent 60%)`,
            },
            band,
          ]}
        />
      )}
    </View>
  );
}

// 줄 글자 블록 너비 — 웹 monday-skeleton과 같은 차례
const LINE_WIDTHS = [72, 48, 64, 56, 80, 40, 68] as const;

/** 보드 카드 뼈대 — 그룹 셋(7·4·3장), 그룹 제목 블록(150·118·170) + 개수 블록, 카드는 왼쪽 막대(본문 12%)·이름·미니 칸 */
export function BoardSkeleton({ groups = [7, 4, 3], background }: { groups?: number[]; background?: string }) {
  const p = useMon();
  const s = useStyles(skeletonStyles);
  return (
    <View style={[s.wrap, background ? { backgroundColor: background } : null]} pointerEvents="none">
      {groups.map((rows, g) => (
        <View key={g} style={[s.group, g > 0 && s.groupGap]}>
          <View style={s.title}>
            <SkeletonBlock width={[150, 118, 170][g % 3]} height={16} radius={8} />
            <SkeletonBlock width={52} height={10} />
          </View>
          {Array.from({ length: rows }, (_, i) => (
            <View key={i} style={s.card}>
              <View style={[s.bar, { backgroundColor: withAlpha(p.text, 0.12) }]} />
              <View style={s.body}>
                <SkeletonBlock width={`${LINE_WIDTHS[(i + g) % LINE_WIDTHS.length]}%`} height={10} />
                <View style={s.minis}>
                  <SkeletonBlock width={96} height={28} radius={4} />
                  <SkeletonBlock width={24} height={24} radius={12} />
                  <SkeletonBlock width={60} height={10} />
                </View>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** 도구 줄 뼈대 — 새로운 … 자리(132×32) + 도구 셋(68×28) */
export function ToolbarSkeleton() {
  const s = useStyles(skeletonStyles);
  return (
    <View style={s.toolbar} pointerEvents="none">
      <SkeletonBlock width={132} height={32} radius={8} />
      {[0, 1, 2].map(i => (
        <SkeletonBlock key={i} width={68} height={28} radius={8} />
      ))}
    </View>
  );
}

const skeletonStyles = (p: MonPalette) => ({
  wrap: { paddingHorizontal: 16, paddingTop: 12 },
  group: { gap: 8 },
  groupGap: { marginTop: 18 },
  title: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, height: 32 },
  card: {
    flexDirection: 'row' as const,
    height: 74,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: p.line,
    backgroundColor: p.cell,
    overflow: 'hidden' as const,
  },
  bar: { width: 6 },
  body: { flex: 1, padding: 12, gap: 12 },
  minis: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  toolbar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
});

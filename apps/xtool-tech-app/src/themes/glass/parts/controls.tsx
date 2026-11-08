import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Check, ChevronDown, Phone, Search, X } from 'lucide-react-native';
import { stageLabel, stageTone } from '@xtool-core/tech-stage';
import { avatarView, callPhone, phoneText } from '../../../features/dashboard/part-data';
import type {
  AssigneesProps,
  AvatarProps,
  AvatarStackProps,
  ButtonProps,
  ChipProps,
  IconButtonProps,
  PhoneLinkProps,
  SearchFieldProps,
  SegmentedProps,
  StagePillProps,
  StatusPillProps,
  TextFieldProps,
  Tone,
} from '../../dashboard/parts';
import { alpha, font, mixHex, RADIUS, T, TABULAR, TONE, WELL, RAISED } from '../theme';
import { useGlass, useStyles, type GlassState } from '../theme-context';
import { SpinIcon } from './text';

// 기본 조작 부품 — 웹 ohq-ui components(button·segmented-control·status-pill·text-field·avatar)와 tech 화면의
// record-search·record-select·icon-button. 포커스 효과는 입력칸 옆 형제 겹으로 켠다(Fabric 키보드 함정).

// ── 단추 ───────────────────────────────────────────────────────────────────────────────────────────────

/** 단추(웹 Button) — primary 강조색 · secondary 유리 위 보조(ghost) · plain 글자만 · danger 위험(확인 모달 빨강) */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: I,
  iconAfter,
  disabled,
  loading,
  block,
  style,
}: ButtonProps) {
  const s = useStyles(buttonStyles);
  const { a } = useGlass();
  const off = disabled || loading;
  const ghostSm = variant === 'secondary' && size === 'sm';
  // 판 폭 글자 단추("더 보기 · N건 남음") — 웹 .record-more(오목 칸 h38, 뒤 글은 흐리게)
  const more = variant === 'plain' && block;
  if (more) {
    const cut = label.indexOf(' · ');
    const head = cut < 0 ? label : label.slice(0, cut);
    const rest = cut < 0 ? '' : label.slice(cut + 3);
    return (
      <Pressable
        onPress={onPress}
        disabled={off}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [s.more, pressed && s.moreOn, off && s.off, style]}
      >
        {loading ? <SpinIcon size={13} color={T.text2} /> : null}
        <RNText style={s.moreText}>
          {head}
          {rest ? <RNText style={s.moreRest}>{` ${rest}`}</RNText> : null}
        </RNText>
      </Pressable>
    );
  }
  const ink = variant === 'primary' ? a.ink : variant === 'danger' ? T.white : variant === 'plain' ? T.text2 : T.text2;
  const iconSize = size === 'sm' ? 13 : 15;
  const glyph = loading ? (
    <SpinIcon size={iconSize} color={ink} />
  ) : I ? (
    <I size={iconSize} strokeWidth={2.4} color={ink} />
  ) : null;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      style={({ pressed }) => [
        s.base,
        size === 'sm' ? s.sm : s.md,
        ghostSm && s.ghostSm,
        variant === 'primary' && s.primary,
        variant === 'secondary' && (pressed ? s.ghostOn : s.ghost),
        variant === 'danger' && s.danger,
        variant === 'plain' && s.plain,
        block && s.block,
        off && s.off,
        pressed && !off && s.pressed,
        style,
      ]}
    >
      {({ pressed }) => (
        <>
          {!iconAfter && glyph}
          <RNText
            numberOfLines={1}
            style={[
              size === 'sm' ? s.labelSm : s.labelMd,
              ghostSm && s.labelGhostSm,
              { color: variant === 'secondary' && pressed ? T.text1 : ink },
            ]}
          >
            {label}
          </RNText>
          {iconAfter && glyph}
        </>
      )}
    </Pressable>
  );
}

const buttonStyles = ({ a }: GlassState) => ({
  base: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: RADIUS.control,
  },
  md: { height: 36, paddingHorizontal: 16 },
  sm: { height: 30, paddingHorizontal: 12, borderRadius: 9 },
  ghostSm: { height: 26, paddingHorizontal: 10, borderRadius: 7 },
  primary: {
    backgroundImage: `linear-gradient(180deg, ${a.hi}, ${a.lo})`,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  ghost: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.08)' },
  ghostOn: { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.14)' },
  danger: { backgroundColor: T.danger },
  plain: { paddingHorizontal: 4 },
  block: { alignSelf: 'stretch' as const },
  off: { opacity: 0.45 },
  pressed: { transform: [{ translateY: 1 }] },
  labelMd: font(13, 600),
  labelSm: font(12, 600),
  labelGhostSm: font(11.5, 500),
  more: {
    ...WELL,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    height: 38,
    marginTop: 8,
    borderRadius: RADIUS.control,
  },
  moreOn: { borderColor: 'rgba(255, 255, 255, 0.14)' },
  moreText: { ...font(12.5, 600), color: T.text2 },
  moreRest: { ...font(12.5, 500), color: T.text4 },
});

/** 아이콘 단추(웹 .icon-button — 오목 칸 36×36, 아이콘 16) · plain은 바탕 없이 */
export function IconButton({
  icon: I,
  label,
  onPress,
  variant = 'soft',
  tone = 'default',
  badge,
  disabled,
  style,
}: IconButtonProps) {
  const s = useStyles(iconButtonStyles);
  const color = tone === 'danger' ? T.crit : T.text2;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        s.box,
        variant === 'soft' ? s.soft : s.plain,
        pressed && (variant === 'soft' ? s.softOn : s.plainOn),
        disabled && s.off,
        style,
      ]}
    >
      {({ pressed }) => (
        <>
          <I size={16} strokeWidth={2} color={pressed && tone !== 'danger' ? T.text1 : color} />
          {badge ? (
            <View style={s.badge}>
              <RNText style={s.badgeText}>{badge}</RNText>
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const iconButtonStyles = ({ a }: GlassState) => ({
  box: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.control,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  soft: WELL,
  softOn: { ...WELL, backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  plain: { borderWidth: 1, borderColor: 'transparent' },
  plainOn: { borderWidth: 1, borderColor: 'transparent', backgroundColor: 'rgba(255, 255, 255, 0.07)' },
  off: { opacity: 0.45 },
  // 웹 .icon-button__badge — 강조색 원, 판 색 2px 틈 + 강조색 빛
  badge: {
    position: 'absolute' as const,
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 999,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: a.accent,
    boxShadow: `0 0 0 2px rgba(16, 17, 20, 0.95), 0 0 10px ${alpha(a.accent, 0.7)}`,
  },
  badgeText: { ...font(10, 800), ...TABULAR, color: a.ink },
});

// ── 고르기 줄(웹 SegmentedControl) ─────────────────────────────────────────────────────────────────────

/** 한 판 위 단추들(segmented) 또는 떨어진 알약(chips) — 고른 표시(raised)가 옆 단추로 미끄러진다(spring 520/40) */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  variant = 'segmented',
  scroll,
  label,
  style,
}: SegmentedProps<T>) {
  const s = useStyles(segmentedStyles);
  const chips = variant === 'chips';
  const frames = useRef<Record<string, { x: number; w: number }>>({});
  const thumbX = useSharedValue(0);
  const thumbW = useSharedValue(0);
  const shown = useSharedValue(0);
  const [, setMeasured] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const f = frames.current[value];
    if (!f) return;
    const spring = { stiffness: 520, damping: 40, mass: 1 };
    if (shown.value === 0 || reduced) {
      thumbX.value = f.x;
      thumbW.value = f.w;
      shown.value = 1;
    } else {
      thumbX.value = withSpring(f.x, spring);
      thumbW.value = withSpring(f.w, spring);
    }
  });

  const thumb = useAnimatedStyle(() => ({
    opacity: shown.value,
    width: thumbW.value,
    transform: [{ translateX: thumbX.value }],
  }));

  const onOptionLayout = (key: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    const prev = frames.current[key];
    if (prev && prev.x === x && prev.w === width) return;
    frames.current[key] = { x, w: width };
    // 고른 단추의 자리가 처음 잡히면 표시를 그 자리에(다시 그려 위 효과를 돌린다)
    if (key === value) setMeasured(n => n + 1);
  };

  const row = (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[s.row, chips ? s.chipsRow : s.well, scroll ? null : style]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          s.thumb,
          chips ? s.thumbChip : null,
          size === 'sm' ? s.thumbSm : s.thumbMd,
          chips && size === 'sm' && s.thumbChipSm,
          thumb,
        ]}
      />
      {options.map(option => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            onLayout={onOptionLayout(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[
              s.option,
              size === 'sm' ? s.optionSm : s.optionMd,
              chips && s.chip,
              chips && size === 'sm' && s.chipSm,
            ]}
          >
            {({ pressed }) => (
              <RNText
                numberOfLines={1}
                style={[
                  size === 'sm' ? (chips ? s.textChipSm : s.textSm) : s.textMd,
                  { color: on || pressed ? T.text1 : T.text3 },
                ]}
              >
                {option.label}
              </RNText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
  if (!scroll) return row;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={s.scroll}>
      {row}
    </ScrollView>
  );
}

const segmentedStyles = () => ({
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, alignSelf: 'flex-start' as const },
  well: { ...WELL, gap: 2, padding: 3, borderRadius: RADIUS.control },
  chipsRow: { gap: 6 },
  scroll: { paddingRight: 4 },
  option: { borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  optionMd: { height: 28, paddingHorizontal: 13 },
  optionSm: { height: 26, paddingHorizontal: 11 },
  // 떨어진 알약 — 테두리 .08, 바탕 .02, 둥근 끝
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  chipSm: { height: 24, paddingHorizontal: 11 },
  thumb: { ...RAISED, position: 'absolute' as const, left: 0, borderRadius: 8 },
  thumbMd: { top: 3, height: 28 },
  thumbSm: { top: 3, height: 26 },
  thumbChip: { top: 0, borderRadius: 999 },
  thumbChipSm: { height: 24 },
  textMd: font(12, 500),
  textSm: font(11.5, 500),
  textChipSm: font(11, 500),
});

// ── 알약 ───────────────────────────────────────────────────────────────────────────────────────────────

/** 상태 알약(웹 .pill — tech 화면은 모서리 5px, 테두리 없음) · 점은 'pulse'면 깜빡인다 */
export function StatusPill({ tone, label, dot, style }: StatusPillProps) {
  const t = TONE[tone];
  return (
    <View style={[pill.box, { backgroundColor: t.bg }, style]}>
      {dot ? <Dot color={t.color} pulse={dot === 'pulse'} /> : null}
      <RNText numberOfLines={1} style={[pill.text, { color: t.color }]}>
        {label}
      </RNText>
    </View>
  );
}

function Dot({ color, pulse }: { color: string; pulse: boolean }) {
  const v = useSharedValue(1);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!pulse || reduced) return;
    const ease = { duration: 900, easing: Easing.inOut(Easing.ease) };
    v.value = withRepeat(withSequence(withTiming(0, ease), withTiming(1, ease)), -1, false);
  }, [pulse, reduced, v]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * v.value,
    transform: [{ scale: 0.75 + 0.25 * v.value }],
  }));
  return <Animated.View style={[pill.dot, { backgroundColor: color, boxShadow: `0 0 8px ${color}` }, style]} />;
}

const pill = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 22,
    paddingHorizontal: 9,
    borderRadius: 5,
  },
  text: font(11, 600),
  dot: { width: 6, height: 6, borderRadius: 3 },
});

/** 진행 단계 알약(웹 StagePill) — 완료 초록 · 멈춤 빨강 · 신규 파랑 · 그 밖 노랑, 점 */
export function StagePill({ stage, status, style }: StagePillProps) {
  return <StatusPill tone={stageTone({ stage, status }) as Tone} label={stageLabel(stage)} dot style={style} />;
}

// ── 칩·검색 ─────────────────────────────────────────────────────────────────────────────────────────────

/** 거르기 칩(웹 record-select "담당자 전체 ▾") — 오목 칸, 고르면 볼록 칸 + 강조 아이콘 */
export function Chip({ label, onPress, selected, icon: I, count, trailing, onClear, style }: ChipProps) {
  const s = useStyles(chipStyles);
  const { a } = useGlass();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [s.box, selected ? s.on : s.off, pressed && s.pressed, style]}
    >
      {I ? <I size={14} strokeWidth={2} color={selected ? a.accent : T.text3} /> : null}
      <RNText numberOfLines={1} style={[s.label, { color: selected ? T.text1 : T.text2 }]}>
        {label}
      </RNText>
      {count !== undefined ? <RNText style={s.count}>{count}</RNText> : null}
      {trailing === 'chevron' ? <ChevronDown size={14} strokeWidth={2} color={T.text3} /> : null}
      {trailing === 'clear' ? (
        <Pressable onPress={onClear} hitSlop={8} accessibilityLabel={`${label} 풀기`} style={s.clear}>
          <X size={13} strokeWidth={2.2} color={T.text3} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const chipStyles = () => ({
  box: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: RADIUS.control,
  },
  off: WELL,
  on: RAISED,
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  label: font(12.5, 500),
  count: { ...font(11, 600), ...TABULAR, color: T.text4 },
  clear: { marginRight: -4, padding: 2 },
});

/** 검색 칸(웹 .record-search) — 돋보기 14 + 입력 12.5 + 지우기. 포커스 테두리는 형제 겹 */
export function SearchField({ value, onChangeText, placeholder, autoFocus, onSubmitEditing, style }: SearchFieldProps) {
  const s = useStyles(searchStyles);
  const [focused, setFocused] = useState(false);
  return (
    <View collapsable={false} style={[s.box, style]}>
      <View pointerEvents="none" style={[s.focus, { opacity: focused ? 1 : 0 }]} />
      <Search size={14} strokeWidth={2} color={T.text4} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={T.text4}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCorrect={false}
        autoCapitalize="none"
        keyboardAppearance="dark"
        selectionColor={s.caret.color}
        style={s.input}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityLabel="검색어 지우기" style={s.clear}>
          <X size={14} strokeWidth={2} color={T.text4} />
        </Pressable>
      ) : null}
    </View>
  );
}

const searchStyles = ({ a }: GlassState) => ({
  box: {
    ...WELL,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: RADIUS.control,
  },
  focus: {
    position: 'absolute' as const,
    left: -1,
    top: -1,
    right: -1,
    bottom: -1,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    borderColor: alpha(a.accent, 0.5),
  },
  input: { ...font(12.5), flex: 1, color: T.text1, paddingVertical: 0, height: '100%' as const },
  clear: { width: 22, height: 22, alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: -6 },
  caret: { color: a.accent },
});

// ── 글 입력(웹 .field) ───────────────────────────────────────────────────────────────────────────────────

/** 칸 이름표(웹 .field__label) — 필수 *, 바뀜 표시 */
export function FieldLabel({ label, required, changed }: { label: string; required?: boolean; changed?: boolean }) {
  const s = useStyles(fieldStyles);
  return (
    <View style={s.labelRow}>
      <RNText style={s.label}>
        {label}
        {required ? <RNText style={s.required}> *</RNText> : null}
      </RNText>
      {changed ? (
        <View style={s.badge}>
          <RNText style={s.badgeText}>바뀜</RNText>
        </View>
      ) : null}
    </View>
  );
}

/** 칸 아래 안내 — 오류는 빨강, 안내는 흐림 */
export function FieldNote({ error, hint }: { error?: string | null; hint?: string | null }) {
  const s = useStyles(fieldStyles);
  if (error) return <RNText style={s.error}>{error}</RNText>;
  if (hint) return <RNText style={s.hint}>{hint}</RNText>;
  return null;
}

/** 글 입력 — 오목 칸 h42, 포커스면 강조 테두리·옅은 고리(형제 겹), 바뀐 칸은 강조 테두리 .4 */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  autoFocus,
  returnKeyType,
  onSubmitEditing,
  editable = true,
  required,
  error,
  hint,
  maxLength,
  changed,
  onFocus,
  onBlur,
  style,
}: TextFieldProps) {
  const s = useStyles(fieldStyles);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.field, style]}>
      {label ? <FieldLabel label={label} required={required} changed={changed} /> : null}
      <View collapsable={false} style={[s.box, multiline && s.boxMulti, !editable && s.boxOff]}>
        <View pointerEvents="none" style={[s.ring, { opacity: focused ? 1 : 0 }]} />
        <View
          pointerEvents="none"
          style={[
            s.edge,
            { borderColor: focused ? s.focusEdge.borderColor : changed ? s.changedEdge.borderColor : 'transparent' },
          ]}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.text4}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          maxLength={maxLength}
          keyboardAppearance="dark"
          selectionColor={s.caret.color}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          style={[s.input, multiline && s.inputMulti]}
        />
      </View>
      <FieldNote error={error} hint={hint} />
    </View>
  );
}

const fieldStyles = ({ a }: GlassState) => ({
  field: { gap: 8 },
  labelRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  label: { ...font(12, 500), color: T.text3 },
  required: { color: T.crit },
  // 웹 .field__badge "바뀜"
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: alpha(a.accent, 0.16) },
  badgeText: { ...font(10.5, 700), color: a.hi },
  box: { ...WELL, height: 42, borderRadius: RADIUS.control, justifyContent: 'center' as const },
  boxMulti: { height: undefined, minHeight: 96 },
  boxOff: { opacity: 0.6 },
  // 포커스 — 바탕 rgba(0,0,0,.3) + 바깥 3px 고리 rgba(accent,.14)
  ring: {
    position: 'absolute' as const,
    left: -1,
    top: -1,
    right: -1,
    bottom: -1,
    borderRadius: RADIUS.control,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    boxShadow: `0 0 0 3px ${alpha(a.accent, 0.14)}`,
  },
  edge: {
    position: 'absolute' as const,
    left: -1,
    top: -1,
    right: -1,
    bottom: -1,
    borderRadius: RADIUS.control,
    borderWidth: 1,
  },
  focusEdge: { borderColor: alpha(a.accent, 0.55) },
  changedEdge: { borderColor: alpha(a.accent, 0.4) },
  input: { ...font(13.5), color: T.text1, paddingHorizontal: 14, paddingVertical: 0, height: '100%' as const },
  inputMulti: { ...font(13.5, 400, { lh: 1.55 }), paddingTop: 10, paddingBottom: 10, minHeight: 94, height: undefined },
  error: { ...font(12, 400, { lh: 1.5 }), color: T.crit },
  hint: { ...font(11.5, 400, { lh: 1.5 }), color: T.text4 },
  caret: { color: a.accent },
});

// ── 사람 ───────────────────────────────────────────────────────────────────────────────────────────────

const AVATAR = {
  xs: { box: 20, radius: 6, font: 8 },
  sm: { box: 32, radius: 9, font: 10.5 },
  md: { box: 38, radius: 11, font: 12 },
  lg: { box: 48, radius: 13, font: 14.5 },
} as const;

/** 이니셜 사각 아바타(웹 .avatar) — 145deg 밝은 단계 → 사람 색, 위 빛 1px + 색 그림자. "나"는 강조색 판에 강조 글자색 */
export function Avatar({ name, size = 'sm', highlight, style }: AvatarProps) {
  const { a } = useGlass();
  const v = avatarView(name);
  return (
    <AvatarBox
      initials={v.initials}
      color={highlight ? a.accent : v.color}
      ink={highlight ? a.ink : '#ffffff'}
      size={size}
      style={style}
    />
  );
}

/** 아바타 칸 — 색·글자색을 정해 그린다(팀 카드의 "남"은 흰 .14) */
export function AvatarBox({
  initials,
  color,
  ink,
  size,
  style,
}: {
  initials: string;
  color: string;
  ink: string;
  size: keyof typeof AVATAR;
  style?: StyleProp<ViewStyle>;
}) {
  const m = AVATAR[size];
  const hex = color.startsWith('#');
  return (
    <View
      style={[
        {
          width: m.box,
          height: m.box,
          borderRadius: m.radius,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: color,
          backgroundImage: hex ? `linear-gradient(145deg, ${mixHex(color, '#ffffff', 0.18)}, ${color})` : undefined,
          boxShadow: hex
            ? `inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 4px 12px -4px ${alpha(color, 0.7)}`
            : 'inset 0 1px 0 rgba(255, 255, 255, 0.25)',
        },
        style,
      ]}
    >
      <RNText style={[font(m.font, 700, { ls: -0.02 }), { color: ink }]}>{initials}</RNText>
    </View>
  );
}

/** 아바타 겹침 — 넘치면 "+N"(웹 .assignees__more 모양) */
export function AvatarStack({ names, max = 3, size = 'xs', style }: AvatarStackProps) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  const m = AVATAR[size];
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      {shown.map((name, i) => (
        <View
          key={name}
          style={{
            marginLeft: i === 0 ? 0 : -Math.round(m.box * 0.3),
            borderRadius: m.radius + 2,
            padding: 1.5,
            backgroundColor: 'rgba(16, 17, 20, 0.95)',
          }}
        >
          <Avatar name={name} size={size} />
        </View>
      ))}
      {rest > 0 ? (
        <View style={[more.box, { marginLeft: 4 }]}>
          <RNText style={more.text}>+{rest}</RNText>
        </View>
      ) : null}
    </View>
  );
}

const more = StyleSheet.create({
  box: { paddingHorizontal: 5, borderRadius: 6, backgroundColor: 'rgba(255, 255, 255, 0.07)' },
  text: { ...font(10.5, 600, { lh: 1.5 }), color: T.text3 },
});

/** 담당자(웹 Assignees) — 첫 사람 이름 + "+N", 없으면 '—' */
export function Assignees({ names, style }: AssigneesProps) {
  if (names.length === 0)
    return (
      <View style={style}>
        <RNText style={assignees.muted}>—</RNText>
      </View>
    );
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4 }, style]}>
      <RNText numberOfLines={1} style={assignees.name}>
        {names[0]}
      </RNText>
      {names.length > 1 ? (
        <View style={more.box}>
          <RNText style={more.text}>+{names.length - 1}</RNText>
        </View>
      ) : null}
    </View>
  );
}

const assignees = StyleSheet.create({
  name: { ...font(12.5), color: T.text2, flexShrink: 1 },
  muted: { ...font(12.5), color: T.text3 },
});

/** 전화 걸기(웹 PhoneLink — 안내색 링크) */
export function PhoneLink({ phone, style }: PhoneLinkProps) {
  const text = phoneText(phone);
  if (!text) return null;
  return (
    <Pressable
      onPress={() => callPhone(phone)}
      accessibilityRole="link"
      accessibilityLabel={`${text}로 전화`}
      hitSlop={6}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: 5, opacity: pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Phone size={12} strokeWidth={2.2} color={T.info} />
      <RNText style={[font(13, 500), TABULAR, { color: T.info }]}>{text}</RNText>
    </Pressable>
  );
}

// ── 체크 ───────────────────────────────────────────────────────────────────────────────────────────────

/** 체크 칸(웹 .check) — 17×17 r5, 켜면 강조색 그라데이션 + 빛 + 짙은 표시 */
export function CheckBox({ on, size = 17 }: { on: boolean; size?: number }) {
  const { a } = useGlass();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: on ? 'transparent' : 'rgba(255, 255, 255, 0.24)',
        backgroundColor: on ? a.accent : 'rgba(0, 0, 0, 0.25)',
        backgroundImage: on ? `linear-gradient(180deg, ${a.hi}, ${a.lo})` : undefined,
        boxShadow: on ? `0 0 12px -2px ${alpha(a.accent, 0.75)}` : undefined,
      }}
    >
      {on ? <Check size={size - 6} strokeWidth={3} color={a.ink} /> : null}
    </View>
  );
}

/** 작은 공용 줄 — 왼쪽부터 늘어놓기 */
export function Row({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

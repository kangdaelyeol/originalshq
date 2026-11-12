import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Search, X } from 'lucide-react-native';
import {
  addMonths,
  dateFieldText,
  monthGrid,
  monthOf,
  monthTitle,
  noTimeOf,
  TIME_SLOTS,
  toggleNoTime,
  WEEKDAYS,
} from '../../../features/dashboard/part-data';
import type {
  CheckFieldProps,
  ChoiceFieldProps,
  DateFieldProps,
  SearchFieldProps,
  TextFieldProps,
} from '../../dashboard/parts';
import { shade } from '../motion';
import { darkFill, QUICK_MS, shadow, springConfig, W, WATER_REVEAL, WATER_SPRING } from '../theme';
import { useWater } from '../theme-context';
import { WButton, WIconButton } from './controls';
import { Backing, DarkPill, glassLayer, Groove, solidLayer } from './glass';
import { OptionRow, Sheet } from './screen';
import { WText } from './text';
import { useWaterIndicator } from './use-indicator';

// 물 입력(웹 WaterTextField·water-multi·water-dt·WaterSwitch·WaterCheck) — 얕은 유리 알약(w-glass 0.46·0.2, 높이 40).
// 초점이 오면 흰 2px 고리가 0.1초에 떠오른다. 고리·오류 테두리·유리는 모두 입력 칸의 형제 층이라 포커스로 조상 스타일이
// 바뀌지 않는다(Fabric 키보드 함정). 고르기·날짜는 칸을 누르면 아래 시트에서 고른다(웹 팝오버를 폰에서는 시트로).

const BOX_H = 40;

/** 초점 고리 — 형제 층의 불투명도만 바꾼다 */
function useFocusRing() {
  const o = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return {
    style,
    on: () => {
      o.value = withTiming(1, { duration: QUICK_MS });
    },
    off: () => {
      o.value = withTiming(0, { duration: QUICK_MS });
    },
  };
}

/** 이름표 줄 — 이름(600 12.5 ink-2) + 필수 + 바뀜(어두운 작은 알약) */
function FieldLabel({ label, required, changed }: { label?: string; required?: boolean; changed?: boolean }) {
  if (!label) return null;
  return (
    <View style={styles.labelRow}>
      <WText size={12.5} weight="600" color={W.ink2} lh={1.2}>
        {label}
      </WText>
      {required ? (
        <WText size={11} weight="600" color={W.critInk}>
          필수
        </WText>
      ) : null}
      {changed ? (
        <DarkPill radius={8} em={0} style={styles.changed}>
          <WText size={10} weight="700" onDark>
            바뀜
          </WText>
        </DarkPill>
      ) : null}
    </View>
  );
}

/** 칸 아래 안내 — 오류면 붉은 아이콘 + 진한 글(색은 아이콘에만) */
function FieldNote({ error, hint }: { error?: string | null; hint?: string | null }) {
  if (error) {
    return (
      <View style={styles.note} accessibilityRole="alert">
        <CircleAlert size={14} color={W.crit} strokeWidth={2} />
        <WText size={12} weight="600" lh={1.4} style={styles.flex}>
          {error}
        </WText>
      </View>
    );
  }
  if (!hint) return null;
  return (
    <WText size={12} color={W.ink2} lh={1.4}>
      {hint}
    </WText>
  );
}

/** 유리 칸 틀 — 유리·초점 고리·오류 테두리 층 + 안의 것(입력·글) */
function GlassBox({
  radius,
  focused,
  error,
  style,
  children,
}: {
  radius: number;
  focused: ReturnType<typeof useFocusRing>;
  error?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const p = useWater();
  return (
    <View collapsable={false} style={[styles.box, { borderRadius: radius }, style]}>
      <Backing style={glassLayer(p, 0.46, 0.2, radius)} />
      {/* 오류 테두리는 늘 그려 두고 불투명도만 — 입력 중에 형제가 붙었다 떨어지지 않게 */}
      <View
        pointerEvents="none"
        style={[styles.fill, styles.errorRing, { borderRadius: radius, opacity: error ? 1 : 0 }]}
      />
      <Animated.View pointerEvents="none" style={[styles.fill, styles.ring, { borderRadius: radius }, focused.style]} />
      {children}
    </View>
  );
}

// ── 검색 ─────────────────────────────────────────────────────────────────────

export function SearchField({ value, onChangeText, placeholder, autoFocus, onSubmitEditing, style }: SearchFieldProps) {
  const ring = useFocusRing();
  return (
    <GlassBox radius={BOX_H / 2} focused={ring} style={style}>
      <Search size={16} color={W.ink3} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={W.ink3}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="never"
        onFocus={ring.on}
        onBlur={ring.off}
        style={styles.input}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="지우기"
          hitSlop={8}
          onPress={() => onChangeText('')}
          style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]}
        >
          <X size={14} color={W.ink3} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </GlassBox>
  );
}

// ── 글 입력 ───────────────────────────────────────────────────────────────────

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
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
  const ring = useFocusRing();
  const radius = multiline ? 18 : BOX_H / 2;
  return (
    <View style={[styles.field, !editable && styles.dim, style]}>
      <FieldLabel label={label} required={required} changed={changed} />
      <GlassBox radius={radius} focused={ring} error={!!error} style={multiline ? styles.boxMulti : null}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={W.ink3}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          maxLength={maxLength}
          accessibilityLabel={label}
          onFocus={() => {
            ring.on();
            onFocus?.();
          }}
          onBlur={() => {
            ring.off();
            onBlur?.();
          }}
          style={[styles.input, multiline && styles.inputMulti]}
        />
      </GlassBox>
      <FieldNote error={error} hint={hint} />
    </View>
  );
}

// ── 체크·스위치 ─────────────────────────────────────────────────────────────────

/**
 * 물 체크(웹 WaterCheck) — 작은 유리 상자(w-glass 0.36·0.3). 고르면 어두운 알약이 제자리에서 0.1초에 진해지며 반 크기에서
 * 스프링으로 차오르고(indicator), 흰 체크가 12ms 뒤 55ms 동안 나타난다. 풀면 15ms 뒤 30ms 동안 반으로 줄며 흐려진다.
 */
export function WCheck({ checked, size = 18 }: { checked: boolean; size?: number }) {
  const p = useWater();
  const reduced = useReducedMotion();
  const fill = useSharedValue(checked ? 1 : 0);
  const grow = useSharedValue(checked ? 1 : 0.5);
  const mark = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      fill.value = checked ? 1 : 0;
      grow.value = checked ? 1 : 0.5;
      mark.value = checked ? 1 : 0;
      return;
    }
    if (checked) {
      fill.value = withTiming(1, { duration: 100, easing: Easing.linear });
      grow.value = withSpring(1, springConfig(WATER_SPRING.indicator));
      mark.value = withDelay(12, withTiming(1, { duration: WATER_REVEAL.fade * 1000, easing: Easing.linear }));
    } else {
      fill.value = withDelay(15, withTiming(0, { duration: 30, easing: Easing.linear }));
      grow.value = withDelay(15, withTiming(0.5, { duration: 30, easing: Easing.linear }));
      mark.value = withDelay(15, withTiming(0, { duration: 30, easing: Easing.linear }));
    }
  }, [checked, reduced, fill, grow, mark]);
  const fillStyle = useAnimatedStyle(() => ({
    opacity: checked ? shade(fill.value) : fill.value,
    transform: [{ scale: grow.value }],
  }));
  const markStyle = useAnimatedStyle(() => ({ opacity: mark.value }));
  const r = size === 18 ? 6 : 5;
  return (
    <View style={{ width: size, height: size, borderRadius: r }}>
      <Backing style={glassLayer(p, 0.36, 0.3, r)} />
      <Animated.View
        style={[
          styles.fill,
          { borderRadius: r, backgroundImage: darkFill(p), boxShadow: [shadow(0, 1.2, 2.8, 0, 'rgba(0, 0, 0, 0.26)')] },
          fillStyle,
        ]}
      />
      <Animated.View style={[styles.fill, styles.markShadow, markStyle]}>
        <Svg width={size} height={size} viewBox="0 0 16 16">
          <Path
            d="M3.9 8.3l2.75 2.75L12.2 5.3"
            fill="none"
            stroke="#ffffff"
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const SWITCH = { w: 52, h: 28, kw: 28, kh: 22 } as const;

/**
 * 물 스위치(웹 WaterSwitch) — 유리에 파인 홈(w-groove 0.6) 안에서 손잡이가 표시 알약처럼 스프링(ζ0.65·ω30.5, 7% 넘침)
 * 으로 오가며 달리는 빠르기만큼 늘어난다. 꺼지면 불투명 유리 알약, 켜지면 어두운 알약(0.1초).
 */
export function WSwitch({ value }: { value: boolean }) {
  const p = useWater();
  const reduced = useReducedMotion();
  const ind = useWaterIndicator();
  const dark = useSharedValue(value ? 1 : 0);
  const inset = (SWITCH.h - SWITCH.kh) / 2;
  const off = { pos: inset + SWITCH.kw / 2, size: SWITCH.kw };
  const on = { pos: SWITCH.w - inset - SWITCH.kw / 2, size: SWITCH.kw };
  const [placed, setPlaced] = useState(false);
  useEffect(() => {
    ind.set(value ? on : off, !placed || reduced ? { instant: true } : { step: on.pos - off.pos });
    setPlaced(true);
    dark.value = withTiming(value ? 1 : 0, { duration: QUICK_MS });
    // 켜고 끌 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const knob = useAnimatedStyle(() => {
    const q = ind.pose.value;
    return {
      opacity: q.placed ? 1 : 0,
      width: q.size,
      transform: [{ translateX: q.pos - q.size / 2 }, { scaleX: q.along }, { scaleY: q.across }],
    };
  });
  const darkStyle = useAnimatedStyle(() => ({ opacity: dark.value }));
  return (
    <Groove k={0.6} radius={SWITCH.h / 2} style={{ width: SWITCH.w, height: SWITCH.h }}>
      <Animated.View style={[styles.knob, { top: inset, height: SWITCH.kh, borderRadius: SWITCH.kh / 2 }, knob]}>
        <View style={[styles.fill, styles.knobShadow, { borderRadius: SWITCH.kh / 2 }]} />
        <View style={solidLayer(p, 0.26, SWITCH.kh / 2, 'ellipse')} />
        <Animated.View
          style={[styles.fill, { borderRadius: SWITCH.kh / 2, backgroundImage: darkFill(p) }, darkStyle]}
        />
      </Animated.View>
    </Groove>
  );
}

/** 체크 칸 — 이름(+바뀜) + 오른쪽 물 스위치. 줄 전체를 누른다 */
export function CheckField({ label, value, onChange, disabled, changed, style }: CheckFieldProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[styles.checkRow, disabled && styles.dim, style]}
    >
      <View style={[styles.flex, styles.labelRow]}>
        <WText size={13} weight="500" lh={1.3} style={styles.flexShrink}>
          {label}
        </WText>
        {changed ? (
          <DarkPill radius={8} em={0} style={styles.changed}>
            <WText size={10} weight="700" onDark>
              바뀜
            </WText>
          </DarkPill>
        ) : null}
      </View>
      <WSwitch value={value} />
    </Pressable>
  );
}

// ── 고르기 칸 ─────────────────────────────────────────────────────────────────

/** 펼침 화살표 — move 스프링으로 돈다 */
function Chevron({ open }: { open: boolean }) {
  const r = useSharedValue(open ? 180 : 0);
  useEffect(() => {
    r.value = withSpring(open ? 180 : 0, springConfig(WATER_SPRING.move));
  }, [open, r]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <ChevronDown size={14} color={W.ink3} strokeWidth={2.4} />
    </Animated.View>
  );
}

/** 칸 단추 — 유리 알약(높이 40) 안에 글·화살표. 누르면 시트가 열린다 */
function Trigger({
  children,
  open,
  disabled,
  onPress,
  label,
  icon,
  trailing,
}: {
  children: ReactNode;
  open: boolean;
  disabled?: boolean;
  onPress: () => void;
  label: string;
  icon?: ReactNode;
  trailing?: ReactNode;
}) {
  const ring = useFocusRing();
  useEffect(() => {
    if (open) ring.on();
    else ring.off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}>
      <GlassBox radius={BOX_H / 2} focused={ring} style={styles.trigger}>
        {icon}
        <View style={styles.flex}>{children}</View>
        {trailing}
        <Chevron open={open} />
      </GlassBox>
    </Pressable>
  );
}

/** 고른 것 글 — 상태 하나면 라벨 색 점 + 이름, 여럿이면 이름을 이어 붙인다(웹 water-multi__value) */
function ChoiceValue({
  options,
  value,
  placeholder,
}: {
  options: ChoiceFieldProps['options'];
  value: readonly string[];
  placeholder: string;
}) {
  const picked = value.map(v => options.find(o => o.value === v)).filter((o): o is NonNullable<typeof o> => !!o);
  if (picked.length === 0) {
    return (
      <WText size={13.5} color={W.ink3} numberOfLines={1}>
        {placeholder}
      </WText>
    );
  }
  const color = picked.length === 1 ? picked[0].color : null;
  return (
    <View style={styles.valueRow}>
      {color ? <View style={[styles.labelDot, { backgroundColor: color }]} /> : null}
      <WText size={13.5} numberOfLines={1} style={styles.flexShrink}>
        {picked.map(o => o.label).join(', ')}
      </WText>
    </View>
  );
}

export function ChoiceField({
  label,
  options,
  value,
  onChange,
  multiple = false,
  placeholder = '고르기',
  searchable = false,
  clearable = false,
  required,
  disabled,
  hint,
  changed,
  style,
}: ChoiceFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q) || (o.sub ?? '').toLowerCase().includes(q));
  }, [options, query]);
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const pick = (v: string) => {
    if (multiple) {
      onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
      return;
    }
    onChange([v]);
    close();
  };
  const footer =
    clearable || multiple ? (
      <>
        {clearable && value.length > 0 ? (
          <WButton variant="ghost" size="sm" onPress={() => onChange([])}>
            비우기
          </WButton>
        ) : null}
        {multiple ? (
          <WButton size="sm" onPress={close}>
            완료
          </WButton>
        ) : null}
      </>
    ) : undefined;
  return (
    <View style={[styles.field, disabled && styles.dim, style]}>
      <FieldLabel label={label} required={required} changed={changed} />
      <Trigger open={open} disabled={disabled} onPress={() => setOpen(true)} label={label}>
        <ChoiceValue options={options} value={value} placeholder={placeholder} />
      </Trigger>
      <FieldNote hint={hint} />
      <Sheet visible={open} onClose={close} title={label} tall={options.length > 8} footer={footer}>
        {searchable ? (
          <SearchField value={query} onChangeText={setQuery} placeholder="찾기" style={styles.sheetSearch} />
        ) : null}
        {shown.map(o =>
          multiple ? (
            <MultiRow
              key={o.value}
              label={o.label}
              sub={o.sub}
              color={o.color}
              on={value.includes(o.value)}
              onPress={() => pick(o.value)}
            />
          ) : (
            <OptionRow
              key={o.value}
              label={o.label}
              description={o.sub ?? undefined}
              selected={value.includes(o.value)}
              left={o.color ? <View style={[styles.labelDot, { backgroundColor: o.color }]} /> : undefined}
              onPress={() => pick(o.value)}
            />
          ),
        )}
        {shown.length === 0 ? (
          <WText size={12.5} color={W.ink3} align="center" style={styles.noMatch}>
            맞는 것이 없어요
          </WText>
        ) : null}
      </Sheet>
    </View>
  );
}

/** 여러 개 고르기 줄 — 물 체크 + 이름(고르면 600 ink) — 누르면 흰 칩(웹 water-multi-pop__option·hilite) */
function MultiRow({
  label,
  sub,
  color,
  on,
  onPress,
}: {
  label: string;
  sub?: string | null;
  color?: string | null;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress}>
      {({ pressed }) => (
        <View style={styles.multiRow}>
          {pressed ? <View style={[styles.fill, styles.hilite]} /> : null}
          <WCheck checked={on} />
          {color ? <View style={[styles.labelDot, { backgroundColor: color }]} /> : null}
          <View style={styles.flex}>
            <WText size={13.5} weight={on ? '600' : '500'} color={on ? W.ink : W.ink2} numberOfLines={1}>
              {label}
            </WText>
            {sub ? (
              <WText size={11.5} color={W.ink3} numberOfLines={1}>
                {sub}
              </WText>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

// ── 날짜 칸 ───────────────────────────────────────────────────────────────────

export function DateField({
  label,
  value,
  onChange,
  today,
  withTime = true,
  clearable = false,
  required,
  disabled,
  hint,
  changed,
  style,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const text = dateFieldText(value, today);
  return (
    <View style={[styles.field, disabled && styles.dim, style]}>
      <FieldLabel label={label} required={required} changed={changed} />
      <Trigger
        open={open}
        disabled={disabled}
        onPress={() => setOpen(true)}
        label={label}
        icon={<CalendarDays size={16} color={W.ink3} strokeWidth={2} />}
        trailing={
          clearable && value.date ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="지우기"
              hitSlop={8}
              onPress={() => onChange({ date: '', time: '' })}
              style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]}
            >
              <X size={14} color={W.ink3} strokeWidth={2.2} />
            </Pressable>
          ) : null
        }
      >
        <WText size={13.5} color={text ? W.ink : W.ink3} numberOfLines={1}>
          {text || '날짜 고르기'}
        </WText>
      </Trigger>
      <FieldNote hint={hint} />
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          <>
            {clearable && value.date ? (
              <WButton variant="ghost" size="sm" onPress={() => onChange({ date: '', time: '' })}>
                지우기
              </WButton>
            ) : null}
            <WButton size="sm" onPress={() => setOpen(false)}>
              완료
            </WButton>
          </>
        }
      >
        <Calendar value={value} onChange={onChange} today={today} />
        {withTime ? <TimePicker value={value} onChange={onChange} /> : null}
      </Sheet>
    </View>
  );
}

const CELL = 40;

/** 달력 — 일요일부터 한 주씩. 고른 날은 어두운 표시 알약(D7 고른 것), 오늘은 옅은 테 */
function Calendar({
  value,
  onChange,
  today,
}: {
  value: DateFieldProps['value'];
  onChange: DateFieldProps['onChange'];
  today: string;
}) {
  const start = monthOf(value.date || today);
  const [ym, setYm] = useState(start);
  const weeks = monthGrid(ym.year, ym.month);
  return (
    <View style={styles.calendar}>
      <View style={styles.calHead}>
        <WIconButton
          icon={ChevronLeft}
          label="지난달"
          size="sm"
          onPress={() => setYm(addMonths(ym.year, ym.month, -1))}
        />
        <WText size={15} weight="700" align="center" style={styles.flex}>
          {monthTitle(ym.year, ym.month)}
        </WText>
        <WIconButton
          icon={ChevronRight}
          label="다음 달"
          size="sm"
          onPress={() => setYm(addMonths(ym.year, ym.month, 1))}
        />
      </View>
      <View style={styles.calRow}>
        {WEEKDAYS.map(d => (
          <View key={d} style={styles.calCell}>
            <WText size={11} weight="600" color={W.ink3}>
              {d}
            </WText>
          </View>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.calRow}>
          {week.map((date, di) => {
            if (!date) return <View key={di} style={styles.calCell} />;
            const on = date === value.date;
            const isToday = date === today;
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={date}
                onPress={() => onChange({ date, time: value.time })}
                style={styles.calCell}
              >
                {({ pressed }) => (
                  <>
                    {on ? (
                      <DarkPill radius={CELL / 2 - 3} em={10} style={styles.calMark} />
                    ) : pressed ? (
                      <View style={[styles.calMark, styles.calPressed]} />
                    ) : isToday ? (
                      <View style={[styles.calMark, styles.calToday]} />
                    ) : null}
                    <WText
                      size={13}
                      weight={on || isToday ? '700' : '500'}
                      color={on ? '#ffffff' : W.ink}
                      onDark={on}
                      tabular
                    >
                      {Number(date.slice(8))}
                    </WText>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={styles.calFoot}>
        <WButton
          variant="ghost"
          size="sm"
          onPress={() => {
            setYm(monthOf(today));
            onChange({ date: today, time: value.time });
          }}
        >
          오늘
        </WButton>
      </View>
    </View>
  );
}

/** 시각 — "시각 없음" 스위치 + 30분 칸(가로로 민다) + 직접 입력 */
function TimePicker({ value, onChange }: { value: DateFieldProps['value']; onChange: DateFieldProps['onChange'] }) {
  const noTime = noTimeOf(value);
  const [typed, setTyped] = useState(value.time);
  useEffect(() => setTyped(value.time), [value.time]);
  const ring = useFocusRing();
  const commit = () => {
    const m = /^(\d{1,2}):?(\d{2})$/.exec(typed.trim());
    if (!m) {
      setTyped(value.time);
      return;
    }
    const h = Math.min(23, Number(m[1]));
    const min = Math.min(59, Number(m[2]));
    onChange({ date: value.date, time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` });
  };
  return (
    <View style={styles.time}>
      <CheckField
        label="시각 없음"
        value={noTime}
        onChange={next => onChange(toggleNoTime(value, next))}
        disabled={!value.date}
      />
      {!noTime && value.date ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slots}>
            {TIME_SLOTS.map(slot => {
              const on = slot === value.time;
              return (
                <Pressable
                  key={slot}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => onChange({ date: value.date, time: slot })}
                  style={styles.slot}
                >
                  {({ pressed }) => (
                    <>
                      <View style={[styles.fill, styles.slotFill, pressed && !on ? styles.slotPressed : null]} />
                      {on ? <DarkPill radius={13.25} em={0} style={styles.fill} /> : null}
                      <WText size={11} weight="600" color={on ? '#ffffff' : W.ink2} onDark={on} tabular>
                        {slot}
                      </WText>
                    </>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.typedRow}>
            <WText size={12.5} weight="600" color={W.ink2}>
              직접 입력
            </WText>
            <GlassBox radius={BOX_H / 2} focused={ring} style={styles.typedBox}>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                placeholder="14:30"
                placeholderTextColor={W.ink3}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                onFocus={ring.on}
                onBlur={() => {
                  ring.off();
                  commit();
                }}
                onSubmitEditing={commit}
                style={[styles.input, styles.tabular]}
              />
            </GlassBox>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  dim: { opacity: 0.55 },
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  field: { gap: 7, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  changed: { paddingHorizontal: 6, height: 16, justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: BOX_H, paddingHorizontal: 16 },
  boxMulti: { alignItems: 'flex-start', paddingVertical: 4, minHeight: 96 },
  ring: { boxShadow: [shadow(0, 0, 0, 2, W.ring)] },
  // 오류 — 안쪽 붉은 테두리($w-crit 80%)
  errorRing: { boxShadow: [shadow(0, 0, 0, 1.5, 'rgba(194, 80, 74, 0.8)', true)] },
  input: {
    flex: 1,
    minWidth: 0,
    height: BOX_H,
    padding: 0,
    fontSize: 13.5,
    fontWeight: '500',
    color: W.ink,
  },
  inputMulti: {
    height: undefined,
    minHeight: 84,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 14,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  tabular: { fontVariant: ['tabular-nums'] },
  clear: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  clearPressed: { backgroundColor: W.pressFill },
  markShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 0.6,
    shadowOffset: { width: 0, height: 0.5 },
  },
  knob: { position: 'absolute', left: 0 },
  knobShadow: { boxShadow: [shadow(0, 2, 4, 0, 'rgba(0, 0, 0, 0.22)')] },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 },
  trigger: { paddingRight: 14 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelDot: { width: 8, height: 8, borderRadius: 4 },
  sheetSearch: { marginBottom: 8 },
  noMatch: { paddingVertical: 18 },
  multiRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 10 },
  hilite: {
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
    boxShadow: [shadow(0, 1, 0, 0, 'rgba(255, 255, 255, 0.5)', true), shadow(0, 1, 2, 0, 'rgba(0, 0, 0, 0.06)')],
  },
  calendar: { gap: 2, paddingBottom: 4 },
  calHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  calRow: { flexDirection: 'row', justifyContent: 'space-between' },
  calCell: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
  calMark: { position: 'absolute', left: 3, top: 3, right: 3, bottom: 3, borderRadius: CELL / 2 - 3 },
  calPressed: { backgroundColor: W.chip },
  calToday: { boxShadow: [shadow(0, 0, 0, 1.5, 'rgba(63, 62, 67, 0.4)', true)] },
  calFoot: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 6 },
  time: { gap: 12, paddingTop: 10 },
  slots: { gap: 4.5, paddingVertical: 2 },
  slot: { height: 26.5, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  slotFill: { borderRadius: 13.25, backgroundColor: W.chip },
  slotPressed: { backgroundColor: W.chipHover },
  typedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typedBox: { width: 120 },
});

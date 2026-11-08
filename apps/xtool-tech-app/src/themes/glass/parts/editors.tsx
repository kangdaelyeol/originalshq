import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
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
import type { CheckFieldProps, ChoiceFieldProps, ChoiceOption, DateFieldProps } from '../../dashboard/parts';
import { alpha, font, RADIUS, T, TABULAR, WELL } from '../theme';
import { useGlass, useStyles, type GlassState } from '../theme-context';
import { Button, CheckBox, FieldLabel, FieldNote, SearchField } from './controls';
import { OptionRow, Sheet } from './overlays';

// 편집기 — 웹 편집 패널의 칸(select·multi-select·people-picker·date-time-input·check). 칸은 웹 .field__input 오목 칸(h42),
// 누르면 아래 시트에서 고른다(웹 펼침 목록 .multi-select__list 자리). 값·저장은 화면(features 훅)이 들고 있다.

/** 시트 아래 단추 줄 — 오른쪽 정렬(웹 .drawer__footer) */
const sheetRow = {
  flexDirection: 'row' as const,
  justifyContent: 'flex-end' as const,
  alignItems: 'center' as const,
  gap: 8,
};

/** 칸 모양(웹 .field__input) — 오목 칸 h42 r10, 바뀐 칸은 강조 테두리 .4 */
function useFieldBox() {
  return useStyles(boxStyles);
}

const boxStyles = ({ a }: GlassState) => ({
  field: { gap: 8 },
  box: {
    ...WELL,
    minHeight: 42,
    borderRadius: RADIUS.control,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 8,
  },
  changed: { borderColor: alpha(a.accent, 0.4) },
  pressed: { backgroundColor: 'rgba(0, 0, 0, 0.3)' },
  off: { opacity: 0.5 },
  value: { ...font(13.5, 400, { lh: 1.45 }), color: T.text1, flex: 1 },
  placeholder: { ...font(13.5, 400, { lh: 1.45 }), color: T.text4, flex: 1 },
  chips: { flex: 1, flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
});

/** 고른 것 하나 — Monday 라벨 색이 있으면 그 색 점 */
function ChoiceChip({ option }: { option: ChoiceOption }) {
  return (
    <View style={chip.box}>
      {option.color ? <View style={[chip.dot, { backgroundColor: option.color }]} /> : null}
      <RNText style={chip.text} numberOfLines={1}>
        {option.label}
      </RNText>
    </View>
  );
}

const chip = {
  box: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    maxWidth: '100%' as const,
  },
  dot: { width: 8, height: 8, borderRadius: 3 },
  text: { ...font(12.5, 500), color: T.text1, flexShrink: 1 },
};

/** 고르기 칸 — 칸에 고른 것(칩), 누르면 시트 목록(검색·여럿 고르기·비우기). 하나만 고르면 바로 닫는다 */
export function ChoiceField({
  label,
  options,
  value,
  onChange,
  multiple,
  placeholder = '고르기',
  searchable,
  clearable,
  required,
  disabled,
  hint,
  changed,
  style,
}: ChoiceFieldProps) {
  const s = useFieldBox();
  const { a } = useGlass();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const chosen = value
    .map(v => options.find(o => o.value === v) ?? { value: v, label: v })
    .filter(Boolean) as ChoiceOption[];
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);

  const pick = (v: string) => {
    if (!multiple) {
      onChange([v]);
      setOpen(false);
      return;
    }
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  };

  return (
    <View style={[s.field, style]}>
      <FieldLabel label={label} required={required} changed={changed} />
      <Pressable
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label} 고르기`}
        style={({ pressed }) => [s.box, changed && s.changed, pressed && s.pressed, disabled && s.off]}
      >
        {chosen.length === 0 ? (
          <RNText style={s.placeholder}>{placeholder}</RNText>
        ) : (
          <View style={s.chips}>
            {chosen.map(o => (
              <ChoiceChip key={o.value} option={o} />
            ))}
          </View>
        )}
        <ChevronDown size={14} strokeWidth={2} color={T.text3} />
      </Pressable>
      <FieldNote hint={hint} />
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        subtitle={multiple ? `${value.length}개 고름` : undefined}
        tall={options.length > 8}
        footer={
          multiple || clearable ? (
            <View style={sheetRow}>
              {clearable && value.length > 0 ? (
                <Button
                  label="비우기"
                  variant="secondary"
                  onPress={() => {
                    onChange([]);
                    if (!multiple) setOpen(false);
                  }}
                />
              ) : null}
              {multiple ? <Button label="완료" onPress={() => setOpen(false)} /> : null}
            </View>
          ) : undefined
        }
      >
        {searchable ? <SearchField value={query} onChangeText={setQuery} placeholder="찾기" /> : null}
        <View style={{ gap: 2 }}>
          {shown.map(o => (
            <OptionRow
              key={o.value}
              label={o.label}
              description={o.sub ?? undefined}
              selected={value.includes(o.value)}
              left={
                o.color ? <View style={[chip.dot, { width: 10, height: 10, backgroundColor: o.color }]} /> : undefined
              }
              onPress={() => pick(o.value)}
            />
          ))}
          {shown.length === 0 ? (
            <RNText style={[font(12.5), { color: T.text3, textAlign: 'center', paddingVertical: 18 }]}>
              찾는 것이 없어요
            </RNText>
          ) : null}
        </View>
        {multiple && value.length > 0 ? (
          <RNText style={[font(11.5), { color: a.hi }]}>{chosen.map(o => o.label).join(', ')}</RNText>
        ) : null}
      </Sheet>
    </View>
  );
}

/** 날짜 칸 — 칸에 '11/9 (월) 14:00', 누르면 달력(오늘 강조·고른 날 강조색)과 시각(30분 간격) 시트 */
export function DateField({
  label,
  value,
  onChange,
  today,
  withTime = true,
  clearable,
  required,
  disabled,
  hint,
  changed,
  style,
}: DateFieldProps) {
  const s = useFieldBox();
  const d = useStyles(dateStyles);
  const [open, setOpen] = useState(false);
  const start = monthOf(value.date || today);
  const [month, setMonth] = useState(start);
  const text = dateFieldText(value, today);
  const noTime = noTimeOf(value);

  const pickDate = (date: string) => {
    const next = { date, time: value.time };
    onChange(next);
    if (!withTime) setOpen(false);
  };

  return (
    <View style={[s.field, style]}>
      <FieldLabel label={label} required={required} changed={changed} />
      <View style={d.row}>
        <Pressable
          onPress={() => {
            setMonth(monthOf(value.date || today));
            setOpen(true);
          }}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${label} 고르기`}
          style={({ pressed }) => [s.box, d.flex, changed && s.changed, pressed && s.pressed, disabled && s.off]}
        >
          <RNText style={text ? s.value : s.placeholder}>{text || '날짜 고르기'}</RNText>
          <CalendarDays size={15} strokeWidth={2} color={T.text3} />
        </Pressable>
        {clearable && value.date ? (
          <Pressable
            onPress={() => onChange({ date: '', time: '' })}
            hitSlop={6}
            accessibilityLabel={`${label} 지우기`}
            style={({ pressed }) => [d.clear, pressed && d.clearOn]}
          >
            <X size={14} strokeWidth={2} color={T.text4} />
          </Pressable>
        ) : null}
      </View>
      <FieldNote hint={hint} />
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        subtitle={text || undefined}
        footer={
          <View style={sheetRow}>
            <Button label="오늘" variant="secondary" onPress={() => pickDate(today)} />
            <Button label="완료" onPress={() => setOpen(false)} />
          </View>
        }
      >
        <View style={d.monthRow}>
          <Pressable
            onPress={() => setMonth(addMonths(month.year, month.month, -1))}
            accessibilityLabel="이전 달"
            hitSlop={6}
            style={d.nav}
          >
            <ChevronLeft size={18} strokeWidth={2} color={T.text2} />
          </Pressable>
          <RNText style={d.monthTitle}>{monthTitle(month.year, month.month)}</RNText>
          <Pressable
            onPress={() => setMonth(addMonths(month.year, month.month, 1))}
            accessibilityLabel="다음 달"
            hitSlop={6}
            style={d.nav}
          >
            <ChevronRight size={18} strokeWidth={2} color={T.text2} />
          </Pressable>
        </View>
        <View>
          <View style={d.week}>
            {WEEKDAYS.map(w => (
              <RNText key={w} style={d.weekday}>
                {w}
              </RNText>
            ))}
          </View>
          {monthGrid(month.year, month.month).map((week, i) => (
            <View key={i} style={d.week}>
              {week.map((date, j) =>
                date ? (
                  <Pressable
                    key={date}
                    onPress={() => pickDate(date)}
                    accessibilityLabel={date}
                    style={({ pressed }) => [
                      d.day,
                      date === today && d.today,
                      date === value.date && d.picked,
                      pressed && date !== value.date && d.dayOn,
                    ]}
                  >
                    <RNText style={[d.dayText, date === value.date && d.pickedText]}>{Number(date.slice(8))}</RNText>
                  </Pressable>
                ) : (
                  <View key={`blank-${j}`} style={d.day} />
                ),
              )}
            </View>
          ))}
        </View>
        {withTime ? (
          <View style={d.time}>
            <Pressable
              onPress={() => onChange(toggleNoTime(value, !noTime))}
              disabled={!value.date}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: noTime }}
              style={d.noTime}
            >
              <CheckBox on={noTime} />
              <RNText style={d.noTimeText}>시각 없음</RNText>
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={d.slots}>
              {TIME_SLOTS.map(slot => {
                const on = value.time === slot;
                return (
                  <Pressable
                    key={slot}
                    onPress={() => onChange({ date: value.date || today, time: slot })}
                    style={({ pressed }) => [d.slot, on && d.slotOn, pressed && !on && d.dayOn]}
                  >
                    <RNText style={[d.slotText, on && d.pickedText]}>{slot}</RNText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const dateStyles = ({ a }: GlassState) => ({
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  flex: { flex: 1 },
  clear: { width: 26, height: 26, borderRadius: 7, alignItems: 'center' as const, justifyContent: 'center' as const },
  clearOn: { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  monthRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
  nav: { width: 36, height: 36, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  monthTitle: { ...font(15, 600), color: T.text1 },
  week: { flexDirection: 'row' as const },
  weekday: { ...font(11, 600), color: T.text4, flex: 1, textAlign: 'center' as const, paddingVertical: 6 },
  day: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 44,
    margin: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  dayOn: { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  // 오늘 — 웹 .upcoming__date.is-today(강조 테두리 .55, 바탕 .12)
  today: { borderColor: alpha(a.accent, 0.55), backgroundColor: alpha(a.accent, 0.12) },
  picked: {
    backgroundColor: a.accent,
    backgroundImage: `linear-gradient(180deg, ${a.hi}, ${a.lo})`,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  dayText: { ...font(13.5, 500), ...TABULAR, color: T.text1 },
  pickedText: { color: a.ink, fontWeight: '700' as const },
  time: { gap: 12 },
  noTime: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 9, alignSelf: 'flex-start' as const },
  noTimeText: { ...font(12.5), color: T.text2 },
  slots: { gap: 6, paddingRight: 4 },
  slot: {
    ...WELL,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  slotOn: { backgroundColor: a.accent, borderColor: 'rgba(255, 255, 255, 0.14)' },
  slotText: { ...font(12.5, 500), ...TABULAR, color: T.text2 },
});

/** 체크 칸(웹 .check + 편집 패널 "체크됨 / 체크 안 됨") — 높이 42 */
export function CheckField({ label, value, onChange, disabled, changed, style }: CheckFieldProps) {
  const s = useFieldBox();
  return (
    <View style={[s.field, style]}>
      <FieldLabel label={label} changed={changed} />
      <Pressable
        onPress={() => onChange(!value)}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value, disabled: !!disabled }}
        style={({ pressed }) => [checkRow.row, pressed && { opacity: 0.8 }, disabled && s.off]}
      >
        <CheckBox on={value} />
        <RNText style={checkRow.text}>{value ? '체크됨' : '체크 안 됨'}</RNText>
      </Pressable>
    </View>
  );
}

const checkRow = {
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 9,
    height: 42,
    alignSelf: 'flex-start' as const,
  },
  text: { ...font(12.5), color: T.text2 },
};

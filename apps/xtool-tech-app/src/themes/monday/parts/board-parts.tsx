import { useState, type ReactNode } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { ChevronDown, ChevronRight, MessageCircle, MessageCirclePlus, Phone } from 'lucide-react-native';
import type { TechCellValue, TechColumn } from '@xtool-core/tech-boards';
import { formatInt } from '../../../features/dashboard/part-data';
import { phoneActionLabel, pressPhone, type PhoneAction } from '../../../features/phone-call';
import { useMon, useStyles } from '../theme-context';
import { FONT, INK, type MonPalette } from '../theme';
import { CountBadge, MText, withAlpha } from './basics';
import { CellValue, hasValue } from './cell-value';

// 보드 화면의 부품 — 그룹 머리(접기·색 막대 요약·고르기 체크), 항목 카드, 그룹 끝 "+ 추가"·합계. 웹 Monday 표의 그룹·
// 이름 칸 모양을 폰 카드로 옮겼다.

/** 고르기 체크 — 16×16, 반경 3, 1px 회색 줄. 고르면 파란 바탕에 흰 체크, 일부만 고르면 흰 가로 막대(웹 RowCheck) */
export function RowCheck({
  checked,
  mixed,
  onPress,
  label,
}: {
  checked: boolean;
  mixed?: boolean;
  onPress: () => void;
  label: string;
}) {
  const p = useMon();
  const on = checked || mixed;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: mixed ? 'mixed' : checked }}
      style={{
        width: 16,
        height: 16,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: on ? p.primary : p.control,
        backgroundColor: on ? p.primary : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? (
        <View
          style={{
            width: 8,
            height: 4,
            marginTop: -2,
            borderLeftWidth: 2,
            borderBottomWidth: 2,
            borderColor: INK,
            transform: [{ rotate: '-45deg' }],
          }}
        />
      ) : mixed ? (
        <View style={{ width: 8, height: 2, backgroundColor: INK }} />
      ) : null}
    </Pressable>
  );
}

/** 그룹 머리 — 접기 단추 + 그룹 색 18/500 제목 + "N개 항목", 펼치면 아래에 그룹 색 선(rule) */
export function GroupHeader({
  title,
  color,
  count,
  open,
  onToggle,
  rule,
  background,
  check,
}: {
  title: string;
  color: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  /** 펼쳤을 때 제목 아래 그룹 색 선(카드 목록과 나누는 줄) — 예전 상태 요약 막대 자리. 그룹이 상태를 따라 나뉘어
   * 막대가 거의 늘 한 색(상태 라벨 색)이라 그룹 색과 어긋나 보여서 그룹 색 한 줄로 바꿨다(2026-11-12) */
  rule?: boolean;
  /** 머리 바탕(붙어 있을 때 아래 카드를 가린다) — 기본은 보드 바탕 */
  background?: string;
  /** 고르는 중이면 그룹 체크(모두·일부) */
  check?: { checked: boolean; mixed: boolean; onPress: () => void };
}) {
  const p = useMon();
  const s = useStyles(groupStyles);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <View style={[s.wrap, background ? { backgroundColor: background } : null]}>
      <View style={s.row}>
        {check && (
          <RowCheck
            checked={check.checked}
            mixed={check.mixed}
            onPress={check.onPress}
            label={`${title} 모두 고르기`}
          />
        )}
        <Pressable
          onPress={onToggle}
          style={({ pressed }) => [s.toggle, pressed && { backgroundColor: p.overlay }]}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <Chevron size={18} strokeWidth={2.2} color={color} />
          <MText size={18} color={color} style={s.title} numberOfLines={1}>
            {title}
          </MText>
          <MText size={13} color={p.text2}>
            {count}개 항목
          </MText>
        </Pressable>
      </View>
      {open && rule && <View style={[s.rule, { backgroundColor: color }]} />}
    </View>
  );
}

const groupStyles = (p: MonPalette) => ({
  wrap: { paddingTop: 18, paddingBottom: 8, backgroundColor: p.bg },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  toggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    flexShrink: 1,
    paddingRight: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  title: { letterSpacing: -0.18, flexShrink: 1, marginRight: 4 },
  rule: { height: 6, borderRadius: 3, marginTop: 8 },
});

/**
 * 업데이트 말풍선 — 0이면 + 말풍선, 있으면 말풍선과 파란 개수(웹 이름 칸 오른쪽, 선 2.6). onPress가 있으면 눌러서
 * 업데이트 시트를 연다(카드 누르기와 따로).
 */
export function UpdatesBubble({ count, onPress }: { count: number; onPress?: () => void }) {
  const p = useMon();
  const Icon = count > 0 ? MessageCircle : MessageCirclePlus;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `업데이트 ${count}개 보기` : undefined}
      style={({ pressed }) => ({
        width: 30,
        height: 28,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? p.overlay : 'transparent',
      })}
    >
      <Icon size={19} strokeWidth={2.6} color={count > 0 ? p.text : p.text2} />
      {count > 0 && (
        <View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 1,
            minWidth: 15,
            height: 15,
            paddingHorizontal: 3,
            borderRadius: 8,
            backgroundColor: p.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MText size={10} color={INK}>
            {count >= 20 ? '20+' : count}
          </MText>
        </View>
      )}
    </Pressable>
  );
}

/**
 * 항목 카드 — 왼쪽 6pt 그룹 색 막대(웹 이름 칸의 막대), 첫 줄 (고르기 체크)·이름·하위 아이템 수·업데이트 말풍선, 둘째 줄
 * 미니 칸(상태 칸·담당자·날짜·하나 더). 누르면 항목 화면, 말풍선은 업데이트 시트, 길게 누르면 고르기(고르는 중이면
 * 누르기도 고르기).
 */
export function ItemCard({
  name,
  color,
  columns,
  values,
  subitemCount,
  phone,
  phoneAction,
  corner,
  subitemButton,
  updates,
  onUpdates,
  onPress,
  onLongPress,
  faded,
  picked,
  selecting,
}: {
  name: string;
  color: string;
  columns: TechColumn[];
  values: Record<string, TechCellValue>;
  subitemCount?: number;
  /** 이름 오른쪽 전화 단추에 보일 번호(보드별 카드 모양 — card-columns cardLayout). 누르면 전화(고르는 중에는 안 걸린다) */
  phone?: string | null;
  /** 번호(전화 단추·전화 칸)를 누르면 할 일 — 출장업무는 복사(phone-call phoneActionOf). 없으면 전화 */
  phoneAction?: PhoneAction;
  /** 오른쪽 아래(접수일 등) */
  corner?: ReactNode;
  /** 하위 아이템을 숫자 대신 "{label} N개" 단추로 — 누르면 목록(고르는 중에는 onPress 없음) */
  subitemButton?: { label: string; onPress?: () => void } | null;
  /** 업데이트 말풍선을 보이는 보드면 개수(0 포함), 아니면 undefined */
  updates?: number;
  /** 말풍선 누르기 — 업데이트 시트(고르는 중에는 넘기지 않는다) */
  onUpdates?: () => void;
  onPress?: () => void;
  onLongPress?: () => void;
  /** 만드는 중인 항목 */
  faded?: boolean;
  /** 고른 카드 — 웹 고른 줄 바탕(--mon-selected-row) */
  picked?: boolean;
  /** 고르는 중 — 체크를 보인다 */
  selecting?: boolean;
}) {
  const p = useMon();
  const s = useStyles(cardStyles);
  const shown = columns.filter(c => c.type === 'status' || c.type === 'assignee' || hasValue(c, values[c.id]));
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      disabled={!onPress && !onLongPress}
      accessibilityState={selecting ? { checked: !!picked } : undefined}
      style={({ pressed }) => [
        s.card,
        picked ? { backgroundColor: p.selectedRow } : pressed && { backgroundColor: p.hover },
        faded && { opacity: 0.6 },
      ]}
    >
      <View style={[s.bar, { backgroundColor: color }]} />
      <View style={s.body}>
        <View style={s.line1}>
          {selecting && onPress && <RowCheck checked={!!picked} onPress={onPress} label={`${name} 고르기`} />}
          <MText size={15} numberOfLines={1} style={s.name}>
            {name}
          </MText>
          {!!phone && (
            <Pressable
              onPress={() => pressPhone(phone, phoneAction)}
              disabled={selecting}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={phoneActionLabel(phone, phoneAction)}
              style={({ pressed }) => [s.phone, pressed && { backgroundColor: p.overlay }]}
            >
              <Phone size={12} color={p.link} />
              <MText size={13} color={p.link} numberOfLines={1} style={s.phoneText}>
                {phone}
              </MText>
            </Pressable>
          )}
          <View style={s.spacer} />
          {!subitemButton && !!subitemCount && <CountBadge count={subitemCount} />}
          {updates !== undefined && <UpdatesBubble count={updates} onPress={selecting ? undefined : onUpdates} />}
        </View>
        {(shown.length > 0 || (!!subitemButton && !!subitemCount) || !!corner) && (
          <View style={s.line2}>
            {!!subitemButton && !!subitemCount && (
              <Pressable
                onPress={subitemButton.onPress}
                disabled={!subitemButton.onPress}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${subitemButton.label} ${subitemCount}개 보기`}
                style={({ pressed }) => [s.chip, pressed && { backgroundColor: p.overlay }]}
              >
                <MText size={12} color={p.text}>
                  {subitemButton.label} {subitemCount}개
                </MText>
                <ChevronRight size={12} color={p.text2} />
              </Pressable>
            )}
            {shown.map(c => (
              <View key={c.id} style={s.mini}>
                <CellValue column={c} cell={values[c.id]} mode="card" callable={!selecting} phoneAction={phoneAction} />
              </View>
            ))}
            {!!corner && <View style={s.corner}>{corner}</View>}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const cardStyles = (p: MonPalette) => ({
  card: {
    flexDirection: 'row' as const,
    backgroundColor: p.cell,
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 8,
    overflow: 'hidden' as const,
    marginBottom: 8,
  },
  bar: { width: 6 },
  body: { flex: 1, paddingVertical: 10, paddingLeft: 12, paddingRight: 8, gap: 10 },
  line1: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, minHeight: 28 },
  name: { flexShrink: 1 },
  // 이름 옆 전화 단추 — 이름이 길면 이름이 먼저 줄어든다
  phone: {
    flexShrink: 0,
    maxWidth: '55%' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    height: 26,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 4,
  },
  phoneText: { flexShrink: 1 },
  spacer: { flex: 1 },
  line2: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const, gap: 10 },
  mini: { flexShrink: 1, maxWidth: '100%' as const },
  // 하위 아이템 단추("설치 품목 N개")
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    height: 26,
    paddingLeft: 8,
    paddingRight: 5,
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 4,
  },
  // 오른쪽 아래(접수일)
  corner: { marginLeft: 'auto' as const },
});

/**
 * 그룹 맨 아래 "+ {noun} 추가"(웹 .mon-row--add) — 그룹 색 45% 막대, 이름만 적고 완료(또는 다른 곳 누르기)면 그 그룹
 * 맨 아래에 바로 생긴다. 완료 뒤에도 칸에 남아 이어서 더 적을 수 있다. 하위 아이템 "+ 품목명 추가"도 같이 쓴다.
 */
export function AddCard({
  label,
  color,
  onAdd,
  compact,
}: {
  label: string;
  color: string;
  onAdd: (name: string) => void;
  /** 하위 아이템 줄(높이 34, 반경 6) */
  compact?: boolean;
}) {
  const p = useMon();
  const s = useStyles(addStyles);
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const submit = () => {
    const name = value.trim();
    if (!name) return;
    onAdd(name);
    setValue('');
  };
  return (
    <View style={[s.card, compact && s.compact]} collapsable={false}>
      <View style={[s.bar, { backgroundColor: withAlpha(color, 0.45) }]} />
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={`+ ${label} 추가`}
        placeholderTextColor={p.text2}
        accessibilityLabel={`${label} 추가`}
        keyboardAppearance={p.scheme}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={submit}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          submit();
        }}
        style={[s.input, compact && s.inputCompact, { borderColor: focused ? p.primary : 'transparent' }]}
      />
    </View>
  );
}

const addStyles = (p: MonPalette) => ({
  card: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: 44,
    backgroundColor: p.cell,
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 8,
    borderBottomLeftRadius: 8,
    overflow: 'hidden' as const,
    marginBottom: 8,
  },
  compact: { minHeight: 34, borderRadius: 6, marginBottom: 0 },
  bar: { width: 6, alignSelf: 'stretch' as const },
  input: {
    flex: 1,
    height: 32,
    marginHorizontal: 6,
    paddingHorizontal: 6,
    paddingVertical: 0,
    borderWidth: 1,
    borderRadius: 3,
    fontFamily: FONT.medium,
    fontSize: 14,
    color: p.text,
  },
  inputCompact: { height: 28, fontSize: 13.5 },
});

/** 그룹 아래 숫자 칸 합계(웹 요약 줄 — 1,234 위, "합계" 11 아래). 숫자 칸이 없으면 그리지 않는다 */
export function GroupSums({ sums }: { sums: { id: string; title: string; total: number }[] }) {
  const p = useMon();
  if (sums.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
      {sums.map(sum => (
        <View
          key={sum.id}
          style={{
            minWidth: 96,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderWidth: 1,
            borderColor: p.line,
            borderRadius: 4,
            alignItems: 'center',
          }}
        >
          <MText size={14} style={{ fontVariant: ['tabular-nums'], lineHeight: 16 }}>
            {formatInt(sum.total)}
          </MText>
          <MText size={11} color={p.text2} numberOfLines={1} style={{ lineHeight: 14 }}>
            {sum.title} 합계
          </MText>
        </View>
      ))}
    </View>
  );
}

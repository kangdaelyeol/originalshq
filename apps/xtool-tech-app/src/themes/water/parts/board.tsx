import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
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
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  ImageIcon,
  MessageCircle,
  MessageCirclePlus,
  PenLine,
  Phone,
  X,
} from 'lucide-react-native';
import { stageLabel, stageTone } from '@xtool-core/tech-stage';
import {
  avatarView,
  phoneActionLabel,
  phoneText,
  pressPhone,
  upcomingRow,
  type PhoneAction,
} from '../../../features/dashboard/part-data';
import { useFocusFade } from '../../../features/focus-fade';
import type {
  AssigneesProps,
  DetailFieldsProps,
  DetailListProps,
  DetailShellProps,
  DetailTextProps,
  FileListProps,
  MiniListProps,
  PhoneLinkProps,
  RecordListProps,
  RecordRowData,
  RecordRowProps,
  SelectionBarProps,
  StagePillProps,
  SubitemListProps,
  UpcomingListProps,
} from '../../dashboard/parts';
import { nowSec } from '../motion';
import {
  glassShadow,
  shadow,
  springArrival,
  springConfig,
  W,
  WATER_REVEAL,
  WATER_SPRING,
  WELL_FILL,
  WELL_SHADOW,
} from '../theme';
import { useWater } from '../theme-context';
import { WButton, WFlag, WIconButton, WPill } from './controls';
import { InCard } from './context';
import { WCheck } from './fields';
import { Backing, DarkPill, darkLayer, Glass, glassLayer, Groove, solidLayer } from './glass';
import { Spin } from './screen';
import { WSegmented } from './segmented';
import { Reveal, WAvatar, WEmpty, WSkel } from './surfaces';
import { WText } from './text';
import { useWaterIndicator } from './use-indicator';

// 물 보드 부품(웹 components/water/board — record-table·record-drawer·drawer-shell·cells·water-selection-bar, overview
// upcoming·mini). 기록 표는 폰 한 줄씩(줄 사이 가는 선), 누른 줄 뒤로 어두운 표시 알약이 세로로 스프링(ζ0.65·ω30.5)
// 따라가며 달리는 만큼 늘어난다(옆 찌그러짐은 50.5 / 줄 폭 — 넓은 줄도 D7처럼 9px쯤만 준다). 상세는 불투명 유리 판
// (wb-panel)이 28px 아래에서 move 스프링으로 떠오르고 내용이 0.132초부터 차례로 나타난다.

const FILL = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 } as const;
/** 표시 알약이 줄 위아래로 남기는 틈 */
const INSET_Y = 3;
/** D7 표시 알약의 옆 길이 — 세로로 달리는 줄 알약은 옆이 길어 찌그러짐 배율을 50.5 / 폭으로 */
const D7_ACROSS = 50.5;
/** 누른 줄 알약이 남아 있는 시간 — 밀어 넣은 상세 화면이 덮을 때까지(웹은 서랍이 열려 있는 동안) */
const HOLD_MS = 700;

// ── 작은 칸 ───────────────────────────────────────────────────────────────────

export function StagePill({ stage, status, style }: StagePillProps) {
  return (
    <WPill tone={stageTone({ stage, status })} style={style}>
      {stageLabel(stage)}
    </WPill>
  );
}

/** 담당자 — 첫 사람(유리 구슬 + 이름) + "+N" 흰 칩. 없으면 '—' */
export function Assignees({ names, style, onDark = false }: AssigneesProps & { onDark?: boolean }) {
  if (names.length === 0) {
    return (
      <WText size={11} weight="600" color={onDark ? W.onDark2 : W.ink3} style={style}>
        —
      </WText>
    );
  }
  const first = avatarView(names[0]);
  const rest = names.length - 1;
  return (
    <View style={[styles.assignees, style]} accessibilityLabel={names.join(', ')}>
      <WAvatar
        initials={first.initials}
        color={first.color}
        size="xs"
        ring={onDark ? 'rgba(70, 68, 73, 0.95)' : undefined}
      />
      <WText size={11.5} weight="600" color={onDark ? W.onDark2 : W.ink2} numberOfLines={1} style={styles.shrink}>
        {names[0]}
      </WText>
      {rest > 0 ? (
        <View style={[styles.more, onDark && styles.moreOnDark]}>
          <WText size={10.5} weight="700" color={onDark ? '#ffffff' : W.ink2}>
            +{rest}
          </WText>
        </View>
      ) : null}
    </View>
  );
}

/** 전화 걸기 — 010-1234-5678(고정폭), 옅은 밑줄. 누르면 전화(action 'copy'면 복사) */
export function PhoneLink({ phone, action, style }: PhoneLinkProps) {
  const text = phoneText(phone);
  if (!text) return null;
  return (
    <Pressable
      accessibilityRole={action === 'copy' ? 'button' : 'link'}
      accessibilityLabel={phoneActionLabel(text, action)}
      hitSlop={6}
      onPress={() => pressPhone(phone, action)}
      style={style}
    >
      {({ pressed }) => (
        <WText size={12.5} weight="500" color={pressed ? W.ink : W.ink2} tabular style={styles.phone}>
          {text}
        </WText>
      )}
    </Pressable>
  );
}

// ── 기록 줄 ───────────────────────────────────────────────────────────────────

/** 업데이트 말풍선 — 반투명 흰 알약 + 수, 없으면 흐린 "쓰기" 아이콘. 어두운 알약 위에서는 흰 글자 */
function UpdatesBubble({ count, onPress, onDark }: { count: number; onPress?: () => void; onDark: boolean }) {
  const empty = count === 0;
  const ink = onDark ? '#ffffff' : empty ? W.ink3 : W.ink2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={empty ? '업데이트 쓰기' : `업데이트 ${count}개`}
      hitSlop={8}
      onPress={onPress}
      style={[styles.bubble, !empty && (onDark ? styles.bubbleOnDark : styles.bubbleFill)]}
    >
      {empty ? (
        <MessageCirclePlus size={13} color={ink} strokeWidth={2} />
      ) : (
        <MessageCircle size={12} color={ink} strokeWidth={2} />
      )}
      {!empty ? (
        <WText size={11.5} weight="600" color={ink} tabular>
          {count}
        </WText>
      ) : null}
    </Pressable>
  );
}

/** 전화 단추 — 흰 알약에 전화 아이콘 + 010-1234-5678(안내색). 누르면 전화(action 'copy'면 복사), 고르는 중에는 누르지 않는다 */
function PhoneButton({
  number,
  action,
  disabled,
  onDark,
}: {
  number: string;
  action?: PhoneAction;
  disabled?: boolean;
  onDark: boolean;
}) {
  const text = phoneText(number) ?? number;
  const ink = onDark ? '#ffffff' : W.infoInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={phoneActionLabel(text, action)}
      hitSlop={6}
      onPress={() => pressPhone(number, action)}
      disabled={disabled}
      style={[styles.bubble, styles.phoneChip, onDark ? styles.bubbleOnDark : styles.bubbleFill]}
    >
      <Phone size={11} color={ink} strokeWidth={2.2} />
      <WText size={11.5} weight="600" color={ink} tabular numberOfLines={1} style={styles.shrink}>
        {text}
      </WText>
    </Pressable>
  );
}

/** 하위 아이템 단추 "설치 품목 3개 ›" — 말풍선과 같은 흰 알약. 고르는 중에는 누르지 않는다(줄 누름이 고르기로) */
function SubitemsChip({
  label,
  count,
  onPress,
  disabled,
  onDark,
}: {
  label: string;
  count: number;
  onPress?: () => void;
  disabled?: boolean;
  onDark: boolean;
}) {
  const ink = onDark ? '#ffffff' : W.ink2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${count}개 보기`}
      hitSlop={6}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={[styles.bubble, styles.subChip, onDark ? styles.bubbleOnDark : styles.bubbleFill]}
    >
      <WText size={11.5} weight="600" color={ink} tabular>
        {`${label} ${count}개`}
      </WText>
      <ChevronRight size={12} color={ink} strokeWidth={2.2} />
    </Pressable>
  );
}

/** 기록 줄의 모양 — onDark면 어두운 표시 알약 위(흰 글자). 이름 옆이나 아래에 전화 단추, 아래 줄 끝에 작은 글(접수일) */
const RowFace = memo(function RowFaceView({
  row,
  onDark,
  selecting,
  selected,
  onPressUpdates,
  onPressSubitems,
}: {
  row: RecordRowData;
  onDark: boolean;
  selecting?: boolean;
  selected?: boolean;
  onPressUpdates?: () => void;
  onPressSubitems?: () => void;
}) {
  const ink = onDark ? '#ffffff' : W.ink;
  const ink2 = onDark ? W.onDark2 : W.ink2;
  const dateInk = onDark
    ? '#ffffff'
    : row.date?.tone === 'crit'
    ? W.critInk
    : row.date?.tone === 'muted'
    ? W.ink2
    : W.ink;
  const meta = row.meta?.filter(Boolean).join(' · ');
  const dim = !!row.done && !onDark;
  // 끝난 줄의 흐림(opacity)은 줄 전체를 화면 밖에서 다시 그리게 하니 한 장으로 캐시해 둔다
  return (
    <View style={[styles.rowFace, dim ? styles.done : null]} shouldRasterizeIOS={dim}>
      {selecting ? <WCheck checked={!!selected} /> : null}
      <View style={styles.flex}>
        <View style={styles.rowTop}>
          <View style={styles.flex}>
            <View style={styles.titleLine}>
              <WText size={13} weight="600" color={ink} numberOfLines={1} onDark={onDark} style={styles.shrink}>
                {row.title}
              </WText>
              {row.phone?.beside ? (
                <View style={styles.phoneBeside}>
                  <PhoneButton
                    number={row.phone.number}
                    action={row.phone.action}
                    disabled={selecting}
                    onDark={onDark}
                  />
                </View>
              ) : null}
              {row.updates != null ? (
                <UpdatesBubble count={row.updates} onPress={onPressUpdates} onDark={onDark} />
              ) : null}
            </View>
            {row.subtitle ? (
              <WText size={11} color={ink2} tabular numberOfLines={1} style={styles.rowSub}>
                {row.subtitle}
              </WText>
            ) : null}
            {row.phone && !row.phone.beside ? (
              <View style={styles.phoneBelow}>
                <PhoneButton number={row.phone.number} action={row.phone.action} disabled={selecting} onDark={onDark} />
              </View>
            ) : null}
          </View>
          {row.date ? (
            <View style={styles.rowDate}>
              <WText size={12.5} weight="600" color={dateInk} tabular>
                {row.date.text}
              </WText>
              {row.date.hint ? (
                <WText size={11} weight="600" color={onDark ? '#ffffff' : W.infoInk}>
                  {row.date.hint}
                </WText>
              ) : null}
            </View>
          ) : null}
          {row.value ? (
            row.value.alert && !onDark ? (
              <WFlag tone="crit">{row.value.text}</WFlag>
            ) : (
              <WText size={12.5} weight="700" color={ink} tabular>
                {row.value.text}
              </WText>
            )
          ) : null}
        </View>
        {row.subitems ||
        row.stage ||
        row.pill ||
        meta ||
        (row.assignees && row.assignees.length > 0) ||
        row.saving ||
        row.corner ? (
          <View style={styles.rowMeta}>
            {row.subitems ? (
              <SubitemsChip
                label={row.subitems.label}
                count={row.subitems.count}
                onPress={onPressSubitems}
                disabled={selecting}
                onDark={onDark}
              />
            ) : null}
            {row.stage ? (
              <WPill tone={stageTone(row.stage)} onDark={onDark}>
                {stageLabel(row.stage.stage)}
              </WPill>
            ) : null}
            {row.pill ? (
              <WPill tone={row.pill.tone} dot={row.pill.dot ?? true} onDark={onDark}>
                {row.pill.label}
              </WPill>
            ) : null}
            {meta ? (
              <WText size={11.5} color={ink2} numberOfLines={1} style={styles.shrink}>
                {meta}
              </WText>
            ) : null}
            {row.assignees && row.assignees.length > 0 ? <Assignees names={row.assignees} onDark={onDark} /> : null}
            {row.saving ? (
              <View style={styles.saving}>
                <Spin size={11} color={onDark ? '#ffffff' : W.infoInk} />
                <WText size={10.5} weight="600" color={onDark ? '#ffffff' : W.infoInk}>
                  저장 중
                </WText>
              </View>
            ) : null}
            {row.corner ? (
              <WText size={11.5} color={ink2} tabular numberOfLines={1} onDark={onDark} style={styles.corner}>
                {row.corner}
              </WText>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
});

/** 기록 줄 하나(목록 밖에서 쓸 때) — 누르면 흰 칩이 깔린다 */
export function RecordRow({
  row,
  onPress,
  onLongPress,
  onPressUpdates,
  onPressSubitems,
  selecting,
  selected,
  style,
}: RecordRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={style}
    >
      {({ pressed }) => (
        <View style={styles.rowAlone}>
          {pressed ? <View style={[FILL, styles.rowPressed]} /> : null}
          <RowFace
            row={row}
            onDark={false}
            selecting={selecting}
            selected={selected}
            onPressUpdates={onPressUpdates}
            onPressSubitems={onPressSubitems}
          />
        </View>
      )}
    </Pressable>
  );
}

/** 뼈대 줄 — 이름·한 줄·알약 자리 */
function SkeletonRows() {
  return (
    <View>
      {[72, 48, 64, 56, 80].map((w, i) => (
        <View key={i} style={styles.skelRow}>
          <WSkel width={`${w}%`} />
          <WSkel width={`${Math.max(28, w - 30)}%`} />
          <WSkel shape="pill" width={72} />
          {i < 4 ? <View style={styles.ruleLine} /> : null}
        </View>
      ))}
    </View>
  );
}

/** 목록 줄 하나 — 바뀐 줄만 다시 그리게 memo(누른 줄 알약이 옮겨 가도 다른 줄은 그대로). 손잡이는 목록이 고정해 넘긴다 */
const RecordItem = memo(function RecordItemView({
  row,
  index,
  last,
  active,
  selecting,
  selected,
  onPress,
  onLongPress,
  onPressUpdates,
  onPressSubitems,
  onMeasure,
}: {
  row: RecordRowData;
  index: number;
  last: boolean;
  active: boolean;
  selecting?: boolean;
  selected: boolean;
  onPress: (id: string, index: number) => void;
  onLongPress?: (id: string) => void;
  onPressUpdates?: (id: string) => void;
  onPressSubitems?: (id: string) => void;
  onMeasure: (id: string, y: number, h: number) => void;
}) {
  const id = row.id;
  const updates = useCallback(() => onPressUpdates?.(id), [onPressUpdates, id]);
  const subitems = useCallback(() => onPressSubitems?.(id), [onPressSubitems, id]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onLayout={(e: LayoutChangeEvent) => onMeasure(id, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
      onPress={() => onPress(id, index)}
      onLongPress={onLongPress ? () => onLongPress(id) : undefined}
      delayLongPress={350}
    >
      {({ pressed }) => (
        <View style={styles.row}>
          {pressed && !active ? <View style={[FILL, styles.rowHover]} /> : null}
          <RowFace
            row={row}
            onDark={active}
            selecting={selecting}
            selected={selected}
            onPressUpdates={onPressUpdates ? updates : undefined}
            onPressSubitems={onPressSubitems ? subitems : undefined}
          />
          {last ? null : <View style={styles.ruleLine} />}
        </View>
      )}
    </Pressable>
  );
});

/**
 * 기록 목록(WaterRecordTable) — 판(w-glass 1·0.5, 둥글기 24) 머리 + 도구 줄 + 줄들 + "더 보기" 홈 알약. 줄을 누르면 그 줄
 * 뒤로 어두운 표시 알약이 지난번 자리에서 달려와 앉고(처음이면 제자리에서 0.1초에 진해진다) 글자가 흰색이 된 채 상세가
 * 열린다. 고르는 중에는 알약 없이 알리기만 한다.
 */
export function RecordList({
  title,
  subtitle,
  actions,
  toolbar,
  rows,
  emptyText,
  loading,
  onPressRow,
  onLongPressRow,
  onPressUpdates,
  onPressSubitems,
  selecting,
  selected,
  more,
  style,
}: RecordListProps) {
  const p = useWater();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const ind = useWaterIndicator({ squash: width > 0 ? Math.min(1, D7_ACROSS / width) : 1 });
  const boxes = useRef(new Map<string, { y: number; h: number }>());
  const placed = useRef<{ id: string; pos: number; size: number; index: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const shownO = useSharedValue(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const measure = useCallback((id: string, y: number, h: number) => {
    boxes.current.set(id, { y, h });
  }, []);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  const press = useCallback(
    (id: string, index: number) => {
      if (selecting) {
        onPressRow(id);
        return;
      }
      const b = boxes.current.get(id);
      if (b) {
        const target = { pos: b.y + b.h / 2, size: b.h - INSET_Y * 2 };
        const prev = placed.current;
        const travel = prev !== null && prev.id !== id && !reduced;
        ind.set(target, travel ? { at: nowSec(), step: b.h } : { instant: true });
        placed.current = { id, index, ...target };
        setActive(id);
        shownO.value = withTiming(1, { duration: 100, easing: Easing.bezier(0.333, 0.667, 0.667, 1) });
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
          setActive(null);
          shownO.value = withDelay(15, withTiming(0, { duration: 30 }));
        }, HOLD_MS);
      }
      onPressRow(id);
    },
    [selecting, reduced, ind, onPressRow, shownO],
  );

  const pillStyle = useAnimatedStyle(() => {
    const q = ind.pose.value;
    return {
      opacity: q.placed ? shownO.value : 0,
      height: q.size,
      transform: [{ translateY: q.pos - q.size / 2 }, { scaleX: q.across }, { scaleY: q.along }],
    };
  });

  return (
    <Glass radius={24} k={1} lift={0.5} style={[styles.record, style]}>
      <View style={styles.recordHead}>
        <View style={styles.flexShrink}>
          <WText size={16} weight="700" lh={1.3} accessibilityRole="header">
            {title}
          </WText>
          {subtitle ? (
            <WText size={12} weight="500" color={W.ink2} style={styles.count}>
              {subtitle}
            </WText>
          ) : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
      {toolbar ? <View style={styles.toolbar}>{toolbar}</View> : null}
      {loading ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <WText size={12.5} color={W.ink3} align="center" style={styles.empty}>
          {emptyText}
        </WText>
      ) : (
        <View style={styles.rows} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
          <Animated.View pointerEvents="none" style={[styles.pill, pillStyle]}>
            <View style={darkLayer(p, 999, 10)} />
          </Animated.View>
          {rows.map((row, i) => (
            <RecordItem
              key={row.id}
              row={row}
              index={i}
              last={i === rows.length - 1}
              active={active === row.id}
              selecting={selecting}
              selected={!!selected?.has(row.id)}
              onPress={press}
              onLongPress={onLongPressRow}
              onPressUpdates={onPressUpdates}
              onPressSubitems={onPressSubitems}
              onMeasure={measure}
            />
          ))}
        </View>
      )}
      {more ? (
        <Pressable accessibilityRole="button" onPress={more.onPress} style={styles.moreWrap}>
          {({ pressed }) => (
            <Groove k={1} radius={18} style={styles.moreBtn}>
              {pressed ? <View style={[FILL, styles.morePressed]} /> : null}
              <WText size={12.5} weight="600">
                더 보기
                <WText size={12.5} weight="500" color={W.ink2}>
                  {` · ${more.remaining}건 남음`}
                </WText>
              </WText>
            </Groove>
          )}
        </Pressable>
      ) : null}
    </Glass>
  );
}

// ── 고르기 막대 ─────────────────────────────────────────────────────────────────

/** 고르기 막대(WaterSelectionBar) — 떠 있는 유리 알약(벽 밝기로 거의 불투명), 고른 수는 어두운 표시 알약 */
export function SelectionBar({ count, actions, onClear, style }: SelectionBarProps) {
  const p = useWater();
  const reduced = useReducedMotion();
  const y = useSharedValue(reduced ? 0 : 12);
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withTiming(1, { duration: 180 });
    if (!reduced) y.value = withSpring(0, springConfig(WATER_SPRING.move));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const enter = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  return (
    <Animated.View
      style={[styles.selbar, { boxShadow: glassShadow(p, 1, 0.55) }, enter, style]}
      accessibilityLabel={`${count}개 선택됨`}
    >
      <DarkPill radius={14} em={10} style={styles.selCount}>
        <WText size={13} weight="700" onDark tabular>
          {count}
        </WText>
      </DarkPill>
      <WText size={13} weight="500" color={W.ink2} style={styles.selLabel}>
        개 선택
      </WText>
      {actions.map(a => (
        <WButton key={a.key} variant="ghost" size="sm" icon={a.icon} onPress={a.onPress}>
          {a.label}
        </WButton>
      ))}
      <WIconButton icon={X} label="선택 해제" size="sm" onPress={onClear} />
    </Animated.View>
  );
}

// ── 일정·짧은 목록 ──────────────────────────────────────────────────────────────

/** 날짜순 일정(WaterUpcomingList) — 날짜 칸은 불투명 유리 타일, 오늘은 어두운 표시 알약, 지난 날은 붉은 점 */
export function UpcomingList({ items, today, empty, mode = 'due', style }: UpcomingListProps) {
  const p = useWater();
  if (items.length === 0) return <WEmpty title={empty} style={style} />;
  return (
    <View style={[styles.list, style]}>
      {items.map((item, i) => {
        const v = upcomingRow(item, today, mode);
        return (
          <Reveal key={item.key} index={i}>
            <Pressable accessibilityRole="button" disabled={!item.onPress} onPress={item.onPress}>
              {({ pressed }) => (
                <View style={styles.upRow}>
                  {pressed ? <View style={[FILL, styles.rowPressed]} /> : null}
                  <View style={styles.dateTile}>
                    <Backing style={v.isToday ? darkLayer(p, 13, 10) : solidLayer(p, 0.38, 13, 'ellipse')} />
                    <WText size={13} weight="700" tabular onDark={v.isToday} color={v.isToday ? '#ffffff' : W.ink}>
                      {v.md}
                    </WText>
                    <WText size={10.5} color={v.isToday ? 'rgba(255, 255, 255, 0.78)' : W.ink2}>
                      {v.weekday}
                    </WText>
                  </View>
                  <View style={styles.flex}>
                    <WText size={13} weight="600" numberOfLines={1}>
                      {item.title}
                    </WText>
                    {item.meta ? (
                      <WText size={11.5} color={W.ink2} numberOfLines={1} style={styles.metaGap}>
                        {item.meta}
                      </WText>
                    ) : null}
                  </View>
                  <View style={styles.when}>
                    {v.overdue ? <View style={styles.overdueDot} /> : null}
                    <WText
                      size={11.5}
                      weight={mode === 'since' ? '500' : '600'}
                      color={mode === 'since' ? W.ink2 : W.ink}
                    >
                      {v.when}
                    </WText>
                  </View>
                </View>
              )}
            </Pressable>
          </Reveal>
        );
      })}
    </View>
  );
}

/** 짧은 목록(WaterMiniList) — 이름 · 한 줄 · 오른쪽 값(바로 챙길 값은 붉은 점 칩) */
export function MiniList({ items, empty, style }: MiniListProps) {
  if (items.length === 0) return <WEmpty title={empty} style={style} />;
  return (
    <View style={[styles.list, style]}>
      {items.map((item, i) => (
        <Reveal key={item.key} index={i}>
          <Pressable accessibilityRole="button" disabled={!item.onPress} onPress={item.onPress}>
            {({ pressed }) => (
              <View style={styles.miniRow}>
                {pressed ? <View style={[FILL, styles.rowPressed]} /> : null}
                <View style={styles.flex}>
                  <WText size={13} weight="600" numberOfLines={1}>
                    {item.title}
                  </WText>
                  {item.meta ? (
                    <WText size={11.5} color={W.ink2} numberOfLines={1} style={styles.metaGap}>
                      {item.meta}
                    </WText>
                  ) : null}
                </View>
                {item.value ? (
                  item.alert ? (
                    <WFlag tone="crit">{item.value}</WFlag>
                  ) : (
                    <WText size={12.5} weight="700" tabular>
                      {item.value}
                    </WText>
                  )
                ) : null}
              </View>
            )}
          </Pressable>
        </Reveal>
      ))}
    </View>
  );
}

// ── 상세 ─────────────────────────────────────────────────────────────────────

const REVEAL_AT = springArrival(WATER_SPRING.move);

/** 상세가 열릴 때 — 내용이 0.132초부터 21ms 간격으로 55ms 동안(웹 drawer-engine) */
function DetailReveal({
  index,
  children,
  style,
}: {
  index: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    o.value = withDelay(
      (REVEAL_AT + Math.min(index, 12) * WATER_REVEAL.stagger) * 1000,
      withTiming(1, { duration: WATER_REVEAL.fade * 1000, easing: Easing.linear }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[anim, style]}>{children}</Animated.View>;
}

/**
 * 상세 화면 틀(WaterRecordDrawer — 가운데 뜨는 불투명 유리 판을 폰 한 화면으로) — 무대 위에 뒤로·동작 줄, 그 아래
 * 불투명 유리 판(wb-panel 1·1, 둥글기 24)이 28px 아래에서 move 스프링으로 떠오르고, 머리(보드 이름·이름·단계)·탭·
 * 본문이 차례로 나타난다.
 */
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
  const p = useWater();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  // 판은 투명도 없이 떠오르기만(판 전체를 흐리게 하면 그림자 겹을 매 프레임 화면 밖에서 다시 그린다)
  const rise = useSharedValue(reduced ? 0 : 28);
  useEffect(() => {
    if (!reduced) rise.value = withSpring(0, springConfig(WATER_SPRING.move));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value }] }));
  const fade = useFocusFade(true);
  return (
    <Animated.View collapsable={false} style={[styles.flex, fade]}>
      <View style={[styles.detailBar, { paddingTop: insets.top + 6 }]}>
        <WIconButton icon={ChevronLeft} label="뒤로" size="sm" onPress={onBack} />
        <View style={styles.flex} />
        {actions?.map(a =>
          a.danger ? (
            <WButton key={a.key} variant="danger" size="sm" icon={a.icon} onPress={a.onPress}>
              {a.label}
            </WButton>
          ) : (
            <WButton key={a.key} variant="ghost" size="sm" icon={a.icon} onPress={a.onPress}>
              {a.label}
            </WButton>
          ),
        )}
      </View>
      <Animated.View collapsable={false} style={[styles.detailPanel, { marginBottom: insets.bottom + 8 }, panelStyle]}>
        <Backing style={glassLayer(p, 1, 1, 24, 'pane')} fit />
        <DetailReveal index={0}>
          <View style={styles.detailHead}>
            {eyebrow ? (
              <Pressable
                disabled={!onPressEyebrow}
                onPress={onPressEyebrow}
                hitSlop={6}
                accessibilityRole={onPressEyebrow ? 'link' : undefined}
              >
                <WText size={11.5} weight="600" color={W.ink2} style={onPressEyebrow ? styles.underline : null}>
                  {eyebrow}
                </WText>
              </Pressable>
            ) : null}
            <WText size={19} weight="700" lh={1.35} accessibilityRole="header" selectable>
              {title || '(이름 없음)'}
            </WText>
            {stage ? (
              <WPill tone={stageTone(stage)}>{stageLabel(stage.stage)}</WPill>
            ) : pill ? (
              <WPill tone={pill.tone} dot={pill.dot ?? true}>
                {pill.label}
              </WPill>
            ) : null}
          </View>
        </DetailReveal>
        {tabs ? (
          <DetailReveal index={1}>
            <View style={styles.detailTabs}>
              <WSegmented
                options={tabs.options}
                value={tabs.value}
                onChange={tabs.onChange}
                size="sm"
                accessibilityLabel="상세 보기"
              />
            </View>
          </DetailReveal>
        ) : null}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.detailBody}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={W.ink2} />
            ) : undefined
          }
        >
          {/* 본문 부품(칸·글·목록·파일·안내) 사이 18px — 웹 water-drawer__body gap */}
          <DetailReveal index={2} style={styles.detailStack}>
            <InCard.Provider value>{children}</InCard.Provider>
          </DetailReveal>
        </ScrollView>
        {footer ? <View style={styles.detailFoot}>{footer}</View> : null}
      </Animated.View>
    </Animated.View>
  );
}

/** 묶음 제목(웹 water-drawer__section h3) — 600 11 · 글자 사이 0.06em */
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <WText size={11} weight="600" em={0.06} color={W.ink2} style={styles.h3}>
      {children}
    </WText>
  );
}

/** 상세 이름/값 목록 — 84 | 나머지, 500 13/1.45. 고칠 수 있는 칸은 누르면 흰 칩 + 연필 */
export function DetailFields({ title, fields, style }: DetailFieldsProps) {
  return (
    <View style={style}>
      {title ? <SectionTitle>{title}</SectionTitle> : null}
      <View style={styles.fields}>
        {fields.map(f => {
          const value = f.content ?? (
            <WText size={13} weight="500" lh={1.45} selectable={!f.onPress}>
              {f.value ? f.value : '—'}
            </WText>
          );
          const body = (pressed: boolean) => (
            <View style={styles.field}>
              {pressed ? <View style={[FILL, styles.fieldPressed]} /> : null}
              <WText size={13} weight="500" lh={1.45} color={W.ink2} style={styles.fieldLabel}>
                {f.label}
              </WText>
              <View style={styles.flex}>{value}</View>
              {f.onPress ? <PenLine size={13} color={W.ink3} strokeWidth={2} style={styles.pen} /> : null}
            </View>
          );
          return f.onPress ? (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityLabel={`${f.label} 고치기`}
              onPress={f.onPress}
            >
              {({ pressed }) => body(pressed)}
            </Pressable>
          ) : (
            <View key={f.key}>{body(false)}</View>
          );
        })}
      </View>
    </View>
  );
}

/** 상세 긴 글 — 유리에 파인 칸(wb-well) 속 글 */
export function DetailText({ label, text, onPress, style }: DetailTextProps) {
  const well = (pressed: boolean) => (
    <View style={[styles.well, { backgroundColor: WELL_FILL, boxShadow: WELL_SHADOW }, pressed && styles.wellPressed]}>
      <WText size={13} weight="500" lh={1.6} color={W.ink2} selectable={!onPress} style={styles.flex}>
        {text}
      </WText>
      {onPress ? <PenLine size={13} color={W.ink3} strokeWidth={2} /> : null}
    </View>
  );
  return (
    <View style={style}>
      <SectionTitle>{label}</SectionTitle>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} 고치기`} onPress={onPress}>
          {({ pressed }) => well(pressed)}
        </Pressable>
      ) : (
        well(false)
      )}
    </View>
  );
}

/** 상세 작은 목록 — 줄 사이 가는 선, 오른쪽 흐린 글 */
export function DetailList({ title, items, style }: DetailListProps) {
  return (
    <View style={style}>
      <SectionTitle>{title}</SectionTitle>
      {items.map((item, i) => (
        <View key={item.key} style={styles.smallRow}>
          <WText size={12.5} color={W.ink2} style={styles.flex}>
            {item.label}
          </WText>
          {item.meta ? (
            <WText size={12.5} color={W.ink3} tabular>
              {item.meta}
            </WText>
          ) : null}
          {i < items.length - 1 ? <View style={styles.ruleLine} /> : null}
        </View>
      ))}
    </View>
  );
}

/** 파일 — 사진은 홈 속 썸네일(76px 넘게, 둥글기 14), 문서는 이름 줄 */
export function FileList({ title, files, empty = '파일이 없어요', onPressFile, style }: FileListProps) {
  const { width } = useWindowDimensions();
  const images = files.filter(f => f.kind === 'image');
  const docs = files.filter(f => f.kind !== 'image');
  // 판 안쪽 폭에서 76px 넘는 칸을 고르게(웹 auto-fill minmax(76px, 1fr))
  const inner = width - 16 - 48;
  const cols = Math.max(3, Math.floor((inner + 8) / (76 + 8)));
  const size = (inner - 8 * (cols - 1)) / cols;
  return (
    <View style={style}>
      <SectionTitle>{title}</SectionTitle>
      {files.length === 0 ? <WEmpty title={empty} /> : null}
      {images.length > 0 ? (
        <View style={styles.thumbs}>
          {images.map(f => (
            <Pressable
              key={f.key}
              accessibilityRole="imagebutton"
              accessibilityLabel={f.name}
              disabled={!f.url}
              onPress={() => onPressFile(f)}
            >
              <Groove k={0.8} radius={14} style={[styles.thumb, { width: size, height: size }]}>
                {f.thumbUrl || f.url ? (
                  <Image source={{ uri: f.thumbUrl ?? f.url ?? undefined }} style={[FILL, styles.thumbImg]} />
                ) : (
                  <ImageIcon size={20} color={W.ink2} strokeWidth={2} />
                )}
              </Groove>
            </Pressable>
          ))}
        </View>
      ) : null}
      {docs.map((f, i) => (
        <Pressable key={f.key} accessibilityRole="link" disabled={!f.url} onPress={() => onPressFile(f)}>
          {({ pressed }) => (
            <View style={[styles.fileRow, !f.url && styles.dim, pressed && styles.filePressed]}>
              <FileText size={15} color={W.ink2} strokeWidth={2} />
              <WText size={12.5} weight="500" numberOfLines={1} style={styles.flex}>
                {f.name}
              </WText>
              {f.meta ? (
                <WText size={11.5} color={W.ink3}>
                  {f.meta}
                </WText>
              ) : null}
              {i < docs.length - 1 ? <View style={styles.ruleLine} /> : null}
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

/** 하위 아이템 — 이름·한 줄·알약, 줄 사이 가는 선 */
export function SubitemList({ title, items, empty = '하위 아이템이 없어요', style }: SubitemListProps) {
  return (
    <View style={style}>
      <SectionTitle>{title}</SectionTitle>
      {items.length === 0 ? <WEmpty title={empty} /> : null}
      {items.map((item, i) => (
        <View key={item.key} style={styles.subRow}>
          <View style={styles.flex}>
            <WText size={13} weight="600" numberOfLines={2}>
              {item.name}
            </WText>
            {item.meta ? (
              <WText size={11.5} color={W.ink2} numberOfLines={1} style={styles.metaGap}>
                {item.meta}
              </WText>
            ) : null}
          </View>
          {item.pill ? (
            <WPill tone={item.pill.tone} dot={item.pill.dot ?? true}>
              {item.pill.label}
            </WPill>
          ) : null}
          {i < items.length - 1 ? <View style={styles.ruleLine} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  dim: { opacity: 0.5 },
  done: { opacity: 0.7 },
  underline: { textDecorationLine: 'underline', textDecorationColor: W.linkLine },
  // 줄 사이 가는 선 — 1px 뷰(안쪽 그림자 한 겹도 iOS에서는 마스크 층이라 줄마다 쌓이면 무겁다)
  ruleLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: W.rule },
  assignees: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  more: {
    minWidth: 24,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: W.chip,
  },
  moreOnDark: { backgroundColor: W.onDarkFill },
  phone: { textDecorationLine: 'underline', textDecorationColor: 'rgba(63, 62, 67, 0.25)' },
  // 흰 1px 테는 그림자 대신 테두리로 — 테가 없는 모양도 같은 크기가 되게 투명 테를 늘 두른다
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 1,
    paddingHorizontal: 7,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bubbleFill: { backgroundColor: W.chip, borderColor: W.chipRing },
  bubbleOnDark: { backgroundColor: W.rowHover },
  rowFace: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowSub: { marginTop: 1 },
  // 이름 옆 전화 단추(이름이 먼저 줄어든다) / 이름 아래 전화 단추
  phoneBeside: { flexShrink: 0, maxWidth: '55%' },
  phoneBelow: { flexDirection: 'row', marginTop: 4 },
  phoneChip: { gap: 4, maxWidth: '100%' },
  subChip: { gap: 2, paddingRight: 4 },
  // 아래 줄 오른쪽 끝(접수일) — 줄이 넘치면 다음 줄 오른쪽으로
  corner: { marginLeft: 'auto' },
  rowDate: { alignItems: 'flex-end', gap: 1 },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 7 },
  saving: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowAlone: { paddingVertical: 11, paddingHorizontal: 14 },
  rowPressed: { borderRadius: 14, backgroundColor: W.chip },
  record: { paddingTop: 20, paddingHorizontal: 12, paddingBottom: 14 },
  recordHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  count: { marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  toolbar: { paddingHorizontal: 10, marginBottom: 12, gap: 10 },
  empty: { paddingVertical: 28 },
  rows: { position: 'relative' },
  pill: { position: 'absolute', left: 0, right: 0, top: 0, borderRadius: 999 },
  row: { paddingVertical: 11, paddingHorizontal: 14 },
  rowHover: { backgroundColor: W.rowHover },
  skelRow: { gap: 8, paddingVertical: 12, paddingHorizontal: 14 },
  moreWrap: { marginTop: 12, marginHorizontal: 2 },
  moreBtn: { height: 36, alignItems: 'center', justifyContent: 'center' },
  morePressed: { borderRadius: 18, backgroundColor: 'rgba(0, 0, 0, 0.085)' },
  selbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 999,
    backgroundColor: W.floatFill,
    maxWidth: '96%',
  },
  selCount: { minWidth: 28, height: 28, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  selLabel: { marginRight: 4 },
  list: { gap: 2 },
  upRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 6,
    paddingRight: 10,
  },
  dateTile: { width: 46, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  metaGap: { marginTop: 2 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  overdueDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: W.crit },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 10 },
  detailBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  detailPanel: { flex: 1, marginHorizontal: 8, borderRadius: 24 },
  detailHead: {
    gap: 6,
    alignItems: 'flex-start',
    paddingTop: 22,
    paddingRight: 20,
    paddingBottom: 16,
    paddingLeft: 24,
    boxShadow: [shadow(0, -1, 0, 0, W.rule, true)],
  },
  detailTabs: { paddingTop: 10, paddingHorizontal: 24, paddingBottom: 6 },
  detailBody: { paddingTop: 16, paddingHorizontal: 24, paddingBottom: 24 },
  detailStack: { gap: 18 },
  detailFoot: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    boxShadow: [shadow(0, 1, 0, 0, W.rule, true)],
  },
  h3: { marginBottom: 8 },
  fields: { gap: 9 },
  field: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  fieldLabel: { width: 84 },
  fieldPressed: { left: -8, right: -8, top: -4, bottom: -4, borderRadius: 10, backgroundColor: W.chip },
  pen: { marginTop: 3 },
  well: { flexDirection: 'row', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14 },
  wellPressed: { opacity: 0.85 },
  smallRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  thumb: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { borderRadius: 14 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 36,
    paddingVertical: 5,
    paddingHorizontal: 2,
  },
  filePressed: { backgroundColor: W.chip, borderRadius: 10 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
});

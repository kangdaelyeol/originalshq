import { Children, createContext, isValidElement, useContext, useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text as RNText, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { CircleAlert, Info, TriangleAlert } from 'lucide-react-native';
import { barListRows } from '../../../features/dashboard/part-data';
import type {
  BarListProps,
  CardProps,
  EmptyStateProps,
  KpiGridProps,
  NoticeProps,
  SectionProps,
  SkeletonProps,
  StatCardProps,
} from '../../dashboard/parts';
import { alpha, font, RADIUS, RAISED, T, TABULAR, TINT, TONE } from '../theme';
import { useStyles, type GlassState } from '../theme-context';
import { GlassSurface } from '../glass-surface';
import { Button, StatusPill } from './controls';
import { Enter, SpinIcon } from './text';

// 판 — 웹 GlassCard·StatCard·.grid--kpi·.card.empty·BarList·king-section 제목. 판은 모두 GlassSurface(흐린 배경 위
// 반투명 칠 + 150deg 빛 + 테두리 빛 + 아래 그림자)에 웹 여백(폰 폭 ≤720px 값)으로.

// ── 판(웹 GlassCard) ─────────────────────────────────────────────────────────────────────────────────────

/** 판 안인지 — 판 안의 빈 화면(EmptyState)은 판을 또 그리지 않는다(카드·상세·시트가 켠다) */
export const InPanelContext = createContext(false);

/** 줄 부품 표시 — 판(padded=false) 안에서 줄을 어떻게 놓을지: bleed는 판 끝까지(기록 줄), inset은 판 여백 안쪽 + 사이 줄 */
export type RowKind = 'bleed' | 'inset';
export function markRow<C>(component: C, kind: RowKind): C {
  (component as { glassRow?: RowKind }).glassRow = kind;
  return component;
}
const rowKind = (type: unknown): RowKind | null => (type as { glassRow?: RowKind } | null)?.glassRow ?? null;

/** 판 끝까지 가는 덩어리 — 끝까지 가는 판 안에서 여백을 더하지 않는다(기록 목록의 뼈대·빈 글·더 보기) */
export const Bleed = markRow(function Bleed({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return <View style={style}>{children}</View>;
},
'bleed');

/**
 * 끝까지 가는 판(padded=false) 안 차례 — 기록 줄은 그대로, 다른 줄(내 업무·사람·고르기)은 판 여백(18) 안쪽에 두고 사이에
 * 가는 줄(웹 .my-work__row + .my-work__row)을, 그 밖(빈 화면·"더 보기")은 여백 안쪽에.
 */
function flushChildren(children: ReactNode, s: ReturnType<typeof cardStyles>): ReactNode[] {
  const out: ReactNode[] = [];
  let prevInset = false;
  Children.toArray(children).forEach((child, i) => {
    const key = isValidElement(child) && child.key !== null ? child.key : String(i);
    const kind = isValidElement(child) ? rowKind(child.type) : null;
    if (kind === 'bleed') {
      out.push(child);
      prevInset = false;
      return;
    }
    if (kind === 'inset') {
      if (prevInset) out.push(<View key={`sep:${key}`} style={s.separator} />);
      out.push(
        <View key={`row:${key}`} style={s.inset}>
          {child}
        </View>,
      );
      prevInset = true;
      return;
    }
    out.push(
      <View key={`cell:${key}`} style={[s.inset, s.cell]}>
        {child}
      </View>,
    );
    prevInset = false;
  });
  return out;
}

/** 판 — 머리(제목 15/600 · 부제 12 · 오른쪽 동작) 아래 18 띄우고 내용. 웹 ≤720px 안쪽 여백 18 */
export function Card({ title, subtitle, actions, toolbar, padded = true, onPress, style, children }: CardProps) {
  const s = useStyles(cardStyles);
  const head = title || subtitle || actions;
  const hasBody = Children.toArray(children).length > 0;
  const body = (
    <>
      {head ? (
        <View style={[s.header, !padded && s.inset, !toolbar && !hasBody && s.headerOnly]}>
          <View style={s.heading}>
            {title ? <RNText style={s.title}>{title}</RNText> : null}
            {subtitle ? <RNText style={s.subtitle}>{subtitle}</RNText> : null}
          </View>
          {actions ? <View style={s.actions}>{actions}</View> : null}
        </View>
      ) : null}
      {toolbar ? <View style={[s.toolbar, !padded && s.inset]}>{toolbar}</View> : null}
      {padded ? children : flushChildren(children, s)}
    </>
  );
  return (
    <Enter style={style}>
      <GlassSurface radius={RADIUS.card} style={padded ? s.padded : s.flush}>
        <InPanelContext.Provider value>
          {onPress ? (
            <Pressable onPress={onPress} accessibilityRole="button" style={s.press}>
              {({ pressed }) => (
                <>
                  {pressed ? <View pointerEvents="none" style={[s.pressedLayer, !padded && s.pressedFlush]} /> : null}
                  {body}
                </>
              )}
            </Pressable>
          ) : (
            body
          )}
        </InPanelContext.Provider>
      </GlassSurface>
    </Enter>
  );
}

const cardStyles = () => ({
  padded: { padding: 18 },
  flush: { paddingTop: 18, paddingBottom: 10 },
  inset: { paddingHorizontal: 18 },
  cell: { paddingTop: 4 },
  separator: { height: 1, marginHorizontal: 18, backgroundColor: T.line },
  headerOnly: { marginBottom: 0 },
  press: { flexGrow: 1 },
  pressedLayer: {
    position: 'absolute' as const,
    left: -18,
    top: -18,
    right: -18,
    bottom: -18,
    borderRadius: RADIUS.card,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  pressedFlush: { left: 0, right: 0, bottom: -6 },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    flexWrap: 'wrap' as const,
    rowGap: 12,
    columnGap: 16,
    marginBottom: 18,
  },
  heading: { flexShrink: 1, minWidth: 0 },
  title: { ...font(15, 600, { ls: -0.01, lh: 1.4 }), color: T.text1 },
  subtitle: { ...font(12, 400, { lh: 1.45 }), color: T.text3, marginTop: 3 },
  actions: { flexDirection: 'row' as const, alignItems: 'center' as const, flexWrap: 'wrap' as const, gap: 10 },
  toolbar: { marginBottom: 14, gap: 10 },
});

// ── 숫자 카드(웹 StatCard) ───────────────────────────────────────────────────────────────────────────────

/** 숫자 카드 — 제목 12.5/500 · 아이콘 칸 36 / 값 26/700 / 알약·설명 11.5. 웹 hover 들기 대신 누르면 살짝 밝게 */
export function StatCard({ title, value, icon: I, tint = 'blue', caption, tag, onPress, style }: StatCardProps) {
  const s = useStyles(statStyles);
  const chip = TINT[tint];
  const content = (pressed: boolean) => (
    <>
      {pressed ? <View pointerEvents="none" style={s.pressedLayer} /> : null}
      <View style={s.header}>
        <RNText style={s.title} numberOfLines={2}>
          {title}
        </RNText>
        {I ? (
          <View style={[s.chip, { backgroundColor: chip.bg, borderColor: chip.border }]}>
            <I size={16} strokeWidth={2} color={chip.color} />
          </View>
        ) : null}
      </View>
      <RNText style={s.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </RNText>
      {tag || caption ? (
        <View style={s.footer}>
          {tag ? <StatusPill tone={tag.tone} label={tag.label} dot={tag.dot} /> : null}
          {caption ? <RNText style={s.caption}>{caption}</RNText> : null}
        </View>
      ) : null}
    </>
  );
  return (
    <Enter style={style}>
      <GlassSurface radius={RADIUS.card} style={s.box}>
        {onPress ? (
          <Pressable onPress={onPress} accessibilityRole="button">
            {({ pressed }) => content(pressed)}
          </Pressable>
        ) : (
          content(false)
        )}
      </GlassSurface>
    </Enter>
  );
}

const statStyles = () => ({
  box: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1 },
  pressedLayer: {
    position: 'absolute' as const,
    left: -20,
    top: -18,
    right: -20,
    bottom: -20,
    borderRadius: RADIUS.card,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
    minHeight: 36,
  },
  title: { ...font(12.5, 500, { lh: 1.5 }), color: T.text2, paddingTop: 2, flexShrink: 1 },
  chip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  value: { ...font(26, 700, { ls: -0.025, lh: 1.15 }), ...TABULAR, color: '#ffffff', marginTop: 8 },
  footer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    minHeight: 22,
    marginTop: 14,
  },
  caption: { ...font(11.5, 400, { lh: 1.45 }), color: T.text3, flexShrink: 1 },
});

/** 숫자 카드 묶음(웹 .grid--kpi) — 폰은 두 칸, 사이 12. 불러오는 중이면 빈 카드(뼈대) */
export function KpiGrid({ items, placeholders = 4, style }: KpiGridProps) {
  const s = useStyles(gridStyles);
  if (!items) {
    return (
      <View style={[s.grid, style]}>
        {Array.from({ length: placeholders }, (_, i) => (
          <View key={i} style={s.cell}>
            <GlassSurface radius={RADIUS.card} style={s.ghost}>
              <Skeleton width="55%" height={12} radius="sm" />
              <Skeleton width="40%" height={26} radius="sm" style={s.ghostValue} />
              <Skeleton width="70%" height={10} radius="sm" style={s.ghostCaption} />
            </GlassSurface>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={[s.grid, style]}>
      {items.map(({ key, ...card }) => (
        <View key={key} style={s.cell}>
          <StatCard {...card} style={s.fill} />
        </View>
      ))}
    </View>
  );
}

const gridStyles = () => ({
  grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12 },
  // 두 칸 — (폭 − 사이 12) / 2
  cell: { flexBasis: '46%' as const, flexGrow: 1, minWidth: 0 },
  fill: { flex: 1 },
  ghost: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 20, minHeight: 132 },
  ghostValue: { marginTop: 18 },
  ghostCaption: { marginTop: 18 },
});

// ── 구역·빈 화면·안내·뼈대 ────────────────────────────────────────────────────────────────────────────────

/** 구역(웹 king-section·attention) — 판 밖 제목 15/700 + 흐린 글 12/500 + 오른쪽, 내용과 사이 12 */
export function Section({ title, aside, right, style, children }: SectionProps) {
  const s = useStyles(sectionStyles);
  return (
    <View style={[s.section, style]}>
      {title || aside || right ? (
        <View style={s.head}>
          <RNText style={s.title}>
            {title}
            {aside ? <RNText style={s.aside}>{`  ${aside}`}</RNText> : null}
          </RNText>
          {right ? <View style={s.right}>{right}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const sectionStyles = () => ({
  section: { gap: 12 },
  head: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingHorizontal: 4 },
  title: { ...font(15, 700, { lh: 1.4 }), color: T.text1, flex: 1 },
  aside: { ...font(12, 500), color: T.text4 },
  right: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
});

/** 빈 화면·불러오는 중·오류(웹 .card.empty) — 볼록 칸 52 r15 아이콘, 제목 17/700, 글 13 */
export function EmptyState({ title, text, icon: I = Info, loading, tone = 'default', action, style }: EmptyStateProps) {
  const s = useStyles(emptyStyles);
  const inPanel = useContext(InPanelContext);
  const error = tone === 'error';
  const content = (
    <>
      <View style={[s.icon, error && s.iconError]}>
        {loading ? (
          <SpinIcon size={22} color={s.accent.color} />
        ) : (
          <I size={22} strokeWidth={2} color={error ? T.crit : s.accent.color} />
        )}
      </View>
      <RNText style={s.title}>{title}</RNText>
      {text ? <RNText style={s.text}>{text}</RNText> : null}
      {action ? <Button label={action.label} onPress={action.onPress} style={s.action} /> : null}
    </>
  );
  // 판 안이면 판을 또 그리지 않고 가운데 글만(웹 .card.empty는 판 자체)
  if (inPanel) return <View style={[s.plain, style]}>{content}</View>;
  return (
    <Enter style={style}>
      <GlassSurface radius={RADIUS.card} style={s.box}>
        {content}
      </GlassSurface>
    </Enter>
  );
}

const emptyStyles = ({ a }: GlassState) => ({
  box: { alignItems: 'center' as const, gap: 10, paddingVertical: 56, paddingHorizontal: 24 },
  plain: { alignItems: 'center' as const, gap: 10, paddingVertical: 28, paddingHorizontal: 8 },
  icon: {
    ...RAISED,
    width: 52,
    height: 52,
    borderRadius: 15,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 6,
  },
  iconError: { backgroundColor: 'rgba(248, 113, 113, 0.12)', borderColor: 'rgba(248, 113, 113, 0.28)' },
  accent: { color: a.accent },
  title: { ...font(17, 700, { lh: 1.35 }), color: T.text1, textAlign: 'center' as const },
  text: { ...font(13, 400, { lh: 1.5 }), color: T.text3, textAlign: 'center' as const, maxWidth: 420, marginBottom: 6 },
  action: { alignSelf: 'center' as const, marginTop: 4 },
});

const NOTICE = {
  info: { icon: Info, color: T.info, bg: 'rgba(255, 255, 255, 0.04)' },
  warn: { icon: TriangleAlert, color: T.warn, bg: 'rgba(251, 191, 36, 0.08)' },
  error: { icon: CircleAlert, color: T.crit, bg: 'rgba(248, 113, 113, 0.08)' },
} as const;

/** 안내 줄(웹 .editor__locked 모양) — 옅은 바탕 r10, 11.5 흐린 글 + 아이콘, 오른쪽 글 단추 */
export function Notice({ text, tone = 'info', loading, action, style }: NoticeProps) {
  const s = useStyles(noticeStyles);
  const n = NOTICE[tone];
  return (
    <View style={[s.box, { backgroundColor: n.bg }, style]}>
      <View style={s.icon}>
        {loading ? <SpinIcon size={13} color={T.text3} /> : <n.icon size={13} strokeWidth={2.2} color={n.color} />}
      </View>
      <RNText style={[s.text, tone === 'error' && { color: T.crit }]}>{text}</RNText>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button">
          {({ pressed }) => <RNText style={[s.action, pressed && { opacity: 0.7 }]}>{action.label}</RNText>}
        </Pressable>
      ) : null}
    </View>
  );
}

const noticeStyles = ({ a }: GlassState) => ({
  box: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  icon: { marginTop: 2 },
  text: { ...font(11.5, 400, { lh: 1.5 }), color: T.text3, flex: 1 },
  action: { ...font(12, 700, { lh: 1.45 }), color: a.hi },
});

const SKELETON_RADIUS = { sm: 6, md: 10, lg: RADIUS.card, pill: 999 } as const;

/** 뼈대(불러오는 중) — 흰 .06 판이 천천히 깜빡인다 */
export function Skeleton({ width = '100%', height, radius = 'md', style }: SkeletonProps) {
  const v = useSharedValue(1);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const ease = { duration: 700, easing: Easing.inOut(Easing.ease) };
    v.value = withRepeat(withSequence(withTiming(0.45, ease), withTiming(1, ease)), -1, false);
  }, [reduced, v]);
  const blink = useAnimatedStyle(() => ({ opacity: v.value }));
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: SKELETON_RADIUS[radius], backgroundColor: 'rgba(255, 255, 255, 0.06)' },
        blink,
        style,
      ]}
    />
  );
}

// ── 막대 목록(웹 BarList) ──────────────────────────────────────────────────────────────────────────────

/** 항목별 개수 — 이름 · 값(단위·몫%) 한 줄 아래 6px 막대(#3a9ae6). 계산은 part-data barListRows(웹과 같은 숫자) */
export function BarList({ items, unit = '건', limit = 6, empty = '자료가 없어요', style }: BarListProps) {
  const s = useStyles(barStyles);
  const rows = barListRows(items, limit);
  if (rows.length === 0)
    return (
      <View style={style}>
        <RNText style={s.empty}>{empty}</RNText>
      </View>
    );
  return (
    <View style={[s.list, style]}>
      {rows.map(row => (
        <View key={row.key} accessible accessibilityLabel={`${row.label} ${row.valueText}${unit}`}>
          <View style={s.head}>
            <RNText style={s.label} numberOfLines={1}>
              {row.label}
            </RNText>
            <RNText style={s.value}>
              {row.valueText}
              <RNText style={s.unit}>{unit}</RNText>
            </RNText>
            <RNText style={s.share}>{row.shareText}</RNText>
          </View>
          <View style={s.track}>
            <View style={[s.fill, { width: `${row.ratio * 100}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const barStyles = () => ({
  list: { gap: 12 },
  head: { flexDirection: 'row' as const, alignItems: 'baseline' as const, gap: 10, marginBottom: 6 },
  label: { ...font(12.5), color: T.text2, flex: 1, minWidth: 0 },
  value: { ...font(12.5, 600), ...TABULAR, color: T.text1 },
  unit: { ...font(11, 500), color: T.text3 },
  share: { ...font(11, 500), ...TABULAR, color: T.text4, minWidth: 34, textAlign: 'right' as const },
  track: { height: 6, borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.05)', overflow: 'hidden' as const },
  fill: { height: 6, borderRadius: 999, backgroundColor: T.series },
  empty: { ...font(12.5), color: T.text3, textAlign: 'center' as const, paddingVertical: 18 },
});

/** 공용 빈 글(웹 .bar-list__empty) */
export function EmptyText({ text }: { text: string }) {
  return <RNText style={emptyText.text}>{text}</RNText>;
}

const emptyText = StyleSheet.create({
  text: { ...font(12.5), color: T.text3, textAlign: 'center', paddingVertical: 18 },
});

/** 강조색 알약 모양 작은 글(웹 .team-member__name span "나", .field__badge) */
export function AccentTag({ label, accent, hi }: { label: string; accent: string; hi: string }) {
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: alpha(accent, 0.16) }}>
      <RNText style={[font(10.5, 700), { color: hi }]}>{label}</RNText>
    </View>
  );
}

export { TONE };

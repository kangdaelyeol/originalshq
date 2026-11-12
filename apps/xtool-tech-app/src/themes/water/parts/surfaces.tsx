import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
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
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react-native';
import {
  avatarFill,
  avatarRim,
  colorFill,
  darkFill,
  shadow,
  springConfig,
  W,
  W_TINT,
  WATER_REVEAL,
  WATER_SPRING,
} from '../theme';
import { useWater } from '../theme-context';
import { SvgBead } from './bead';
import { WFlag, type WTone } from './controls';
import { InCard } from './context';
import { Glass, Groove, Solid } from './glass';
import { WText, type WTextProps } from './text';

// 물 판·숫자·빈 상태·막대·아바타(웹 ohq-ui/water/surfaces·charts·controls/avatar). 판은 그림자 목록으로 한 번 칠하고
// 다시 칠하지 않는다 — 움직이는 것(숫자 띠·빛·막대 채움)은 transform·opacity만.

const FILL = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 } as const;

// ── 차례로 나타나기 ──────────────────────────────────────────────────────────────

/** D7 펼침 — 항목이 21ms 간격으로 55ms 동안 진해진다(열두째부터는 같이) */
export function Reveal({
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
      Math.min(index, 12) * WATER_REVEAL.stagger * 1000,
      withTiming(1, { duration: WATER_REVEAL.fade * 1000, easing: Easing.linear }),
    );
    // 붙을 때 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[anim, style]}>{children}</Animated.View>;
}

// ── 유리 판 ───────────────────────────────────────────────────────────────────

/** 판 그림자 높이 — low(기본 0.3): 카드 사이 틈 안에서 사라진다 · raised(0.55): 홀로 선 판 · flat(0): 판 안의 판 */
export type WLift = 'flat' | 'low' | 'raised';
const LIFT: Record<WLift, number> = { flat: 0, low: 0.3, raised: 0.55 };

const SHEEN_EASE = Easing.bezierFn(0.45, 0, 0.55, 1);

/** 불러오는 중 — 유리 위로 사선 빛 한 줄(판 폭 60% 띠가 2.2초마다 앞 64% 동안 가로지른다) */
export function Sheen({ radius }: { radius: number }) {
  const [w, setW] = useState(0);
  const t = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.linear }), -1);
  }, [t, reduced]);
  const band = useAnimatedStyle(() => {
    const m = Math.min(1, t.value / 0.64);
    return { transform: [{ translateX: SHEEN_EASE(m) * w * 1.6 }] };
  });
  if (reduced) return null;
  return (
    <View
      pointerEvents="none"
      style={[FILL, styles.clip, { borderRadius: radius }]}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.sheen, { width: w * 0.6, left: -w * 0.6 }, band]} />
    </View>
  );
}

export interface WCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  titleSize?: 'md' | 'lg';
  lift?: WLift;
  busy?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** 물 유리 판(D7) — 거의 투명한 몸 + 테두리·그림자. 제목·부제·오른쪽 할 일 자리 */
export function WCard({
  title,
  subtitle,
  actions,
  titleSize = 'md',
  lift = 'low',
  busy = false,
  children,
  style,
}: WCardProps) {
  return (
    <Glass radius={22} k={1} lift={LIFT[lift]} style={[styles.card, style]} accessibilityState={{ busy }}>
      <InCard.Provider value>
        {busy && <Sheen radius={22} />}
        {(title || actions) && (
          <View style={styles.cardHeader}>
            <View style={styles.flexShrink}>
              {title ? (
                typeof title === 'string' ? (
                  <WText
                    size={titleSize === 'lg' ? 17 : 15}
                    weight={titleSize === 'lg' ? '700' : '600'}
                    em={-0.01}
                    lh={1.4}
                    accessibilityRole="header"
                  >
                    {title}
                  </WText>
                ) : (
                  title
                )
              ) : null}
              {subtitle ? (
                typeof subtitle === 'string' ? (
                  <WText size={12} color={W.ink2} style={styles.subtitle}>
                    {subtitle}
                  </WText>
                ) : (
                  subtitle
                )
              ) : null}
            </View>
            {actions ? <View style={styles.cardActions}>{actions}</View> : null}
          </View>
        )}
        {children}
      </InCard.Provider>
    </Glass>
  );
}

// ── 굴리는 숫자 ───────────────────────────────────────────────────────────────

type RollToken = { kind: 'text'; key: string; text: string } | { kind: 'digit'; key: string; digit: number };
interface RollMove {
  key: string;
  from: number;
  digit: number;
}
interface RollPlan {
  tokens: RollToken[];
  moves: RollMove[];
  up: boolean;
}

const ROLL_CELL = 1.15;
const REST = 20;
const ROLL_STRIP = Array.from({ length: 50 }, (_, i) => i % 10).join('\n');
const NUMBER = /-?\d[\d,]*(?:\.\d+)?/;

/** 값 글자 → 칸(정수 자리는 일의 자리부터 i0·i1…, 소수 자리는 f0·f1…) — 웹 roll.ts와 같다 */
function rollTokens(text: string): RollToken[] {
  const m = NUMBER.exec(text);
  if (!m) return [{ kind: 'text', key: 'all', text }];
  const tokens: RollToken[] = [];
  const head = text.slice(0, m.index);
  const tail = text.slice(m.index + m[0].length);
  if (head) tokens.push({ kind: 'text', key: 'head', text: head });
  const [int, frac] = m[0].split('.');
  let place = int.replace(/\D/g, '').length;
  for (const ch of int) {
    if (ch >= '0' && ch <= '9') {
      place -= 1;
      tokens.push({ kind: 'digit', key: `i${place}`, digit: Number(ch) });
    } else tokens.push({ kind: 'text', key: ch === '-' ? 'minus' : `sep${place}`, text: ch });
  }
  if (frac !== undefined) {
    tokens.push({ kind: 'text', key: 'dot', text: '.' });
    for (let k = 0; k < frac.length; k++) tokens.push({ kind: 'digit', key: `f${k}`, digit: Number(frac[k]) });
  }
  if (tail) tokens.push({ kind: 'text', key: 'tail', text: tail });
  return tokens;
}

const rollValue = (text: string): number | null => {
  const m = NUMBER.exec(text);
  return m ? Number(m[0].replace(/,/g, '')) : null;
};

function planRoll(prev: string, next: string): RollPlan | null {
  const a = rollValue(prev);
  const b = rollValue(next);
  if (a === null || b === null || prev === next) return null;
  const old = new Map<string, number>();
  for (const t of rollTokens(prev)) if (t.kind === 'digit') old.set(t.key, t.digit);
  const tokens = rollTokens(next);
  const moves: RollMove[] = [];
  for (const t of tokens) {
    if (t.kind !== 'digit') continue;
    const from = old.get(t.key) ?? 0;
    if (from === t.digit) continue;
    moves.push({ key: t.key, from, digit: t.digit });
  }
  return moves.length ? { tokens, moves, up: b >= a } : null;
}

function rollTarget(x: number, digit: number, up: boolean): number {
  let t = REST + digit;
  if (up && t < x - 1e-3) t += 10;
  if (!up && t > x + 1e-3) t -= 10;
  return t;
}

/**
 * 숫자 굴림(오도미터) — 값이 바뀌면 바뀐 숫자 칸만 띠를 굴린다(표시 알약 스프링 ζ0.65·ω30.5, 왼쪽 칸부터 21ms 간격).
 * 쉬는 동안은 그냥 글자이고 굴리는 동안만 칸을 그린다. 동작 줄이기면 바로 바꾼다.
 */
export function WNumber({ value, ...text }: { value: string | number } & Omit<WTextProps, 'children'>) {
  const str = String(value);
  const reduced = useReducedMotion();
  const [prev, setPrev] = useState(str);
  const [plan, setPlan] = useState<RollPlan | null>(null);
  if (str !== prev) {
    setPrev(str);
    setPlan(reduced ? null : planRoll(prev, str));
  }
  if (!plan) return <WText {...text}>{str}</WText>;
  const size = text.size ?? 13;
  const cell = size * ROLL_CELL;
  let pending = plan.moves.length;
  const done = () => {
    pending -= 1;
    if (pending === 0) setPlan(null);
  };
  const order = new Map(plan.moves.map((m, i) => [m.key, { move: m, i }]));
  return (
    <View style={styles.rollRow} accessibilityLabel={str}>
      {plan.tokens.map(t => {
        if (t.kind === 'text') {
          return (
            <WText key={t.key} {...text} style={[text.style, { lineHeight: cell }]}>
              {t.text}
            </WText>
          );
        }
        const m = order.get(t.key);
        if (!m) {
          return (
            <WText key={t.key} {...text} style={[text.style, { lineHeight: cell }]}>
              {t.digit}
            </WText>
          );
        }
        return (
          <RollColumn
            key={`${t.key}:${str}`}
            from={REST + m.move.from}
            to={rollTarget(REST + m.move.from, m.move.digit, plan.up)}
            delay={m.i * WATER_REVEAL.stagger}
            digit={t.digit}
            cell={cell}
            text={text}
            onDone={done}
          />
        );
      })}
    </View>
  );
}

function RollColumn({
  from,
  to,
  delay,
  digit,
  cell,
  text,
  onDone,
}: {
  from: number;
  to: number;
  delay: number;
  digit: number;
  cell: number;
  text: Omit<WTextProps, 'children'>;
  onDone: () => void;
}) {
  const x = useSharedValue(from);
  useEffect(() => {
    x.value = withDelay(
      delay * 1000,
      withSpring(to, springConfig(WATER_SPRING.indicator), finished => {
        if (finished) runOnJS(onDone)();
      }),
    );
    // 붙을 때 한 번(값이 다시 바뀌면 새 칸으로 다시 붙는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const strip = useAnimatedStyle(() => ({ transform: [{ translateY: -x.value * cell }] }));
  return (
    <View style={[styles.rollCol, { height: cell }]}>
      <WText {...text} style={[text.style, styles.hidden, { lineHeight: cell }]}>
        {digit}
      </WText>
      <Animated.View style={[styles.rollStrip, strip]}>
        <WText {...text} align="center" style={[text.style, { lineHeight: cell }]}>
          {ROLL_STRIP}
        </WText>
      </Animated.View>
    </View>
  );
}

// ── 숫자 카드 ─────────────────────────────────────────────────────────────────

export type WTint = keyof typeof W_TINT;

export interface WStatCardProps {
  title: string;
  value: string;
  icon?: LucideIcon;
  tint?: WTint;
  delta?: { value: string; direction: 'up' | 'down'; good: boolean };
  tag?: { label: string; tone: WTone };
  caption?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * 숫자 카드(D7) — 유리 판 위에 제목·아이콘 / 큰 값 / 증감·태그·설명. 값이 바뀌면 바뀐 숫자 칸만 굴러간다. 아이콘은 D7
 * 불투명 유리 단추(지름 36, k 0.3) 속 아이콘(tint 색 — 장식).
 */
export function WStatCard({ title, value, icon: Icon, tint = 'blue', delta, tag, caption, style }: WStatCardProps) {
  return (
    <Glass radius={22} k={1} lift={0.3} style={[styles.stat, style]}>
      <View style={styles.statHead}>
        <WText size={12.5} weight="500" color={W.ink2} style={styles.statTitle} numberOfLines={2}>
          {title}
        </WText>
        {Icon && (
          <Solid k={0.3} radius={18} style={styles.statIcon}>
            <Icon size={16} strokeWidth={2} color={W_TINT[tint]} />
          </Solid>
        )}
      </View>
      <WNumber value={value} size={28} weight="700" em={-0.025} lh={1.15} style={styles.statValue} />
      {(delta || tag || caption) && (
        <View style={styles.statFoot}>
          {delta && (
            <View style={styles.delta}>
              {delta.direction === 'up' ? (
                <ArrowUpRight size={12} strokeWidth={2.6} color={delta.good ? W.ok : W.crit} />
              ) : (
                <ArrowDownRight size={12} strokeWidth={2.6} color={delta.good ? W.ok : W.crit} />
              )}
              <WText size={11} weight="600" tabular>
                {delta.value}
              </WText>
            </View>
          )}
          {tag && <WFlag tone={tag.tone}>{tag.label}</WFlag>}
          {caption ? (
            <WText size={11.5} color={W.ink2}>
              {caption}
            </WText>
          ) : null}
        </View>
      )}
    </Glass>
  );
}

// ── 빈 상태 ───────────────────────────────────────────────────────────────────

/** 빈 상태(D7) — sm: 물방울 한 알 + 한 줄 · md: 불투명 유리 우물 속 흰 아이콘(없으면 물방울)과 제목·설명·할 일 */
export function WEmpty({
  title,
  description,
  icon: Icon,
  action,
  size = 'sm',
  iconColor = '#ffffff',
  style,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  /** 우물 속 아이콘 색 — 기본 흰색, 오류는 위험 색 */
  iconColor?: string;
  action?: ReactNode;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}) {
  if (size === 'sm') {
    return (
      <View style={[styles.emptySm, style]}>
        <SvgBead size={13} />
        <WText size={12.5} color={W.ink2}>
          {title}
        </WText>
      </View>
    );
  }
  return (
    <View style={[styles.emptyMd, style]}>
      <View style={styles.wellShadow}>
        <Solid k={0.46} radius={28} style={styles.well}>
          {Icon ? (
            <View style={styles.iconShadow}>
              <Icon size={24} strokeWidth={2} color={iconColor} />
            </View>
          ) : (
            <SvgBead size={26} />
          )}
        </Solid>
      </View>
      <WText size={15} weight="600" style={styles.center}>
        {title}
      </WText>
      {description ? (
        <WText size={12.5} color={W.ink2} lh={1.55} style={[styles.center, styles.emptyText]}>
          {description}
        </WText>
      ) : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

// ── 불러오는 중 ───────────────────────────────────────────────────────────────

const SKEL = {
  line: { h: 10, k: 0.43 },
  title: { h: 16, k: 0.7 },
  circle: { h: 24, k: 1 },
  pill: { h: 22, k: 0.96 },
  block: { h: 12, k: 0.8 },
} as const;

/** 내용이 올 자리 — 유리에 파인 빈 홈(글 한 줄 10 · 제목 16 · 사람 24 · 칩 22 · 블록) */
export function WSkel({
  shape = 'line',
  width,
  height,
  style,
}: {
  shape?: keyof typeof SKEL;
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const s = SKEL[shape];
  const h = height ?? s.h;
  const radius = shape === 'block' ? 12 : h / 2;
  const w = width ?? (shape === 'circle' ? h : '100%');
  return <Groove k={s.k} radius={radius} style={[{ width: w, height: h }, style]} />;
}

// ── 막대 ─────────────────────────────────────────────────────────────────────

/**
 * 막대 하나(D7) — 유리에 파인 홈 안의 어두운 알약 채움. 처음 나타날 때·값이 바뀔 때 끝이 extend 스프링으로 뻗는다
 * (16% 넘쳤다 돌아옴, 차례마다 21ms 늦게). 채움은 홈의 두 배 길이 알약을 옮기기만 한다(끝이 찌그러지지 않는다).
 */
export function WBar({
  value,
  index = 0,
  color,
  size = 'md',
  style,
}: {
  value: number;
  index?: number;
  color?: string;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}) {
  const p = useWater();
  const reduced = useReducedMotion();
  const h = size === 'sm' ? 10 : 12;
  const [clipW, setClipW] = useState(0);
  const tip = useSharedValue(0);
  const target = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  useEffect(() => {
    if (reduced) {
      tip.value = target;
      return;
    }
    tip.value = withDelay(
      Math.min(index, 12) * WATER_REVEAL.stagger * 1000,
      withSpring(target, springConfig(WATER_SPRING.extend)),
    );
  }, [target, index, reduced, tip]);
  const fill = useAnimatedStyle(() => ({ transform: [{ translateX: (tip.value - 2) * clipW }] }));
  return (
    <Groove k={size === 'sm' ? 0.43 : 0.52} radius={h / 2} style={[{ height: h }, style]}>
      <View style={styles.barClip} onLayout={e => setClipW(e.nativeEvent.layout.width)}>
        <Animated.View
          style={[styles.barFill, { width: clipW * 2, backgroundImage: color ? colorFill(color) : darkFill(p) }, fill]}
        />
      </View>
    </Groove>
  );
}

/**
 * 항목별 개수(D7) — 이름 · 값 한 줄 아래 홈 막대. 한 계열이라 어두운 알약 하나, "기타"만 무채 회색. 막대는 위에서부터
 * 21ms 간격으로 차오르고 글자 줄은 같은 간격으로 55ms 동안 진해진다.
 */
export function WBarList({
  items,
  unit = '건',
  limit = 6,
  empty = '자료가 없어요',
}: {
  items: readonly { key: string; label: string; value: number }[];
  unit?: string;
  limit?: number;
  empty?: string;
}) {
  const shown = useMemo(() => {
    const sorted = [...items].filter(item => item.value > 0).sort((a, b) => b.value - a.value);
    return sorted.length > limit
      ? [
          ...sorted.slice(0, limit - 1),
          { key: '__other', label: '기타', value: sorted.slice(limit - 1).reduce((sum, item) => sum + item.value, 0) },
        ]
      : sorted;
  }, [items, limit]);
  if (shown.length === 0) return <WEmpty title={empty} />;
  const max = Math.max(1, ...shown.map(item => item.value));
  const total = shown.reduce((sum, item) => sum + item.value, 0);
  return (
    <View style={styles.barList}>
      {shown.map((item, i) => (
        <Reveal key={item.key} index={i}>
          <View style={styles.barHead}>
            <WText size={12.5} weight="500" numberOfLines={1} style={styles.flex}>
              {item.label}
            </WText>
            <WText size={12.5} weight="700" tabular>
              {item.value.toLocaleString('ko-KR')}
              <WText size={11} weight="500" color={W.ink2}>
                {`\u200a${unit}`}
              </WText>
            </WText>
            <WText size={11} weight="500" color={W.ink2} tabular style={styles.share}>
              {Math.round((item.value / total) * 100)}%
            </WText>
          </View>
          <WBar value={item.value / max} index={i} color={item.key === '__other' ? W.other : undefined} />
        </Reveal>
      ))}
    </View>
  );
}

// ── 아바타 ─────────────────────────────────────────────────────────────────────

const AVATAR = { xs: { d: 20, font: 8 }, sm: { d: 32, font: 11 }, md: { d: 38, font: 13 } } as const;

/** 물 아바타 — 사람 색이 물든 유리 구슬 + 그림자 진 흰 이니셜. 사진이면 사진 위에 같은 유리 테두리. 그림자·테두리 겹이
 * 여섯이라 줄마다 쌓이면 무거워 구슬 전체를 한 장으로 캐시한다 */
export function WAvatar({
  initials,
  color,
  size = 'sm',
  photo,
  ring,
  style,
}: {
  initials: string;
  color: string;
  size?: keyof typeof AVATAR | number;
  photo?: string;
  /** 겹칠 때 두르는 테(담당자 겹침 — 밝은 테, 고른 줄 위 — 어두운 테) */
  ring?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const a = typeof size === 'number' ? { d: size, font: Math.round(size * 0.34) } : AVATAR[size];
  const r = a.d / 2;
  return (
    <View
      shouldRasterizeIOS
      style={[
        {
          width: a.d,
          height: a.d,
          borderRadius: r,
          boxShadow: ring
            ? [shadow(0, 0, 0, 1.5, ring), shadow(0, 2, 5, 0, 'rgba(0, 0, 0, 0.2)')]
            : [shadow(0, 2, 5, 0, 'rgba(0, 0, 0, 0.2)')],
        },
        styles.center,
        style,
      ]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={[FILL, styles.photo, { borderRadius: r }]} />
      ) : (
        <View style={[FILL, { borderRadius: r, backgroundImage: avatarFill(color) }]} />
      )}
      {!photo && (
        <WText size={a.font} weight="700" em={-0.02} onDark>
          {initials}
        </WText>
      )}
      <View pointerEvents="none" style={[FILL, { borderRadius: r, boxShadow: avatarRim(a.d) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  center: { alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  hidden: { opacity: 0 },
  photo: { backgroundColor: W.photoBack },
  clip: { overflow: 'hidden' },
  card: { paddingTop: 22, paddingHorizontal: 24, paddingBottom: 24 },
  cardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    rowGap: 12,
    columnGap: 16,
    marginBottom: 18,
  },
  subtitle: { marginTop: 3 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  sheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundImage: 'linear-gradient(105deg, transparent 18%, rgba(255, 255, 255, 0.22) 50%, transparent 82%)',
  },
  stat: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20 },
  statHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, minHeight: 36 },
  statTitle: { flexShrink: 1, paddingTop: 2 },
  statIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  statValue: { marginTop: 8 },
  statFoot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, minHeight: 22, marginTop: 14 },
  delta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 22,
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: 11,
    backgroundColor: W.chip,
  },
  rollRow: { flexDirection: 'row', alignItems: 'flex-end' },
  rollCol: { overflow: 'hidden' },
  rollStrip: { position: 'absolute', left: -20, right: -20, top: 0, alignItems: 'center' },
  emptySm: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 },
  emptyMd: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 20 },
  // 떠 있는 그림자(D7 유리 그림자 × 0.23)
  wellShadow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 8,
    boxShadow: [
      { offsetX: 4.8, offsetY: 10.1, blurRadius: 8.3, spreadDistance: 4.6, color: 'rgba(0, 0, 0, 0.13)' },
      { offsetX: 0, offsetY: 0, blurRadius: 5.5, color: 'rgba(0, 0, 0, 0.06)' },
    ],
  },
  well: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  iconShadow: { shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 1, shadowOffset: { width: 0, height: 1 } },
  emptyText: { maxWidth: 380 },
  emptyAction: { marginTop: 6 },
  barClip: { position: 'absolute', left: 2, top: 2, right: 2, bottom: 2, overflow: 'hidden', borderRadius: 999 },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999 },
  barList: { gap: 13 },
  barHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 7 },
  share: { minWidth: 34, marginLeft: -2, textAlign: 'right' },
});

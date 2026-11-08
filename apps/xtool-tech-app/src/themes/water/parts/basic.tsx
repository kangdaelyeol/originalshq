import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { ChevronDown, X } from 'lucide-react-native';
import { avatarView, barListRows } from '../../../features/dashboard/part-data';
import type {
  AvatarProps,
  AvatarStackProps,
  BarListProps,
  ButtonProps,
  CardProps,
  ChipProps,
  IconButtonProps,
  IconProps,
  KpiGridProps,
  SegmentedProps,
  StatCardProps,
  StatusPillProps,
  TextProps,
  TextTone,
  TextVariant,
} from '../../dashboard/parts';
import { DANGER_ICON_FILL, darkChipFill, shadow, springConfig, W, WATER_SPRING, type WWeight } from '../theme';
import { useWater } from '../theme-context';
import { WButton, WChips, WIconButton, WPill, usePressWobble } from './controls';
import { InCard } from './context';
import { Glass } from './glass';
import { Spin } from './screen';
import { WSegmented } from './segmented';
import { Reveal, Sheen, WAvatar, WBar, WEmpty, WSkel, WStatCard } from './surfaces';
import { WText } from './text';

// 물 기본 부품(계약 기본 — 웹 basic-parts의 물 쪽: WaterCard·WaterStatCard·WaterAvatar·WaterButton·WaterSegmented·
// WaterStatusPill·WaterBarList). 글자색은 밝은 벽 위 잉크, 상태 글자는 벽 위 4.5:1이 되게 한 단계 진한 색(웹 물 화면
// 토큰 --good·--warn·--crit·--info).

const FILL = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 } as const;

/** 글자 변형 — 웹 물 카드·목록 글자 값 */
const VARIANT: Record<TextVariant, { size: number; weight: WWeight; em?: number; lh?: number; tabular?: boolean }> = {
  title: { size: 17, weight: '700', em: -0.01, lh: 1.35 },
  heading: { size: 15, weight: '600', em: -0.01, lh: 1.4 },
  body: { size: 13, weight: '500', lh: 1.45 },
  strong: { size: 13, weight: '600', lh: 1.4 },
  small: { size: 11.5, weight: '500', lh: 1.35 },
  caption: { size: 12, weight: '500', lh: 1.35 },
  label: { size: 13, weight: '500', lh: 1.45 },
  number: { size: 28, weight: '700', em: -0.025, lh: 1.15, tabular: true },
};

/** 글자 색 — 상태 글자는 물 화면 토큰(밝은 벽 위 4.5:1) */
export function textColor(tone: TextTone | undefined, variant: TextVariant = 'body'): string {
  switch (tone) {
    case 'muted':
      return W.ink2;
    case 'accent':
      return W.ink;
    case 'good':
      return W.pageGood;
    case 'warn':
      return W.pageWarn;
    case 'crit':
      return W.pageCrit;
    case 'info':
      return W.pageInfo;
    case 'neutral':
      return W.ink2;
    default:
      return variant === 'label' || variant === 'small' || variant === 'caption' ? W.ink2 : W.ink;
  }
}

/** 아이콘 색 — 점·아이콘은 상태 점 색을 그대로 쓴다(글자가 아니라서) */
function iconColor(tone: TextTone | undefined): string {
  switch (tone) {
    case 'muted':
      return W.ink3;
    case 'good':
      return W.ok;
    case 'warn':
      return W.warn;
    case 'crit':
      return W.crit;
    case 'info':
      return W.info;
    case 'neutral':
      return W.ink3;
    default:
      return W.ink2;
  }
}

export function Text({
  variant = 'body',
  tone,
  numberOfLines,
  align,
  selectable,
  onPress,
  style,
  children,
}: TextProps) {
  const v = VARIANT[variant];
  return (
    <WText
      size={v.size}
      weight={tone === 'accent' && variant !== 'number' ? '700' : v.weight}
      em={v.em}
      lh={v.lh}
      tabular={v.tabular}
      color={textColor(tone, variant)}
      numberOfLines={numberOfLines}
      align={align}
      selectable={selectable}
      onPress={onPress}
      suppressHighlighting
      style={style}
    >
      {children}
    </WText>
  );
}

export function Icon({ icon: I, size = 16, tone }: IconProps) {
  return <I size={size} color={iconColor(tone)} strokeWidth={2} />;
}

// ── 판 ───────────────────────────────────────────────────────────────────────

/** 누르는 판 — 누르는 동안 2px 떠오른다(웹 hover 떠오름 — D7 move 스프링) */
function useLift() {
  const y = useSharedValue(0);
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const move = springConfig(WATER_SPRING.move);
  return {
    style,
    onPressIn: () => {
      if (!reduced) y.value = withSpring(-2, move);
    },
    onPressOut: () => {
      y.value = reduced ? 0 : withSpring(0, move);
    },
  };
}

/** 물 유리 판(WaterCard) — 제목·부제·오른쪽 동작, 머리 아래 도구 줄, 내용. lift 0.3(카드 사이 틈 안에서 그림자가 사라진다) */
export function Card({ title, subtitle, actions, toolbar, padded = true, onPress, children, style }: CardProps) {
  const lift = useLift();
  const hasHead = !!(title || actions);
  const hasBody = Children.count(children) > 0;
  const content = (
    <Glass radius={22} k={1} lift={0.3} style={styles.card}>
      <InCard.Provider value>
        {hasHead && (
          <View style={[styles.cardHead, toolbar || hasBody ? styles.cardHeadGap : null]}>
            <View style={styles.flexShrink}>
              {title ? (
                <WText size={15} weight="600" em={-0.01} lh={1.4} accessibilityRole="header">
                  {title}
                </WText>
              ) : null}
              {subtitle ? (
                <WText size={12} color={W.ink2} style={styles.subtitle}>
                  {subtitle}
                </WText>
              ) : null}
            </View>
            {actions ? <View style={styles.cardActions}>{actions}</View> : null}
          </View>
        )}
        {!hasHead && subtitle ? (
          <WText size={12} color={W.ink2} style={[styles.cardPad, styles.cardHeadGap]}>
            {subtitle}
          </WText>
        ) : null}
        {toolbar ? <View style={[styles.cardPad, hasBody && styles.toolbarGap]}>{toolbar}</View> : null}
        {hasBody ? (
          padded ? (
            <View style={styles.cardBody}>{children}</View>
          ) : (
            <View style={styles.cardList}>{withRules(children)}</View>
          )
        ) : null}
        {!hasBody && !toolbar ? <View style={styles.cardEnd} /> : null}
      </InCard.Provider>
    </Glass>
  );
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Animated.View style={[lift.style, style]}>
      <Pressable accessibilityRole="button" onPress={onPress} onPressIn={lift.onPressIn} onPressOut={lift.onPressOut}>
        {content}
      </Pressable>
    </Animated.View>
  );
}

/** 판 안 줄 목록 — 줄 사이에 가는 선(물 화면 --line, 웹 my-work__row + border-top) */
function withRules(children: ReactNode) {
  const list = Children.toArray(children);
  return list.map((child, i) =>
    i === 0 ? (
      child
    ) : (
      <Fragment key={`rule-${i}`}>
        <View style={styles.listRule} />
        {child}
      </Fragment>
    ),
  );
}

/** 숫자 카드(WaterStatCard) — 누를 수 있으면 누르는 동안 2px 떠오른다 */
export function StatCard({ title, value, icon, tint, caption, tag, onPress, style }: StatCardProps) {
  const lift = useLift();
  const card = (
    <WStatCard
      title={title}
      value={value}
      icon={icon}
      tint={tint}
      caption={caption}
      tag={tag ? { label: tag.label, tone: tag.tone } : undefined}
    />
  );
  if (!onPress) return <View style={style}>{card}</View>;
  return (
    <Animated.View style={[lift.style, style]}>
      <Pressable accessibilityRole="button" onPress={onPress} onPressIn={lift.onPressIn} onPressOut={lift.onPressOut}>
        {card}
      </Pressable>
    </Animated.View>
  );
}

/** 불러오는 중 숫자 카드 — 빈 홈 + 유리 위 빛(웹 water-skeleton stat) */
function StatPlaceholder() {
  return (
    <Glass radius={22} k={1} lift={0.3} style={styles.statSkel} accessibilityState={{ busy: true }}>
      <Sheen radius={22} />
      <View style={styles.skelRow}>
        <WSkel width="42%" />
        <WSkel shape="circle" width={36} height={36} />
      </View>
      <WSkel shape="block" width="46%" height={26} />
      <WSkel width="30%" />
    </Glass>
  );
}

/** 숫자 카드 묶음 — 폰은 두 칸씩, 카드는 21ms 간격으로 진해진다 */
export function KpiGrid({ items, placeholders = 4, style }: KpiGridProps) {
  const cells: ReactNode[] = items
    ? items.map((item, i) => (
        <Reveal key={item.key} index={i} style={styles.kpiCell}>
          <StatCard {...item} />
        </Reveal>
      ))
    : Array.from({ length: placeholders }, (_, i) => (
        <View key={i} style={styles.kpiCell}>
          <StatPlaceholder />
        </View>
      ));
  const rows: ReactNode[][] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));
  return (
    <View style={[styles.kpi, style]}>
      {rows.map((row, i) => (
        <View key={i} style={styles.kpiRow}>
          {row}
          {row.length === 1 ? <View style={styles.kpiCell} /> : null}
        </View>
      ))}
    </View>
  );
}

// ── 사람 ─────────────────────────────────────────────────────────────────────

const AVATAR_SIZE = { xs: 20, sm: 32, md: 38, lg: 52 } as const;

/** 아바타 — 사람 색이 물든 유리 구슬. "나"는 잉크(강조색을 고르면 그 어두운 단계) */
export function Avatar({ name, size = 'sm', highlight, photo, style }: AvatarProps) {
  const p = useWater();
  const v = avatarView(name);
  const color = highlight ? (p.settings.accent ? p.dark1 : W.ink) : v.color;
  const d = AVATAR_SIZE[size];
  return (
    <WAvatar
      initials={v.initials}
      color={color}
      size={size === 'lg' ? d : size}
      photo={photo ?? undefined}
      style={style}
    />
  );
}

/** 아바타 겹침 — 밝은 테로 가르고, 넘치면 "+N" 흰 칩(웹 water-assignees) */
export function AvatarStack({ names, max = 3, size = 'xs', style }: AvatarStackProps) {
  if (names.length === 0) {
    return (
      <WText size={11} weight="600" color={W.ink3} style={style}>
        —
      </WText>
    );
  }
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <View style={[styles.stack, style]} accessibilityLabel={names.join(', ')}>
      <View style={styles.stackFaces}>
        {shown.map((name, i) => {
          const v = avatarView(name);
          return (
            <WAvatar
              key={name}
              initials={v.initials}
              color={v.color}
              size={size}
              ring="rgba(231, 229, 234, 0.92)"
              style={i > 0 ? styles.stackOverlap : null}
            />
          );
        })}
      </View>
      {rest > 0 ? (
        <View style={styles.more}>
          <WText size={10.5} weight="700" color={W.ink2}>
            +{rest}
          </WText>
        </View>
      ) : null}
    </View>
  );
}

// ── 단추 ─────────────────────────────────────────────────────────────────────

/** 단추 — primary: 어두운 알약 · secondary: 반투명 흰 칩 · plain: 밑줄 글자 · danger: 붉은 알약 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconAfter,
  disabled,
  loading,
  block,
  style,
}: ButtonProps) {
  if (variant === 'plain') {
    const font = size === 'sm' ? 12.5 : 13.5;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled || loading}
        onPress={onPress}
        hitSlop={6}
        style={[styles.plain, block && styles.plainBlock, disabled && styles.dim, style]}
      >
        {({ pressed }) => (
          <>
            {loading ? <Spin size={14} /> : null}
            {icon && !iconAfter && !loading ? <Icon icon={icon} size={14} /> : null}
            <WText size={font} weight="600" color={pressed ? W.ink : W.ink2} style={styles.underline}>
              {label}
            </WText>
            {icon && iconAfter && !loading ? <Icon icon={icon} size={14} /> : null}
          </>
        )}
      </Pressable>
    );
  }
  return (
    <WButton
      variant={variant === 'secondary' ? 'ghost' : variant}
      size={size}
      icon={icon}
      iconAfter={iconAfter}
      disabled={disabled}
      loading={loading}
      block={block}
      onPress={onPress}
      accessibilityLabel={label}
      style={style}
    >
      {label}
    </WButton>
  );
}

/** 아이콘 단추 — soft: 불투명 유리 원(D7 접힌 버튼, 흰 아이콘) · plain: 바탕 없이(누르면 흰 칩) */
export function IconButton({
  icon,
  label,
  onPress,
  variant = 'plain',
  tone = 'default',
  badge,
  disabled,
  style,
}: IconButtonProps) {
  const p = useWater();
  const press = usePressWobble(0.95);
  const badgeEl =
    badge && badge > 0 ? (
      <View pointerEvents="none" style={styles.badge}>
        <View style={[FILL, styles.badgeFill, { backgroundImage: darkChipFill(p) }]} />
        <WText size={9.5} weight="700" onDark tabular>
          {badge > 99 ? '99+' : badge}
        </WText>
      </View>
    ) : null;
  if (variant === 'soft') {
    return (
      <View style={style}>
        {tone === 'danger' ? (
          <Animated.View style={[press.style, disabled && styles.dim]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              disabled={disabled}
              hitSlop={6}
              onPress={onPress}
              onPressIn={press.onPressIn}
              onPressOut={press.onPressOut}
              style={[styles.dangerRound, { backgroundImage: DANGER_ICON_FILL }]}
            >
              <View style={styles.iconShadow}>{createIcon(icon, 15, '#ffffff')}</View>
            </Pressable>
          </Animated.View>
        ) : (
          <WIconButton icon={icon} label={label} size="sm" disabled={disabled} onPress={onPress} />
        )}
        {badgeEl}
      </View>
    );
  }
  return (
    <Animated.View style={[press.style, disabled && styles.dim, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        hitSlop={6}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={styles.plainRound}
      >
        {({ pressed }) => (
          <>
            {pressed ? <View style={[FILL, styles.plainPressed]} /> : null}
            {createIcon(icon, 18, tone === 'danger' ? W.crit : pressed ? W.ink : W.ink2)}
          </>
        )}
      </Pressable>
      {badgeEl}
    </Animated.View>
  );
}

function createIcon(I: IconProps['icon'], size: number, color: string) {
  return <I size={size} color={color} strokeWidth={2} />;
}

// ── 고르기·알약·칩 ─────────────────────────────────────────────────────────────

/** 고르기 줄 — segmented: 유리 알약 속 표시 알약(D7 펼친 메뉴) · chips: 떨어진 칩. scroll이면 가로로 민다 */
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
  const control =
    variant === 'chips' ? (
      <WChips
        options={options}
        value={value}
        onChange={onChange}
        size={size === 'sm' ? 'md' : 'lg'}
        style={scroll ? styles.noWrap : null}
      />
    ) : (
      <WSegmented options={options} value={value} onChange={onChange} size={size} accessibilityLabel={label} />
    );
  if (!scroll) return <View style={style}>{control}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, style]}
      contentContainerStyle={styles.scrollBody}
      accessibilityLabel={label}
    >
      {control}
    </ScrollView>
  );
}

export function StatusPill({ tone, label, dot = true, style }: StatusPillProps) {
  return (
    <WPill tone={tone} dot={dot} style={style}>
      {label}
    </WPill>
  );
}

/**
 * 칩 — 거르기·고르기 단추. 안 고르면 반투명 흰 알약에 회색 글자, 고르면 어두운 알약에 흰 글자(D7 칩). 뒤에 작은 수·
 * 펼침 화살표(시트가 열린다)·풀기(×)
 */
export function Chip({ label, onPress, selected = false, icon: I, count, trailing, onClear, style }: ChipProps) {
  const p = useWater();
  const ink = selected ? '#ffffff' : W.ink2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={[styles.chip, style]}
    >
      {({ pressed }) => (
        <>
          <View style={[FILL, styles.chipFill, { backgroundColor: pressed && !selected ? W.chipHover : W.chip }]} />
          {selected ? <View style={[FILL, styles.chipFill, { backgroundImage: darkChipFill(p) }]} /> : null}
          {I ? <I size={13} color={ink} strokeWidth={2} /> : null}
          <WText size={12} weight="600" color={selected ? '#ffffff' : pressed ? W.ink : W.ink2} numberOfLines={1}>
            {label}
          </WText>
          {count != null ? (
            <WText size={11} weight="700" color={selected ? W.onDark2 : W.ink3} tabular>
              {count}
            </WText>
          ) : null}
          {trailing === 'chevron' ? (
            <ChevronDown size={13} color={selected ? W.onDark2 : W.ink3} strokeWidth={2.4} />
          ) : null}
          {trailing === 'clear' ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`${label} 풀기`} hitSlop={8} onPress={onClear}>
              <X size={13} color={selected ? '#ffffff' : W.ink3} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

/** 항목별 개수(WaterBarList) — 이름 · 값 한 줄 아래 홈 막대(extend 스프링으로 차오름, 21ms 간격) */
export function BarList({ items, unit = '건', limit = 6, empty = '자료가 없어요', style }: BarListProps) {
  const rows = barListRows(items, limit);
  if (rows.length === 0) return <WEmpty title={empty} style={style} />;
  return (
    <View style={[styles.barList, style]}>
      {rows.map((row, i) => (
        <Reveal key={row.key} index={i}>
          <View style={styles.barHead}>
            <WText size={12.5} weight="500" numberOfLines={1} style={styles.flex}>
              {row.label}
            </WText>
            <WText size={12.5} weight="700" tabular>
              {row.valueText}
              <WText size={11} weight="500" color={W.ink2}>
                {` ${unit}`}
              </WText>
            </WText>
            <WText size={11} weight="500" color={W.ink2} tabular align="right" style={styles.share}>
              {row.shareText}
            </WText>
          </View>
          <WBar value={row.ratio} index={i} color={row.key === '__other' ? W.other : undefined} />
        </Reveal>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  dim: { opacity: 0.5 },
  subtitle: { marginTop: 3 },
  card: { paddingTop: 22 },
  cardHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    rowGap: 12,
    columnGap: 16,
    paddingHorizontal: 24,
  },
  cardHeadGap: { marginBottom: 18 },
  cardPad: { paddingHorizontal: 24 },
  toolbarGap: { marginBottom: 16 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  cardBody: { paddingHorizontal: 24, paddingBottom: 24 },
  cardList: { paddingHorizontal: 8, paddingBottom: 10 },
  listRule: { height: 1, marginHorizontal: 10, backgroundColor: W.pageLine },
  cardEnd: { height: 22 },
  statSkel: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  skelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  kpi: { gap: 12 },
  kpiRow: { flexDirection: 'row', gap: 12 },
  kpiCell: { flex: 1, minWidth: 0 },
  stack: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stackFaces: { flexDirection: 'row' },
  stackOverlap: { marginLeft: -5 },
  more: {
    minWidth: 24,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: W.chip,
  },
  plain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  plainBlock: { alignSelf: 'stretch' },
  underline: { textDecorationLine: 'underline', textDecorationColor: W.linkLine },
  plainRound: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  plainPressed: { borderRadius: 17, backgroundColor: W.chip },
  dangerRound: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: [shadow(0, 3, 7, 0, 'rgba(80, 20, 16, 0.26)')],
  },
  iconShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 0.8,
    shadowOffset: { width: 0, height: 0.6 },
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeFill: { borderRadius: 8 },
  noWrap: { flexWrap: 'nowrap' },
  scroll: { flexGrow: 0, marginHorizontal: -4 },
  scrollBody: { paddingHorizontal: 4, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
  },
  chipFill: { borderRadius: 15 },
  barList: { gap: 13 },
  barHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 7 },
  share: { minWidth: 34, marginLeft: -2 },
});

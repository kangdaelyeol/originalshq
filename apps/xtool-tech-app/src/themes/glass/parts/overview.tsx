import { useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Check, ChevronDown, ChevronRight, Crown } from 'lucide-react-native';
import { avatarView, kingCardView, teamCardSubtitle, teamMemberViews } from '../../../features/dashboard/part-data';
import type {
  AttentionRowProps,
  BoardTileProps,
  KingCardProps,
  PersonRowProps,
  ScheduleDayProps,
  TeamCardProps,
  WorkRowProps,
} from '../../dashboard/parts';
import { alpha, font, RADIUS, RAISED, T, TABULAR, TONE, WELL } from '../theme';
import { useGlass, useStyles, type GlassState } from '../theme-context';
import { GlassSurface } from '../glass-surface';
import { Avatar, AvatarBox, StagePill, StatusPill } from './controls';
import { AccentTag, Card, EmptyText, markRow, Section } from './surfaces';
import { Enter } from './text';

// 개요·내 업무·팀원·보드 허브 — 웹 overview/*(attention-row·king-card·team-card·my-work-card·schedule-card)와 팀원 표 줄.

// ── 챙겨야 할 것 ───────────────────────────────────────────────────────────────────────────────────────

/** 챙겨야 할 것(웹 AttentionRow) — 제목 + 두 칸 타일(유리 r18 p14): 이름 12/600 · 수 26/800 · 설명 11. 0건은 흐리게 */
export function AttentionRow({ tiles, loading, onPressTile, style }: AttentionRowProps) {
  const s = useStyles(attentionStyles);
  return (
    <Section title="챙겨야 할 것" style={style}>
      <View style={s.grid}>
        {tiles.map(tile => {
          const zero = tile.count === 0;
          const tone = zero ? null : TONE[tile.tone];
          return (
            <Enter key={tile.id} style={s.cell}>
              <Pressable
                onPress={() => onPressTile(tile)}
                accessibilityRole="button"
                accessibilityLabel={`${tile.label} ${loading ? '' : `${tile.count}건`}`}
                style={({ pressed }) => [s.press, zero && s.zero, pressed && s.pressed]}
              >
                <GlassSurface
                  radius={RADIUS.card}
                  borderColor={
                    zero
                      ? undefined
                      : tile.tone === 'crit'
                      ? 'rgba(248, 113, 113, 0.4)'
                      : tile.tone === 'warn'
                      ? 'rgba(251, 191, 36, 0.32)'
                      : undefined
                  }
                  style={s.tile}
                >
                  <RNText style={s.label} numberOfLines={1}>
                    {tile.label}
                  </RNText>
                  <RNText style={[s.count, tone && { color: tone.color }]}>{loading ? '…' : tile.count}</RNText>
                  <RNText style={s.caption} numberOfLines={2}>
                    {tile.caption}
                  </RNText>
                </GlassSurface>
              </Pressable>
            </Enter>
          );
        })}
      </View>
    </Section>
  );
}

const attentionStyles = () => ({
  grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12 },
  cell: { flexBasis: '46%' as const, flexGrow: 1, minWidth: 0 },
  press: { flex: 1 },
  zero: { opacity: 0.55 },
  pressed: { transform: [{ translateY: -2 }] },
  tile: { flex: 1, gap: 4, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 12 },
  label: { ...font(12, 600), color: T.text2 },
  count: { ...font(26, 800, { lh: 1.1 }), ...TABULAR, color: T.text1 },
  caption: { ...font(11, 400, { lh: 1.4 }), color: T.text4 },
});

// ── 기술팀 왕 ─────────────────────────────────────────────────────────────────────────────────────────

/** 기술팀 왕(웹 KingCard) — 순위 줄(번호·이름·막대·수·갈매기), 누르면 센 기록이 펼쳐진다, 아래 꼬리 글 */
export function KingCard(props: KingCardProps) {
  const s = useStyles(kingStyles);
  const view = kingCardView(props);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card style={props.style}>
      <View style={s.wrap}>
        <RNText style={s.title}>{view.title}</RNText>
        {view.state !== 'ranked' ? (
          <EmptyText text={view.emptyText} />
        ) : (
          <View style={s.rank}>
            {view.rows.map(row => {
              const opened = open === row.name;
              return (
                <View key={row.name}>
                  <Pressable
                    onPress={() => setOpen(opened ? null : row.name)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: opened }}
                    style={({ pressed }) => [s.row, pressed && s.pressed]}
                  >
                    <View style={s.no}>
                      {row.top ? (
                        <Crown size={14} strokeWidth={2} color={T.warn} />
                      ) : (
                        <RNText style={s.noText}>{row.rank}</RNText>
                      )}
                    </View>
                    <RNText style={s.name} numberOfLines={1}>
                      {row.name}
                    </RNText>
                    <View style={s.bar}>
                      <View style={[s.fill, { width: `${row.ratio * 100}%`, opacity: row.top ? 1 : 0.7 }]} />
                    </View>
                    <RNText style={s.count}>{row.countText}</RNText>
                    <Chevron open={opened} />
                  </Pressable>
                  {opened ? (
                    <View style={s.facts}>
                      {row.facts.map(fact => (
                        <RNText key={fact.key} style={s.fact} numberOfLines={1}>
                          <RNText style={s.factWhen}>{fact.when} </RNText>
                          {fact.name}
                        </RNText>
                      ))}
                      {row.moreFacts ? <RNText style={[s.fact, s.factWhen]}>{row.moreFacts}</RNText> : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
        {view.foot.length > 0 ? (
          <View style={s.foot}>
            {view.foot.map((line, i) => (
              <RNText key={`${i}:${line}`} style={s.footText}>
                {line}
              </RNText>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/** 갈매기 — 펼치면 180°(웹 .king-rank__chev 0.2초) */
function Chevron({ open }: { open: boolean }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: 200 }) }],
  }));
  return (
    <Animated.View style={style}>
      <ChevronDown size={14} strokeWidth={2} color={T.text4} />
    </Animated.View>
  );
}

const kingStyles = ({ a }: GlassState) => ({
  wrap: { gap: 14 },
  title: { ...font(15, 600, { ls: -0.01, lh: 1.4 }), color: T.text1 },
  rank: { gap: 2 },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 9,
  },
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  no: { width: 22, alignItems: 'center' as const },
  noText: { ...font(12, 700), ...TABULAR, color: T.text4 },
  name: { ...font(13, 600), color: T.text1, maxWidth: 70 },
  bar: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden' as const,
  },
  fill: { height: 6, borderRadius: 999, backgroundColor: a.accent },
  count: { ...font(13, 700), ...TABULAR, color: T.text1 },
  facts: { gap: 4, marginTop: 2, marginBottom: 8, marginLeft: 38 },
  fact: { ...font(12), color: T.text2 },
  factWhen: { ...TABULAR, color: T.text4 },
  foot: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    rowGap: 4,
    columnGap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  footText: { ...font(11.5), color: T.text3 },
});

// ── 팀 현황 ───────────────────────────────────────────────────────────────────────────────────────────

/** 팀 현황(웹 TeamCard) — 사람마다 오목 칸 r14: 아바타·이름(나), 진행 중 수·막대, 보드별, 오늘 방문·이번 주 처리 */
export function TeamCard({ members, me, loading, onPressMember, style }: TeamCardProps) {
  const s = useStyles(teamStyles);
  const { a } = useGlass();
  const views = teamMemberViews(members, me);
  return (
    <Card title="팀 현황" subtitle={teamCardSubtitle(members.length, loading)} style={style}>
      {!loading && views.length === 0 ? (
        <EmptyText text="보일 기술팀원이 없어요." />
      ) : (
        <View style={s.grid}>
          {views.map(m => (
            <Pressable
              key={m.name}
              onPress={onPressMember ? () => onPressMember(m.name) : undefined}
              disabled={!onPressMember}
              accessibilityRole="button"
              style={({ pressed }) => [s.member, m.isMe && s.me, pressed && s.memberOn]}
            >
              <View style={s.head}>
                {m.isMe ? (
                  <Avatar name={m.name} size="sm" highlight />
                ) : (
                  <AvatarBox
                    initials={avatarView(m.name).initials}
                    color="rgba(255, 255, 255, 0.14)"
                    ink="#ffffff"
                    size="sm"
                  />
                )}
                <RNText style={s.name} numberOfLines={1}>
                  {m.name}
                </RNText>
                {m.isMe ? <AccentTag label="나" accent={a.accent} hi={a.hi} /> : null}
              </View>
              <View style={s.load}>
                <RNText style={s.open}>
                  진행 중 <RNText style={s.openNum}>{m.openText}</RNText>
                </RNText>
                <View style={s.bar}>
                  <View style={[s.fill, { width: `${m.ratio * 100}%` }]} />
                </View>
              </View>
              <RNText style={s.boards}>{m.boards}</RNText>
              <View style={s.stats}>
                <View style={s.stat}>
                  <RNText style={s.dt}>오늘 방문</RNText>
                  <RNText style={[s.dd, m.visitsToday > 0 && { color: a.accent }]}>{m.visitsToday}</RNText>
                </View>
                <View style={s.stat}>
                  <RNText style={s.dt}>이번 주 처리</RNText>
                  <RNText style={s.dd}>{m.doneThisWeek}</RNText>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

const teamStyles = ({ a }: GlassState) => ({
  grid: { gap: 12 },
  member: { ...WELL, gap: 10, padding: 14, borderRadius: 14 },
  me: { borderColor: alpha(a.accent, 0.45) },
  memberOn: { backgroundColor: 'rgba(0, 0, 0, 0.32)' },
  head: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  name: { ...font(14, 700), color: T.text1, flexShrink: 1 },
  load: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  open: { ...font(12), color: T.text3 },
  openNum: { ...font(15, 700), ...TABULAR, color: T.text1 },
  bar: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden' as const,
  },
  fill: { height: 6, borderRadius: 999, backgroundColor: a.accent, opacity: 0.7 },
  boards: { ...font(11.5, 400, { lh: 1.45 }), color: T.text3 },
  stats: { flexDirection: 'row' as const, gap: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line },
  stat: { flexDirection: 'row' as const, alignItems: 'baseline' as const, gap: 6 },
  dt: { ...font(11), color: T.text4 },
  dd: { ...font(14, 700), ...TABULAR, color: T.text1 },
});

// ── 내 업무 줄 · 일정 ────────────────────────────────────────────────────────────────────────────────────

/** 내 업무 줄(웹 .my-work__row) — 이름 13.5/600 · 보드·때 한 줄 11.5 / 오른쪽 남은 날(곧 강조·지남 빨강) · 단계 */
export function WorkRow({ row, onPress, style }: WorkRowProps) {
  const s = useStyles(workStyles);
  const { a } = useGlass();
  const urgency = row.urgency.tone === 'alert' ? T.crit : row.urgency.tone === 'soon' ? a.accent : T.text3;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.row, pressed && s.pressed, style]}
    >
      <View style={s.body}>
        <RNText style={[s.name, row.done && s.done]} numberOfLines={1}>
          {row.title}
        </RNText>
        <View style={s.metaRow}>
          <View style={s.board}>
            <RNText style={s.boardText} numberOfLines={1}>
              {row.boardLabel}
            </RNText>
          </View>
          {row.detail ? (
            <RNText style={s.meta} numberOfLines={1}>
              {row.detail}
            </RNText>
          ) : null}
        </View>
      </View>
      <View style={s.side}>
        <RNText style={[s.when, { color: urgency }]}>{row.urgency.text}</RNText>
        <StagePill stage={row.stage.stage} status={row.stage.status} />
      </View>
      <ChevronRight size={14} strokeWidth={2} color={T.text4} />
    </Pressable>
  );
}

const workStyles = () => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  body: { flex: 1, minWidth: 0, gap: 4 },
  name: { ...font(13.5, 600), color: T.text1 },
  done: { fontWeight: '500' as const, color: T.text3 },
  metaRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  // 웹 .my-work__board — 볼록 칸 px8 py2 r6 11/600
  board: { ...RAISED, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, flexShrink: 0 },
  boardText: { ...font(11, 600), color: T.text2 },
  meta: { ...font(11.5), ...TABULAR, color: T.text3, flexShrink: 1 },
  side: { alignItems: 'flex-end' as const, gap: 6 },
  when: { ...font(12, 600) },
});

const KIND = {
  default: { color: T.info, bg: 'rgba(96, 165, 250, 0.12)' },
  techTask: { color: T.warn, bg: 'rgba(251, 191, 36, 0.12)' },
  rentals: { color: T.good, bg: 'rgba(74, 222, 128, 0.12)' },
} as const;

/**
 * 일정 하루(웹 .schedule__day) — 날짜 줄(오늘 강조) + 일정(시각 · 종류 표 · 이름·메타). 지난 일정 묶음(key 'overdue')은
 * 빨간 테두리 판 안에 날짜와 함께(웹 .schedule__overdue — 펼치고 접기는 화면의 단추가 한다).
 */
export function ScheduleDay({ day, onPressEvent, style }: ScheduleDayProps) {
  const s = useStyles(scheduleStyles);
  const { a } = useGlass();
  const overdue = day.key === 'overdue';
  const events = (
    <View style={[s.events, overdue && s.eventsOverdue]}>
      {day.events.map(e => {
        const kind = e.boardKey === 'techTask' ? KIND.techTask : e.boardKey === 'rentals' ? KIND.rentals : KIND.default;
        return (
          <Pressable
            key={e.key}
            onPress={() => onPressEvent(e)}
            accessibilityRole="button"
            style={({ pressed }) => [s.event, pressed && s.pressed]}
          >
            <RNText style={s.time}>{e.time}</RNText>
            <View style={[s.kind, { backgroundColor: kind.bg }]}>
              <RNText style={[s.kindText, { color: kind.color }]}>{e.kind}</RNText>
            </View>
            <View style={s.body}>
              <RNText style={s.title} numberOfLines={1}>
                {e.title}
              </RNText>
              {e.meta ? (
                <RNText style={s.meta} numberOfLines={1}>
                  {e.meta}
                </RNText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
  if (overdue) return <View style={[s.overdue, style]}>{events}</View>;
  const empty = day.events.length === 0;
  return (
    <View style={[s.day, empty && s.dayEmpty, style]}>
      <View style={[s.date, empty && s.dateEmpty]}>
        {day.rel ? <RNText style={[s.rel, day.isToday && { color: a.accent }]}>{day.rel}</RNText> : null}
        <RNText style={s.dateText}>{day.label}</RNText>
        {!empty ? <RNText style={s.count}>{day.events.length}건</RNText> : null}
      </View>
      {!empty ? events : null}
    </View>
  );
}

const scheduleStyles = () => ({
  day: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: T.line },
  dayEmpty: { paddingVertical: 7 },
  date: { flexDirection: 'row' as const, alignItems: 'baseline' as const, gap: 6, marginBottom: 6 },
  dateEmpty: { marginBottom: 0 },
  rel: { ...font(12.5, 700), color: T.text1 },
  dateText: { ...font(12), ...TABULAR, color: T.text3 },
  count: { ...font(12), ...TABULAR, color: T.text4, marginLeft: 'auto' as const },
  events: { gap: 2 },
  eventsOverdue: { paddingHorizontal: 6, paddingVertical: 8 },
  event: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, padding: 6, borderRadius: 8 },
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  time: { ...font(12, 600), ...TABULAR, color: T.text2, width: 44 },
  kind: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 6 },
  kindText: font(10.5, 700),
  body: { flex: 1, minWidth: 0 },
  title: { ...font(13, 600), color: T.text1 },
  meta: { ...font(11), color: T.text4 },
  // 웹 .schedule__overdue — 빨간 테두리 .28, 바탕 .06, r10
  overdue: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.28)',
    backgroundColor: 'rgba(248, 113, 113, 0.06)',
  },
});

// ── 보드 허브 · 사람 줄 ──────────────────────────────────────────────────────────────────────────────────

/** 보드 하나(앱 보드 허브 — 웹 사이드바 메뉴 자리) — 유리 판: 볼록 아이콘 칸 · 메뉴 이름 · Monday 보드 이름 / 진행 중 수 */
export function BoardTile({ label, title, icon: I, count, caption, onPress, style }: BoardTileProps) {
  const s = useStyles(tileStyles);
  const { a } = useGlass();
  return (
    <Enter style={style}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        {({ pressed }) => (
          <GlassSurface radius={RADIUS.card} style={s.tile}>
            {pressed ? <View pointerEvents="none" style={s.pressed} /> : null}
            <View style={s.icon}>
              <I size={18} strokeWidth={2} color={a.accent} />
            </View>
            <View style={s.body}>
              <RNText style={s.label} numberOfLines={1}>
                {label}
              </RNText>
              {title && title !== label ? (
                <RNText style={s.title} numberOfLines={1}>
                  {title}
                </RNText>
              ) : null}
              {caption ? (
                <RNText style={s.caption} numberOfLines={1}>
                  {caption}
                </RNText>
              ) : null}
            </View>
            {count !== undefined ? <RNText style={s.count}>{count ?? '…'}</RNText> : null}
            <ChevronRight size={16} strokeWidth={2} color={T.text4} />
          </GlassSurface>
        )}
      </Pressable>
    </Enter>
  );
}

const tileStyles = () => ({
  tile: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 14,
  },
  pressed: {
    position: 'absolute' as const,
    left: -1,
    top: -1,
    right: -1,
    bottom: -1,
    borderRadius: RADIUS.card,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  // 웹 사이드바 고른 메뉴(raised)의 아이콘 칸 모양
  icon: {
    ...RAISED,
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  label: { ...font(15, 600, { ls: -0.01 }), color: T.text1 },
  title: { ...font(11.5), color: T.text3 },
  caption: { ...font(11.5), color: T.text4 },
  count: { ...font(22, 700, { ls: -0.02 }), ...TABULAR, color: T.text1 },
});

/** 사람 줄(웹 팀원 표 .person — 아바타 sm · 이름 13/600 · 작은 글 11 · 알약들 · 오른쪽) */
export function PersonRow({ name, sub, highlight, pills, right, onPress, selected, style }: PersonRowProps) {
  const s = useStyles(personStyles);
  const { a } = useGlass();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [s.row, selected && s.on, pressed && s.pressed, style]}
    >
      <Avatar name={name} size="sm" highlight={highlight} />
      <View style={s.body}>
        <View style={s.nameRow}>
          <RNText style={s.name} numberOfLines={1}>
            {name}
          </RNText>
          {highlight ? <AccentTag label="나" accent={a.accent} hi={a.hi} /> : null}
        </View>
        {sub ? (
          <RNText style={s.sub} numberOfLines={1}>
            {sub}
          </RNText>
        ) : null}
        {pills && pills.length > 0 ? (
          <View style={s.pills}>
            {pills.map((p, i) => (
              <StatusPill key={`${i}:${p.label}`} tone={p.tone} label={p.label} dot={p.dot} />
            ))}
          </View>
        ) : null}
      </View>
      {right}
      {selected ? <Check size={16} strokeWidth={2.6} color={a.accent} /> : null}
    </Pressable>
  );
}

const personStyles = () => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  on: { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  body: { flex: 1, minWidth: 0, gap: 1 },
  nameRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  name: { ...font(13, 600), color: T.text1, flexShrink: 1 },
  sub: { ...font(11), color: T.text4 },
  pills: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginTop: 5 },
});

markRow(WorkRow, 'inset');
markRow(PersonRow, 'inset');

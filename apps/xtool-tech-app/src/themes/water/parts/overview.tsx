import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { ChevronDown, ChevronRight, Crown } from 'lucide-react-native';
import { stageLabel, stageTone } from '@xtool-core/tech-stage';
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
import { shadow, springConfig, W, WATER_SPRING } from '../theme';
import { useWater } from '../theme-context';
import { WPill } from './controls';
import { DarkPill, darkLayer, Glass, Solid, solidLayer } from './glass';
import { Reveal, Sheen, WBar, WCard, WEmpty, WNumber, WSkel } from './surfaces';
import { PickedMark } from './screen';
import { WText } from './text';
import { Avatar } from './basic';

// 물 개요·내 업무·팀원·보드 허브(웹 components/water/overview — attention-row·king-card·team-card, 물 화면의 my-work·
// schedule 줄). 챙길 건이 있는 타일은 떠 있는 유리에 어두운 표시 알약 숫자, 0건은 벽에 붙어 흐리게. 왕 카드 1위는 어두운
// 알약 속 금빛 왕관, 막대는 홈 속 어두운 알약이 차례로(21ms) extend 스프링으로 차오른다. 목록 줄은 옅은 흰 줄.

const FILL = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 } as const;
const MOVE = springConfig(WATER_SPRING.move);

/** 누르는 동안 떠오름(웹 hover translateY — D7 move 스프링) */
function useLift(dy: number) {
  const y = useSharedValue(0);
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return {
    style,
    onPressIn: () => {
      if (!reduced) y.value = withSpring(dy, MOVE);
    },
    onPressOut: () => {
      y.value = reduced ? 0 : withSpring(0, MOVE);
    },
  };
}

// ── 챙겨야 할 것 ──────────────────────────────────────────────────────────────

const TONE_DOT = { crit: W.crit, warn: W.warn, info: W.info } as const;

function AttentionTile({
  tile,
  loading,
  onPress,
}: {
  tile: AttentionRowProps['tiles'][number];
  loading: boolean;
  onPress: () => void;
}) {
  const p = useWater();
  const lift = useLift(-3);
  const on = !loading && tile.count > 0;
  return (
    <Animated.View style={[lift.style, styles.tileCell]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${tile.label} ${loading ? '불러오는 중' : `${tile.count}건`}`}
        onPress={onPress}
        onPressIn={lift.onPressIn}
        onPressOut={lift.onPressOut}
      >
        <Glass radius={18} k={1} lift={on ? 0.18 : 0} style={[styles.tile, !on && styles.zero]}>
          <View style={styles.tileLabel}>
            <View style={[styles.tileDot, { backgroundColor: on ? TONE_DOT[tile.tone] : W.dotIdle }]} />
            <WText size={12} weight="600" color={W.ink2} numberOfLines={1} style={styles.flexShrink}>
              {tile.label}
            </WText>
          </View>
          {loading ? (
            <WSkel shape="title" width={30} height={26} style={styles.countSkel} />
          ) : on ? (
            <View style={styles.countPill}>
              <View style={darkLayer(p, 17, 10)} />
              <WNumber value={tile.count} size={22} weight="800" lh={1.15} onDark />
            </View>
          ) : (
            <View style={styles.countBox}>
              <WNumber value={tile.count} size={22} weight="800" lh={1.15} color={W.ink2} />
            </View>
          )}
          <WText size={11} color={W.ink2} lh={1.4} numberOfLines={2}>
            {tile.caption}
          </WText>
        </Glass>
      </Pressable>
    </Animated.View>
  );
}

/** 챙겨야 할 것 — 제목 + 두 칸씩 타일(21ms 간격으로 진해진다) */
export function AttentionRow({ tiles, loading, onPressTile, style }: AttentionRowProps) {
  const rows: (typeof tiles)[number][][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
  return (
    <View style={[styles.attention, style]} accessibilityState={{ busy: loading }}>
      <WText size={15} weight="700" style={styles.attentionTitle} accessibilityRole="header">
        챙겨야 할 것
      </WText>
      {rows.map((row, r) => (
        <View key={r} style={styles.tileRow}>
          {row.map((tile, c) => (
            <Reveal key={tile.id} index={r * 2 + c} style={styles.tileCell}>
              <AttentionTile tile={tile} loading={loading} onPress={() => onPressTile(tile)} />
            </Reveal>
          ))}
          {row.length === 1 ? <View style={styles.tileCell} /> : null}
        </View>
      ))}
    </View>
  );
}

// ── 기술팀 왕 ─────────────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  const r = useSharedValue(open ? 180 : 0);
  useEffect(() => {
    r.value = withSpring(open ? 180 : 0, MOVE);
  }, [open, r]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <ChevronDown size={14} color={W.ink2} strokeWidth={2} />
    </Animated.View>
  );
}

/** 기술팀 왕(WaterKingCard) — 순위 홈 막대, 1위는 어두운 알약 속 왕관, 줄을 누르면 센 기록이 차례로 펼쳐진다 */
export function KingCard(props: KingCardProps) {
  const p = useWater();
  const view = kingCardView(props);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <WCard title={view.title} busy={view.state === 'loading'} style={props.style}>
      {view.state === 'loading' ? (
        <View style={styles.kingList}>
          {[56, 44, 50].map((w, i) => (
            <View key={i} style={styles.kingSkel}>
              <WSkel shape="circle" width={22} height={22} />
              <WSkel width={w} />
              <WSkel style={styles.flex} />
              <WSkel width={28} />
            </View>
          ))}
        </View>
      ) : view.state === 'empty' ? (
        <WEmpty title={view.emptyText} />
      ) : (
        <View style={styles.kingList}>
          {view.rows.map((row, i) => {
            const opened = open === row.name;
            return (
              <Reveal key={row.name} index={i}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: opened }}
                  onPress={() => setOpen(opened ? null : row.name)}
                >
                  {({ pressed }) => (
                    <View style={styles.kingRow}>
                      {pressed ? <View style={[FILL, styles.pillPressed]} /> : null}
                      <View style={styles.kingNo}>
                        {row.top ? <View style={darkLayer(p, 11, 10)} /> : null}
                        {row.top ? (
                          <Crown size={13} strokeWidth={2.2} color={W.gold} />
                        ) : (
                          <WText size={12} weight="700" color={W.ink2}>
                            {row.rank}
                          </WText>
                        )}
                      </View>
                      <WText size={13} weight="600" numberOfLines={1} style={styles.kingName}>
                        {row.name}
                      </WText>
                      <WBar value={row.ratio} index={i} size="sm" style={styles.flex} />
                      <WText size={13} weight="700" tabular>
                        {row.countText}
                      </WText>
                      <Chevron open={opened} />
                    </View>
                  )}
                </Pressable>
                {opened ? (
                  <View style={styles.facts}>
                    {row.facts.map((f, k) => (
                      <Reveal key={f.key} index={k}>
                        <WText size={12} numberOfLines={1}>
                          <WText size={12} color={W.ink2} tabular>
                            {`${f.when}  `}
                          </WText>
                          {f.name}
                        </WText>
                      </Reveal>
                    ))}
                    {row.moreFacts ? (
                      <WText size={12} color={W.ink2}>
                        {row.moreFacts}
                      </WText>
                    ) : null}
                    {row.facts.length === 0 ? (
                      <WText size={12} color={W.ink2}>
                        센 기록이 없어요
                      </WText>
                    ) : null}
                  </View>
                ) : null}
              </Reveal>
            );
          })}
        </View>
      )}
      {view.foot.length > 0 ? (
        <View style={styles.foot}>
          {view.foot.map(t => (
            <WText key={t} size={11.5} color={W.ink2}>
              {t}
            </WText>
          ))}
        </View>
      ) : null}
    </WCard>
  );
}

// ── 팀 현황 ───────────────────────────────────────────────────────────────────

/** 사람 동그라미 — 불투명 유리 단추 속 이니셜, 나는 어두운 표시 알약 속 흰 이니셜 */
function Face({ name, me }: { name: string; me: boolean }) {
  const p = useWater();
  return (
    <View style={styles.face}>
      <View style={me ? darkLayer(p, 15, 10) : solidLayer(p, 0.25, 15)} />
      <WText size={11} weight="700" color={me ? '#ffffff' : W.ink} onDark={me}>
        {avatarView(name).initials}
      </WText>
    </View>
  );
}

/** 팀 현황(WaterTeamCard) — 사람마다 테두리만 있는 유리 판(판 안의 판), 진행 중 막대는 홈 속 어두운 알약 */
export function TeamCard({ members, me, loading, onPressMember, style }: TeamCardProps) {
  const waiting = loading && members.length === 0;
  const views = teamMemberViews(members, me);
  return (
    <WCard title="팀 현황" subtitle={teamCardSubtitle(members.length, loading)} busy={waiting} style={style}>
      {waiting ? (
        <View style={styles.team}>
          {[64, 52, 72].map((w, i) => (
            <Glass key={i} radius={18} k={0.7} lift={0} style={styles.member}>
              <View style={styles.memberHead}>
                <WSkel shape="circle" width={30} height={30} />
                <WSkel width={w} />
              </View>
              <WSkel />
              <WSkel width="60%" />
            </Glass>
          ))}
        </View>
      ) : views.length === 0 ? (
        <WEmpty title="보일 기술팀원이 없어요." />
      ) : (
        <View style={styles.team}>
          {views.map((m, i) => (
            <Reveal key={m.name} index={i}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${m.name} 업무 보기`}
                disabled={!onPressMember}
                onPress={() => onPressMember?.(m.name)}
              >
                {({ pressed }) => (
                  <Glass radius={18} k={0.7} lift={0} style={[styles.member, pressed && styles.memberPressed]}>
                    <View style={styles.memberHead}>
                      <Face name={m.name} me={m.isMe} />
                      <WText size={14} weight="700" numberOfLines={1} style={styles.flexShrink}>
                        {m.name}
                      </WText>
                      {m.isMe ? (
                        <DarkPill radius={9} em={10} style={styles.meChip}>
                          <WText size={10.5} weight="700" onDark>
                            나
                          </WText>
                        </DarkPill>
                      ) : null}
                    </View>
                    <View style={styles.load}>
                      <WText size={12} color={W.ink2}>
                        진행 중{' '}
                        <WText size={15} weight="700" tabular>
                          {m.openText}
                        </WText>
                      </WText>
                      <WBar value={m.ratio} index={i} size="sm" style={styles.flex} />
                    </View>
                    <WText size={11.5} color={W.ink2}>
                      {m.boards}
                    </WText>
                    <View style={styles.stats}>
                      <View style={styles.stat}>
                        <WText size={11} color={W.ink2}>
                          오늘 방문
                        </WText>
                        {m.visitsToday ? (
                          <DarkPill radius={10} em={10} style={styles.statOn}>
                            <WText size={12.5} weight="700" onDark tabular>
                              {m.visitsToday}
                            </WText>
                          </DarkPill>
                        ) : (
                          <WText size={14} weight="700" tabular>
                            {m.visitsToday}
                          </WText>
                        )}
                      </View>
                      <View style={styles.stat}>
                        <WText size={11} color={W.ink2}>
                          이번 주 처리
                        </WText>
                        <WText size={14} weight="700" tabular>
                          {m.doneThisWeek}
                        </WText>
                      </View>
                    </View>
                  </Glass>
                )}
              </Pressable>
            </Reveal>
          ))}
        </View>
      )}
    </WCard>
  );
}

// ── 내 업무·일정 ────────────────────────────────────────────────────────────────

/** 내 업무 줄 — 옅은 흰 줄(물 화면 .my-work__row) · 보드 칩 · 이름·한 줄 · 단계 · 남은 날 · 쉐브론 */
export function WorkRow({ row, onPress, style }: WorkRowProps) {
  const when = row.urgency.tone === 'alert' ? W.pageCrit : row.urgency.tone === 'soon' ? W.ink : W.ink2;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={style}>
      {({ pressed }) => (
        <View style={[styles.workRow, { backgroundColor: pressed ? W.rowFillPressed : W.rowFill }]}>
          <View style={styles.flex}>
            <View style={styles.workTop}>
              <View style={styles.boardChip}>
                <WText size={11} weight="600" color={W.ink2} numberOfLines={1}>
                  {row.boardLabel}
                </WText>
              </View>
              <WText size={12} weight="600" color={when} numberOfLines={1} style={styles.workWhen}>
                {row.urgency.text}
              </WText>
            </View>
            <WText
              size={13.5}
              weight={row.done ? '500' : '600'}
              color={row.done ? W.ink3 : W.ink}
              numberOfLines={1}
              style={styles.workTitle}
            >
              {row.title}
            </WText>
            {row.detail ? (
              <WText size={11.5} color={W.ink3} tabular numberOfLines={1} style={styles.workDetail}>
                {row.detail}
              </WText>
            ) : null}
            <WPill tone={stageTone(row.stage)} style={styles.workPill}>
              {stageLabel(row.stage.stage)}
            </WPill>
          </View>
          <ChevronRight size={14} color={W.ink3} strokeWidth={2} />
        </View>
      )}
    </Pressable>
  );
}

/** 일정 종류 칩 색 — 보드마다(웹 schedule__kind is-{boardKey}, 물 화면 상태 글자 토큰) */
function kindStyle(boardKey: string) {
  if (boardKey === 'techTask') return { color: W.pageWarn, backgroundColor: 'rgba(251, 191, 36, 0.12)' };
  if (boardKey === 'rentals') return { color: W.pageGood, backgroundColor: 'rgba(74, 222, 128, 0.12)' };
  return { color: W.pageInfo, backgroundColor: 'rgba(96, 165, 250, 0.12)' };
}

/** 일정 하루 — 날짜 머리(오늘은 어두운 알약) + 일정 줄(옅은 흰 줄), 없으면 '일정 없음' */
export function ScheduleDay({ day, onPressEvent, style }: ScheduleDayProps) {
  return (
    <View style={[styles.day, style]}>
      <View style={styles.dayHead}>
        {day.rel ? (
          day.isToday ? (
            <DarkPill radius={10} em={10} style={styles.rel}>
              <WText size={11} weight="700" onDark>
                {day.rel}
              </WText>
            </DarkPill>
          ) : (
            <View style={[styles.rel, styles.relChip]}>
              <WText size={11} weight="700" color={W.ink2}>
                {day.rel}
              </WText>
            </View>
          )
        ) : null}
        <WText size={13} weight="600" numberOfLines={2} style={styles.flexShrink}>
          {day.label}
        </WText>
        {day.events.length > 0 ? (
          <WText size={11.5} color={W.ink2} tabular>
            {day.events.length}건
          </WText>
        ) : null}
      </View>
      {day.events.length === 0 ? (
        <WText size={12} color={W.ink3} style={styles.none}>
          일정 없음
        </WText>
      ) : (
        day.events.map((e, i) => {
          const kind = kindStyle(e.boardKey);
          return (
            <Reveal key={e.key} index={i}>
              <Pressable accessibilityRole="button" onPress={() => onPressEvent(e)}>
                {({ pressed }) => (
                  <View style={[styles.event, { backgroundColor: pressed ? W.rowFillPressed : W.rowFill }]}>
                    <WText size={12} weight="600" color={W.ink2} tabular style={styles.eventTime}>
                      {e.time}
                    </WText>
                    <View style={[styles.kind, { backgroundColor: kind.backgroundColor }]}>
                      <WText size={10.5} weight="700" color={kind.color}>
                        {e.kind}
                      </WText>
                    </View>
                    <View style={styles.flex}>
                      <WText size={13} weight="600" numberOfLines={1}>
                        {e.title}
                      </WText>
                      {e.meta ? (
                        <WText size={11} color={W.ink4} numberOfLines={1}>
                          {e.meta}
                        </WText>
                      ) : null}
                    </View>
                  </View>
                )}
              </Pressable>
            </Reveal>
          );
        })
      )}
    </View>
  );
}

// ── 보드 허브·사람 ──────────────────────────────────────────────────────────────

/** 보드 하나(앱만) — 유리 판, 불투명 유리 단추 속 흰 아이콘 · 메뉴 이름 · Monday 보드 이름 · 오른쪽 진행 중 수 */
export function BoardTile({ label, title, icon: I, count, caption, onPress, style }: BoardTileProps) {
  const lift = useLift(-2);
  return (
    <Animated.View style={[lift.style, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={lift.onPressIn}
        onPressOut={lift.onPressOut}
      >
        <Glass radius={20} k={1} lift={0.3} style={styles.boardTile}>
          <Solid k={0.3} radius={18} style={styles.boardIcon}>
            <View style={styles.iconShadow}>
              <I size={17} color="#ffffff" strokeWidth={2} />
            </View>
          </Solid>
          <View style={styles.flex}>
            <WText size={15} weight="600" numberOfLines={1}>
              {label}
            </WText>
            {title && title !== label ? (
              <WText size={11.5} color={W.ink2} numberOfLines={1} style={styles.tileSub}>
                {title}
              </WText>
            ) : null}
            {caption ? (
              <WText size={11.5} color={W.ink2} numberOfLines={1} style={styles.tileSub}>
                {caption}
              </WText>
            ) : null}
          </View>
          {count == null ? (
            <View>
              <Sheen radius={8} />
              <WSkel shape="title" width={30} height={22} />
            </View>
          ) : (
            <WNumber value={count} size={22} weight="800" lh={1.15} tabular />
          )}
        </Glass>
      </Pressable>
    </Animated.View>
  );
}

/** 사람 줄 — 아바타·이름·한 줄·알약·오른쪽. 고른 사람은 밝은 흰 판 + 어두운 체크 구슬(오른쪽 것이 늘 밝은 바탕 위) */
export function PersonRow({ name, sub, highlight, pills, right, onPress, selected = false, style }: PersonRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      disabled={!onPress}
      onPress={onPress}
      style={style}
    >
      {({ pressed }) => (
        <View style={styles.person}>
          {selected ? (
            <View style={[FILL, styles.rowOn]} />
          ) : pressed ? (
            <View style={[FILL, styles.rowPressed]} />
          ) : null}
          <Avatar name={name} size="sm" highlight={highlight} />
          <View style={styles.flex}>
            <WText size={13.5} weight={selected ? '700' : '600'} numberOfLines={1}>
              {name}
            </WText>
            {sub ? (
              <WText size={11.5} color={W.ink2} numberOfLines={1} style={styles.tileSub}>
                {sub}
              </WText>
            ) : null}
            {pills && pills.length > 0 ? (
              <View style={styles.pills}>
                {pills.map(pl => (
                  <WPill key={pl.label} tone={pl.tone} dot={pl.dot ?? true}>
                    {pl.label}
                  </WPill>
                ))}
              </View>
            ) : null}
          </View>
          {right}
          {selected ? <PickedMark /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  attention: { gap: 12 },
  attentionTitle: { paddingHorizontal: 4 },
  tileRow: { flexDirection: 'row', gap: 12 },
  tileCell: { flex: 1, minWidth: 0 },
  tile: { gap: 6, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 12, minHeight: 112 },
  zero: { opacity: 0.62 },
  tileLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileDot: { width: 7, height: 7, borderRadius: 3.5 },
  countSkel: { marginVertical: 6 },
  countPill: {
    alignSelf: 'flex-start',
    minWidth: 36,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  countBox: { alignSelf: 'flex-start', minWidth: 36, height: 34, justifyContent: 'center', marginVertical: 2 },
  kingList: { gap: 2 },
  kingSkel: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 8 },
  kingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 8 },
  pillPressed: { borderRadius: 999, backgroundColor: W.chip },
  kingNo: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  kingName: { maxWidth: 70 },
  facts: { gap: 4, marginTop: 4, marginBottom: 10, marginLeft: 40 },
  foot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
    columnGap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.12)',
    boxShadow: [shadow(0, 1, 0, 0, 'rgba(255, 255, 255, 0.4)', true)],
  },
  team: { gap: 14 },
  member: { gap: 10, padding: 14 },
  memberPressed: { opacity: 0.85 },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  face: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  meChip: { paddingHorizontal: 7, paddingVertical: 2 },
  load: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stats: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.12)',
    boxShadow: [shadow(0, 1, 0, 0, 'rgba(255, 255, 255, 0.4)', true)],
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statOn: { paddingHorizontal: 8, height: 20, justifyContent: 'center' },
  workRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  workTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  boardChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: W.boardChip, flexShrink: 1 },
  workWhen: { marginLeft: 'auto' },
  workTitle: { marginTop: 6 },
  workDetail: { marginTop: 2 },
  workPill: { marginTop: 7 },
  day: { gap: 4 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  rel: { height: 20, paddingHorizontal: 8, justifyContent: 'center' },
  relChip: { borderRadius: 10, backgroundColor: W.chip },
  none: { paddingHorizontal: 4, paddingVertical: 4 },
  event: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, marginTop: 2 },
  eventTime: { width: 44 },
  kind: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 6 },
  boardTile: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18 },
  boardIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconShadow: { shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 1, shadowOffset: { width: 0, height: 1 } },
  tileSub: { marginTop: 2 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12 },
  rowPressed: { borderRadius: 14, backgroundColor: W.chip },
  rowOn: {
    borderRadius: 14,
    backgroundColor: W.chipHover,
    boxShadow: [shadow(0, 1, 0, 0, 'rgba(255, 255, 255, 0.5)', true), shadow(0, 1, 2, 0, 'rgba(0, 0, 0, 0.06)')],
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
});

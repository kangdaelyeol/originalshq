import { Pressable, Text as RNText, View } from 'react-native';
import { MessageCircle, MessageCirclePlus } from 'lucide-react-native';
import { upcomingRow } from '../../../features/dashboard/part-data';
import type { MiniListProps, RecordListProps, RecordRowProps, UpcomingListProps } from '../../dashboard/parts';
import { alpha, FAMILY, font, RADIUS, RAISED, T, TABULAR, WELL } from '../theme';
import { useGlass, useStyles, type GlassState } from '../theme-context';
import { Assignees, CheckBox, StagePill, StatusPill } from './controls';
import { Bleed, Card, EmptyText, markRow, Skeleton } from './surfaces';
import { SpinIcon } from './text';

// 보드 목록 — 웹 RecordTable(유리 판 + 표)을 폰에서는 판 안 줄 목록으로. 표 칸(이름·사람·날짜·단계·담당자)을 한 줄에
// 모으고, 줄 사이는 웹 표처럼 가는 선(--line). 일정(UpcomingList)·짧은 목록(MiniList)은 웹 그대로.

/** 기록 줄(웹 record-table 한 줄) — 이름 13.5/600 · 작은 글 · 메타 · 단계·담당자 / 오른쪽 날짜·값. 고른 줄은 강조 .06 */
export function RecordRow({
  row,
  onPress,
  onLongPress,
  onPressUpdates,
  selecting,
  selected,
  style,
  last,
}: RecordRowProps & { last?: boolean }) {
  const s = useStyles(rowStyles);
  const { a } = useGlass();
  const meta = row.meta?.filter(Boolean).join(' · ');
  const hasFoot = row.stage || row.pill || (row.assignees && row.assignees.length > 0) || row.saving;
  const dateColor = row.date?.tone === 'crit' ? T.crit : row.date?.tone === 'muted' ? T.text3 : T.text2;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        s.row,
        last && s.last,
        selected && { backgroundColor: alpha(a.accent, 0.06) },
        pressed && !selected && s.pressed,
        style,
      ]}
    >
      {selecting ? (
        <View style={s.check}>
          <CheckBox on={!!selected} />
        </View>
      ) : null}
      <View style={s.main}>
        <View style={s.titleRow}>
          <RNText style={[s.title, row.done && s.titleDone]} numberOfLines={2}>
            {row.title || '(이름 없음)'}
          </RNText>
          {row.updates !== null && row.updates !== undefined ? (
            <Pressable
              onPress={onPressUpdates}
              hitSlop={6}
              accessibilityLabel={row.updates ? `업데이트 ${row.updates}개` : '업데이트 쓰기'}
              style={({ pressed }) => [s.updates, !row.updates && s.updatesEmpty, pressed && s.updatesOn]}
            >
              {row.updates ? (
                <>
                  <MessageCircle size={13} strokeWidth={2} color={T.text2} />
                  <RNText style={s.updatesText}>{row.updates}</RNText>
                </>
              ) : (
                <MessageCirclePlus size={14} strokeWidth={2} color={T.text4} />
              )}
            </Pressable>
          ) : null}
        </View>
        {row.subtitle ? (
          <RNText style={s.subtitle} numberOfLines={1}>
            {row.subtitle}
          </RNText>
        ) : null}
        {meta ? (
          <RNText style={s.meta} numberOfLines={1}>
            {meta}
          </RNText>
        ) : null}
        {hasFoot ? (
          <View style={s.foot}>
            {row.stage ? <StagePill stage={row.stage.stage} status={row.stage.status} /> : null}
            {row.pill ? <StatusPill tone={row.pill.tone} label={row.pill.label} dot={row.pill.dot} /> : null}
            {row.assignees && row.assignees.length > 0 ? <Assignees names={row.assignees} style={s.assignees} /> : null}
            {row.saving ? (
              <View style={s.saving}>
                <SpinIcon size={12} color={a.accent} />
                <RNText style={[s.savingText, { color: a.accent }]}>저장 중</RNText>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {row.date || row.value ? (
        <View style={s.side}>
          {row.date ? (
            <>
              <RNText style={[s.date, { color: dateColor }]}>{row.date.text}</RNText>
              {row.date.hint ? (
                <RNText style={[s.hint, { color: row.date.tone === 'crit' ? T.crit : a.accent }]}>
                  {row.date.hint}
                </RNText>
              ) : null}
            </>
          ) : null}
          {row.value ? <RNText style={[s.value, row.value.alert && { color: T.crit }]}>{row.value.text}</RNText> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const rowStyles = () => ({
  // 웹 td — 위아래 11, 줄 사이 --line. 판 끝까지 가는 줄이라 좌우는 판 여백(18)
  row: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  last: { borderBottomLeftRadius: RADIUS.card - 1, borderBottomRightRadius: RADIUS.card - 1 },
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.025)' },
  check: { paddingTop: 2 },
  main: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 8 },
  title: { ...font(13.5, 600, { lh: 1.45 }), color: T.text1, flexShrink: 1 },
  titleDone: { fontFamily: FAMILY[500], color: T.text3 },
  // 웹 .record-row__updates — 말풍선 + 수, 없으면 쓰기 아이콘만
  updates: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 1,
  },
  updatesEmpty: { backgroundColor: 'transparent', paddingHorizontal: 2 },
  updatesOn: { backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  updatesText: { ...font(11.5, 600), ...TABULAR, color: T.text2 },
  subtitle: { ...font(11, 400, { lh: 1.45 }), ...TABULAR, color: T.text4 },
  meta: { ...font(11.5, 400, { lh: 1.45 }), color: T.text3 },
  foot: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 4,
  },
  assignees: { flexShrink: 1 },
  saving: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  savingText: font(10.5, 600),
  side: { alignItems: 'flex-end' as const, gap: 2, paddingTop: 1, maxWidth: '38%' as const },
  date: { ...font(12, 600), ...TABULAR },
  hint: font(11, 600),
  value: { ...font(12.5, 700), ...TABULAR, color: T.text2 },
});

/** 기록 목록(웹 RecordTable) — 판 머리 + 도구 줄 + 줄들 + 빈 글 + "더 보기 · N건 남음" */
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
  selecting,
  selected,
  more,
  style,
}: RecordListProps) {
  const s = useStyles(listStyles);
  return (
    <Card title={title} subtitle={subtitle} actions={actions} toolbar={toolbar} padded={false} style={style}>
      {loading ? (
        <Bleed style={s.loading}>
          {[0, 1, 2].map(i => (
            <View key={i} style={s.ghostRow}>
              <Skeleton width="62%" height={13} radius="sm" />
              <Skeleton width="38%" height={10} radius="sm" />
              <Skeleton width={72} height={20} radius="sm" />
            </View>
          ))}
        </Bleed>
      ) : rows.length === 0 ? (
        <Bleed style={s.empty}>
          <EmptyText text={emptyText} />
        </Bleed>
      ) : (
        rows.map((row, i) => (
          <RecordRow
            key={row.id}
            row={row}
            last={!more && i === rows.length - 1}
            onPress={() => onPressRow(row.id)}
            onLongPress={onLongPressRow ? () => onLongPressRow(row.id) : undefined}
            onPressUpdates={onPressUpdates ? () => onPressUpdates(row.id) : undefined}
            selecting={selecting}
            selected={selected?.has(row.id)}
          />
        ))
      )}
      {more && !loading ? (
        <Bleed style={s.moreWrap}>
          <Pressable
            onPress={more.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [s.more, pressed && s.moreOn]}
          >
            <RNText style={s.moreText}>
              더 보기 <RNText style={s.moreRest}>{more.remaining}건 남음</RNText>
            </RNText>
          </Pressable>
        </Bleed>
      ) : null}
    </Card>
  );
}

const listStyles = () => ({
  loading: { borderTopWidth: 1, borderTopColor: T.line, paddingHorizontal: 18, paddingVertical: 8, gap: 18 },
  ghostRow: { gap: 8, paddingVertical: 6 },
  empty: { borderTopWidth: 1, borderTopColor: T.line, paddingVertical: 10 },
  moreWrap: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12 },
  // 웹 .record-more — 오목 칸 h38
  more: {
    ...WELL,
    height: 38,
    borderRadius: RADIUS.control,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  moreOn: { borderColor: 'rgba(255, 255, 255, 0.14)' },
  moreText: { ...font(12.5, 600), color: T.text2 },
  moreRest: { ...font(12.5, 500), color: T.text4 },
});

// ── 일정·짧은 목록 ──────────────────────────────────────────────────────────────────────────────────────

/** 날짜순 일정(웹 UpcomingList) — 날짜 칸(볼록 46×44, 오늘 강조·지남 빨강) + 이름·한 줄 + 오른쪽 "내일"/"3일째" */
export function UpcomingList({ items, today, empty, mode = 'due', style }: UpcomingListProps) {
  const s = useStyles(upcomingStyles);
  if (items.length === 0)
    return (
      <View style={style}>
        <EmptyText text={empty} />
      </View>
    );
  return (
    <View style={[s.list, style]}>
      {items.map(item => {
        const v = upcomingRow(item, today, mode);
        return (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            disabled={!item.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [s.row, pressed && s.pressed]}
          >
            <View style={[s.date, v.isToday && s.today, v.overdue && s.overdue]}>
              <RNText style={s.md}>{v.md}</RNText>
              <RNText style={s.weekday}>{v.weekday}</RNText>
            </View>
            <View style={s.body}>
              <RNText style={s.title} numberOfLines={1}>
                {item.title}
              </RNText>
              {item.meta ? (
                <RNText style={s.meta} numberOfLines={1}>
                  {item.meta}
                </RNText>
              ) : null}
            </View>
            <RNText style={[s.when, v.overdue && s.whenOverdue, mode === 'since' && s.whenSince]}>{v.when}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

const upcomingStyles = ({ a }: GlassState) => ({
  list: { gap: 4 },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  date: {
    ...RAISED,
    width: 46,
    height: 44,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  today: { borderColor: alpha(a.accent, 0.55), backgroundColor: alpha(a.accent, 0.12) },
  overdue: { borderColor: 'rgba(248, 113, 113, 0.45)', backgroundColor: 'rgba(248, 113, 113, 0.1)' },
  md: { ...font(13, 700, { lh: 1.1 }), ...TABULAR, color: T.text1 },
  weekday: { ...font(10.5, 400, { lh: 1.2 }), color: T.text3 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...font(13, 600), color: T.text1 },
  meta: { ...font(11.5), color: T.text3 },
  when: { ...font(11.5, 600), color: a.accent },
  whenOverdue: { color: T.crit },
  whenSince: { color: T.text2 },
});

/** 짧은 목록(웹 MiniList) — 이름 13/600 · 한 줄 11.5 · 오른쪽 값 12.5/700(경고 빨강) */
export function MiniList({ items, empty, style }: MiniListProps) {
  const s = useStyles(miniStyles);
  if (items.length === 0)
    return (
      <View style={style}>
        <EmptyText text={empty} />
      </View>
    );
  return (
    <View style={[s.list, style]}>
      {items.map(item => (
        <Pressable
          key={item.key}
          onPress={item.onPress}
          disabled={!item.onPress}
          accessibilityRole="button"
          style={({ pressed }) => [s.row, pressed && s.pressed]}
        >
          <View style={s.body}>
            <RNText style={s.title} numberOfLines={1}>
              {item.title}
            </RNText>
            {item.meta ? (
              <RNText style={s.meta} numberOfLines={1}>
                {item.meta}
              </RNText>
            ) : null}
          </View>
          {item.value ? <RNText style={[s.value, item.alert && s.alert]}>{item.value}</RNText> : null}
        </Pressable>
      ))}
    </View>
  );
}

const miniStyles = () => ({
  list: { gap: 2 },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, padding: 8, borderRadius: 10 },
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  body: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...font(13, 600), color: T.text1 },
  meta: { ...font(11.5), color: T.text3 },
  value: { ...font(12.5, 700), ...TABULAR, color: T.text2 },
  alert: { color: T.crit },
});

markRow(RecordRow, 'bleed');

import { daysBetween, koreaNow, relativeDay, shortDate } from '@xtool-core/dates';
import { personColor } from '@xtool-core/monday-colors';
import { urgencyText, type MyWorkItem } from '@xtool-core/my-work';
import type { Schedule, ScheduleEvent } from '@xtool-core/schedule';
import { initialsOf } from '@xtool-core/session';
import type { TeamMemberStatus, WorkBoard } from '@xtool-core/team-status';
import type {
  BarListItem,
  KingCardProps,
  DateTimeValue,
  FileView,
  ScheduleDayView,
  ScheduleEventView,
  UpcomingItem,
  UpdateView,
  WorkRowView,
} from '../../themes/dashboard/parts';
import { formatPhone } from '@xtool-core/tech-stage';
import { authorOf, type TechUpdate } from '@xtool-core/tech-updates';
import { isPendingUpdate, updateWhenText } from '@xtool-core/use-item-updates';

// 부품이 그릴 글·숫자 — 대시보드 부품 계약(themes/dashboard/parts.ts)을 구현하는 테마(글라스·물)가 같이 부른다. 웹 부품
// (bar-list·upcoming-list·king-card·team-card·my-work-card·schedule-card·item-updates)이 화면 안에서 하던 계산을 한곳에
// 모아, 테마가 달라도 같은 숫자·글이 나오게 한다. 모양(색·크기)은 여기 없다.

// ── 숫자 ─────────────────────────────────────────────────────────────────────────────────────────────────

/** 1,234 — 웹 ohq-ui formatInt와 같다(Intl 없이) */
export const formatInt = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ── 막대 목록 (웹 charts/bar-list.tsx) ──────────────────────────────────────────────────────────────────

export interface BarRow extends BarListItem {
  /** 값 글(1,234) */
  valueText: string;
  /** 몫 % 글(37%) */
  shareText: string;
  /** 막대 길이 — 가장 큰 값에 대한 비(0~1) */
  ratio: number;
}

/** 0은 빼고 큰 순, limit을 넘으면 limit-1개 + "기타"(나머지 합). 몫은 보이는 합에 대한 %, 막대는 가장 큰 값 기준. */
export function barListRows(items: readonly BarListItem[], limit = 6): BarRow[] {
  const sorted = [...items].filter(item => item.value > 0).sort((a, b) => b.value - a.value);
  const shown: BarListItem[] =
    sorted.length > limit
      ? [
          ...sorted.slice(0, limit - 1),
          { key: '__other', label: '기타', value: sorted.slice(limit - 1).reduce((sum, item) => sum + item.value, 0) },
        ]
      : sorted;
  const max = Math.max(1, ...shown.map(item => item.value));
  const total = shown.reduce((sum, item) => sum + item.value, 0);
  return shown.map(item => ({
    ...item,
    valueText: formatInt(item.value),
    shareText: `${Math.round((item.value / total) * 100)}%`,
    ratio: item.value / max,
  }));
}

/** 값 목록을 이름별 개수로 — 웹 ohq-ui charts/chart-utils countBy와 같다(빈 값은 '미지정') */
export function countBy(values: readonly (string | null | undefined)[], emptyLabel = '미지정'): BarListItem[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const label = raw?.trim() || emptyLabel;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, value]) => ({ key: label, label, value }));
}

// ── 날짜 ─────────────────────────────────────────────────────────────────────────────────────────────────

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 요일 글자(YYYY-MM-DD) */
export const weekdayOf = (date: string): string => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

export interface UpcomingRowView {
  /** '11/9' */
  md: string;
  /** '월' */
  weekday: string;
  /** 지난 날(due일 때만) — 위험 색 */
  overdue: boolean;
  isToday: boolean;
  /** 오른쪽 글 — due: '내일'·'3일 후'·'2일 전' / since: '5일째' */
  when: string;
}

/** 다가오는 일정 한 줄의 날짜 글(웹 upcoming-list.tsx) */
export function upcomingRow(item: UpcomingItem, today: string, mode: 'due' | 'since' = 'due'): UpcomingRowView {
  const [, m, d] = item.date.split('-');
  return {
    md: `${Number(m)}/${Number(d)}`,
    weekday: weekdayOf(item.date),
    overdue: mode === 'due' && item.date < today,
    isToday: item.date === today,
    when: mode === 'since' ? `${daysBetween(item.date, today)}일째` : relativeDay(item.date, today),
  };
}

// ── 왕 카드 (웹 overview/king-card.tsx) ─────────────────────────────────────────────────────────────────

/** 처음에 보여 줄 순위 수 — 나머지는 "외 N명" */
export const KING_SHOWN = 5;
/** 펼친 줄에 보일 기록 수 */
export const KING_FACTS = 12;

export interface KingRowView {
  name: string;
  /** 1부터 — 1위는 왕관 */
  rank: number;
  top: boolean;
  /** 'N건' */
  countText: string;
  /** 막대 길이(0~1) */
  ratio: number;
  /** 펼치면 보일 기록 — '방문 11/3' + 이름 */
  facts: { key: string; when: string; name: string }[];
  /** '외 N건' 또는 null */
  moreFacts: string | null;
}

export interface KingCardView {
  /** '이번 주 AS왕' */
  title: string;
  state: 'loading' | 'empty' | 'ranked';
  /** 비었을 때 글 — '아직 실적이 없어요 (11/2~11/8)' / 불러오는 중이면 '불러오는 중…' */
  emptyText: string;
  rows: KingRowView[];
  /** 꼬리 글들 — 합계 N건 · 외 N명 · 담당자 없음 N건 · 지난주 1위 … */
  foot: string[];
}

export function kingCardView({
  def,
  spanLabel,
  previousLabel,
  period,
  result,
  previousTop,
}: KingCardProps): KingCardView {
  const title = `${spanLabel} ${def.title}`;
  if (result === null) return { title, state: 'loading', emptyText: '불러오는 중…', rows: [], foot: [] };
  const max = Math.max(1, ...result.rows.map(r => r.count));
  const rows = result.rows.slice(0, KING_SHOWN).map((row, i) => ({
    name: row.name,
    rank: i + 1,
    top: i === 0,
    countText: `${row.count}건`,
    ratio: row.count / max,
    facts: row.facts.slice(0, KING_FACTS).map(fact => ({
      key: fact.itemId,
      when: `${def.dateLabel} ${shortDate(fact.date)}`,
      name: fact.name || '(이름 없음)',
    })),
    moreFacts: row.facts.length > KING_FACTS ? `외 ${row.facts.length - KING_FACTS}건` : null,
  }));
  const foot = [
    `합계 ${result.total}건`,
    ...(result.rows.length > KING_SHOWN ? [`외 ${result.rows.length - KING_SHOWN}명`] : []),
    ...(result.unassigned > 0 ? [`담당자 없음 ${result.unassigned}건`] : []),
    `${previousLabel} 1위 ${previousTop ? `${previousTop.name} ${previousTop.count}건` : '없음'}`,
  ];
  return {
    title,
    state: rows.length === 0 ? 'empty' : 'ranked',
    emptyText: `아직 실적이 없어요 (${shortDate(period.start)}~${shortDate(period.end)})`,
    rows,
    foot,
  };
}

// ── 팀 현황 (웹 overview/team-card.tsx) ─────────────────────────────────────────────────────────────────

export const TEAM_BOARD_SHORT: Record<WorkBoard, string> = {
  fieldService: '출장',
  repair: 'AS',
  techInquiry: '아톡',
  techTask: '기타',
};

export interface TeamMemberView {
  name: string;
  isMe: boolean;
  /** '진행 중 N'의 N */
  openText: string;
  /** 막대 길이 — 가장 많은 사람에 대한 비(0~1) */
  ratio: number;
  /** '출장 2 · AS 1' 또는 '진행 중인 건 없음' */
  boards: string;
  visitsToday: number;
  doneThisWeek: number;
}

export function teamMemberViews(members: readonly TeamMemberStatus[], me: ReadonlySet<string>): TeamMemberView[] {
  const max = Math.max(1, ...members.map(m => m.openTotal));
  return members.map(m => ({
    name: m.name,
    isMe: me.has(m.name),
    openText: String(m.openTotal),
    ratio: m.openTotal / max,
    boards:
      (Object.keys(TEAM_BOARD_SHORT) as WorkBoard[])
        .filter(b => m.open[b] > 0)
        .map(b => `${TEAM_BOARD_SHORT[b]} ${m.open[b]}`)
        .join(' · ') || '진행 중인 건 없음',
    visitsToday: m.visitsToday,
    doneThisWeek: m.doneThisWeek,
  }));
}

/** 팀 카드 부제 — 불러오는 중이면 '불러오는 중…', 아니면 'N명' */
export const teamCardSubtitle = (count: number, loading: boolean): string => (loading ? '불러오는 중…' : `${count}명`);

// ── 내 업무 줄 (웹 overview/my-work-card.tsx MyWorkRow) ─────────────────────────────────────────────────

export function workRowView(item: MyWorkItem, today: string): WorkRowView {
  const detail = [
    item.target &&
      `${item.target.label} ${shortDate(item.target.date)}${item.target.time ? ` ${item.target.time}` : ''}`,
    item.since && `${item.since.label} ${shortDate(item.since.date)}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    key: `${item.boardKey}:${item.itemId}`,
    boardKey: item.boardKey,
    itemId: item.itemId,
    boardLabel: item.boardLabel,
    title: item.name || '(이름 없음)',
    detail,
    stage: { stage: item.stage, status: item.status },
    urgency: urgencyText(item, today),
    done: item.done,
  };
}

// ── 일정 (웹 overview/schedule-card.tsx) ────────────────────────────────────────────────────────────────

const eventView = (e: ScheduleEvent, showDate: boolean): ScheduleEventView => ({
  key: e.key,
  boardKey: e.boardKey,
  itemId: e.itemId,
  time: showDate ? shortDate(e.date) : e.time ?? '종일',
  kind: e.kind,
  title: e.title || '(이름 없음)',
  meta: e.meta || null,
});

export interface ScheduleView {
  /** 지난 일정 — 날짜가 지났는데 아직 안 끝난 것(없으면 null). 펼쳐 보는 묶음 */
  overdue: ScheduleDayView | null;
  days: ScheduleDayView[];
  total: number;
}

/** 오늘부터 7일 — 날짜 머리('오늘'·'내일' + '11/9 (월)')와 일정 */
export function scheduleView(schedule: Schedule, today: string): ScheduleView {
  const days = schedule.days.map(({ date, events }) => {
    const diff = daysBetween(today, date);
    return {
      key: date,
      rel: diff === 0 ? '오늘' : diff === 1 ? '내일' : null,
      label: `${shortDate(date)} (${weekdayOf(date)})`,
      isToday: diff === 0,
      events: events.map(e => eventView(e, false)),
    };
  });
  const overdue =
    schedule.overdue.length > 0
      ? {
          key: 'overdue',
          rel: null,
          label: `지난 일정 ${schedule.overdue.length}건 — 날짜가 지났는데 아직 안 끝남`,
          isToday: false,
          events: schedule.overdue.map(e => eventView(e, true)),
        }
      : null;
  return { overdue, days, total: days.reduce((sum, d) => sum + d.events.length, 0) };
}

// ── 업데이트 (웹 board/item-updates.tsx) ────────────────────────────────────────────────────────────────

/** core TechUpdate → 부품이 그릴 것(서명에서 쓴 사람, '3분 전', 올리는 중) */
export function updateView(update: TechUpdate): UpdateView {
  const { author, text } = authorOf(update);
  const pending = isPendingUpdate(update);
  return {
    id: update.id,
    author,
    when: pending ? '' : updateWhenText(update.createdAt),
    text,
    pending,
    replies: update.replies.map(updateView),
  };
}

// ── 파일 (웹 data/tech-files.ts·board/item-files.tsx) ───────────────────────────────────────────────────

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i;

/** 파일 이름·이미지 여부·주소 → 부품이 그릴 것 */
export function fileView(file: {
  key: string;
  name: string;
  isImage: boolean;
  url: string | null;
  thumbUrl?: string | null;
  meta?: string;
}): FileView {
  const kind = file.isImage || IMAGE_EXT.test(file.name) ? 'image' : /\.pdf$/i.test(file.name) ? 'pdf' : 'file';
  return { key: file.key, name: file.name, kind, url: file.url, thumbUrl: file.thumbUrl ?? null, meta: file.meta };
}

// ── 전화 (웹 board/cells.tsx PhoneLink) ─────────────────────────────────────────────────────────────────

/** 010-1234-5678 모양 — 번호가 없으면 null */
export const phoneText = (phone: string | null | undefined): string | null => formatPhone(phone);

/** 전화 걸기 — 첫 번호만(features/phone-call) */
export { callPhone } from '../phone-call';

// ── 아바타 (웹 Avatar — initialsOf·personColor) ─────────────────────────────────────────────────────────

/** 이니셜(한글 이름은 끝 두 글자)과 사람 색 — 같은 사람은 어느 화면에서나 같은 색 */
export const avatarView = (name: string): { initials: string; color: string } => ({
  initials: initialsOf(name, name) || '?',
  color: personColor(name),
});

// ── 날짜 칸 (웹 editors/date-time-input.tsx) ────────────────────────────────────────────────────────────

/** 날짜 칸에 보일 글 — '11/9 (월) 14:00', 비었으면 '' */
export function dateFieldText(value: DateTimeValue, today: string): string {
  if (!value.date) return '';
  return `${shortDate(value.date, today)} (${weekdayOf(value.date)})${value.time ? ` ${value.time}` : ''}`;
}

/**
 * "시각 없음" 켜고 끄기(웹과 같다) — 켜면 시각을 비우고, 끄면 날짜가 있을 때 지금 시각을 넣는다(시각까지 있어야
 * 칸에 값이 보인다). 날짜만 있는 값은 "시각 없음"이 켜진 채로 연다(noTimeOf).
 */
export function toggleNoTime(value: DateTimeValue, noTime: boolean): DateTimeValue {
  if (noTime) return { date: value.date, time: '' };
  return value.date && !value.time ? { date: value.date, time: koreaNow().time } : value;
}

export const noTimeOf = (value: DateTimeValue): boolean => Boolean(value.date && !value.time);

/** 달력 한 달 — 일요일부터 한 주씩, 그 달이 아닌 칸은 null. month는 1~12 */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array<null>(first.getUTCDay()).fill(null)];
  for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** 날짜(YYYY-MM-DD)의 해·달 */
export const monthOf = (date: string): { year: number; month: number } => ({
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
});

/** 달 넘기기 — delta 달 뒤(앞) */
export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** '2026년 11월' */
export const monthTitle = (year: number, month: number): string => `${year}년 ${month}월`;

/** 시각 고르기 — 30분 간격 00:00~23:30 */
export const TIME_SLOTS: readonly string[] = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
);

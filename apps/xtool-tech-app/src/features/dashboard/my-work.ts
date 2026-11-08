import { useEffect, useMemo, useState } from 'react';
import { daysBetween, inRange, koreaToday, periodRange } from '@xtool-core/dates';
import { useCurrentMember } from '@xtool-core/member-context';
import { buildMyWork, MY_WORK_BOARDS, type MyWorkBoard } from '@xtool-core/my-work';
import { PERIOD_COMPARE, PERIOD_OPTIONS } from '@xtool-core/period';
import { BOARD_TABS } from '@xtool-core/tech-boards';
import { AlarmClock, CircleCheck, Hourglass, ListTodo } from 'lucide-react-native';
import { usePeriod } from '../kpis';
import { useMyIdentity, useWorkPeople, useWorkSources } from '../use-my-work';
import type { SegmentOption, StatCardData, WorkRowView } from '../../themes/dashboard/parts';
import { workRowView } from './part-data';

// 내 업무의 동작(대시보드 짜임) — 웹 my-work-page.tsx: 담당자 칸이 있는 보드에서 담당자가 그 사람인 건만. 기본은 나,
// who가 있으면 그 직원(팀원 화면에서 연다). 숫자 카드 넷(진행 중·임박·지남·14일 넘은 건·기간 완료), 상태·직원·보드·
// 검색으로 거르기, 20줄 + 더 보기. 줄을 누르면 그 보드의 상세(화면이 이동).

const PAGE = 20;
const STALE_DAYS = 14;

type State = 'open' | 'done' | 'all';
const STATES: readonly SegmentOption<State>[] = [
  { value: 'open', label: '진행 중' },
  { value: 'done', label: '완료' },
  { value: 'all', label: '전체' },
];

const labelOf = (key: MyWorkBoard) => BOARD_TABS.find(t => t.key === key)?.label ?? key;

export interface DashboardMyWorkModel {
  /** 머리 제목 — 내 업무 / {이름}님의 업무 */
  screenTitle: string;
  /** 판 제목 — 내 담당 업무 / {이름}님 담당 업무 / 직원 업무 */
  title: string;
  subtitle: string;
  loading: boolean;
  kpis: StatCardData[];
  period: ReturnType<typeof usePeriod>;
  periodOptions: typeof PERIOD_OPTIONS;
  state: State;
  setState: (state: State) => void;
  states: readonly SegmentOption<State>[];
  query: string;
  setQuery: (q: string) => void;
  /** 직원 고르기 — value null은 나 */
  person: { label: string; options: { value: string | null; label: string; count?: number }[]; value: string | null };
  setPerson: (name: string | null) => void;
  /** 보드 고르기 — '' 은 보드 전체 */
  board: { label: string; options: { value: '' | MyWorkBoard; label: string }[]; value: '' | MyWorkBoard };
  setBoard: (board: '' | MyWorkBoard) => void;
  rows: WorkRowView[];
  empty: string | null;
  more: { remaining: number; onPress: () => void } | null;
}

export function useDashboardMyWork(who?: string): DashboardMyWorkModel {
  const me = useMyIdentity();
  const { sources, loading } = useWorkSources();
  const period = usePeriod();
  const today = koreaToday();
  const isTech = useCurrentMember()?.teams.tech === true;
  const people = useWorkPeople(sources, today);
  const [viewing, setViewing] = useState<string | null>(who ?? null);

  const mine = isTech && (!viewing || me.names.has(viewing));
  const names = useMemo(() => (mine ? me.names : new Set(viewing ? [viewing] : [])), [mine, me.names, viewing]);
  const items = useMemo(() => buildMyWork(sources, names, today, { includeDone: true }), [sources, names, today]);

  const [state, setStateRaw] = useState<State>('open');
  const [board, setBoardRaw] = useState<'' | MyWorkBoard>('');
  const [query, setQueryRaw] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const reset =
    <T>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setLimit(PAGE);
    };

  const open = items.filter(i => !i.done);
  const urgent = open.filter(i => i.urgent);
  const stale = open.filter(i => i.since && daysBetween(i.since.date, today) >= STALE_DAYS);
  const { current } = periodRange(period.period, today);
  const doneInPeriod = items.filter(i => i.done && inRange(i.doneAt, current));

  const q = query.trim().toLowerCase();
  const shown = items.filter(
    i =>
      (state === 'all' || (state === 'done') === i.done) &&
      (!board || i.boardKey === board) &&
      (!q || `${i.name} ${i.boardLabel} ${i.stage ?? ''}`.toLowerCase().includes(q)),
  );
  const boardCounts = MY_WORK_BOARDS.map(key => ({ key, count: open.filter(i => i.boardKey === key).length }));

  // 직원 목록 — 나(기술팀원이면) + 다른 직원, 고른 사람이 명단에 없으면 맨 앞에(웹과 같다)
  const others = people.map(p => p.name).filter(n => !isTech || !me.names.has(n));
  const firstPerson = others[0];
  // 기술팀원이 아니면(관리자 등) "나"가 없다 — 첫 직원으로
  useEffect(() => {
    if (!isTech && !viewing && firstPerson) setViewing(firstPerson);
  }, [isTech, viewing, firstPerson]);
  if (viewing && !mine && !others.includes(viewing)) others.unshift(viewing);
  const openOf = new Map(people.map(p => [p.name, p.open]));
  const meLabel = me.name ? `나 (${me.name})` : '나';

  return {
    screenTitle: who ? `${who}님의 업무` : viewing && !mine ? `${viewing}님의 업무` : '내 업무',
    title: mine ? '내 담당 업무' : viewing ? `${viewing}님 담당 업무` : '직원 업무',
    subtitle: loading
      ? '불러오는 중…'
      : `진행 중 ${open.length}건 · ${
          boardCounts
            .filter(b => b.count > 0)
            .map(b => `${labelOf(b.key)} ${b.count}`)
            .join(' · ') || '담당 보드 없음'
        }`,
    loading,
    kpis: [
      { key: 'open', title: '진행 중', value: `${open.length}건`, icon: ListTodo, tint: 'amber' },
      { key: 'urgent', title: '임박·지남', value: `${urgent.length}건`, icon: AlarmClock, tint: 'violet' },
      { key: 'stale', title: `${STALE_DAYS}일 넘은 건`, value: `${stale.length}건`, icon: Hourglass, tint: 'blue' },
      {
        key: 'done',
        title: `${PERIOD_COMPARE[period.period].current} 완료`,
        value: `${doneInPeriod.length}건`,
        icon: CircleCheck,
        tint: 'green',
      },
    ],
    period,
    periodOptions: PERIOD_OPTIONS,
    state,
    setState: reset(setStateRaw),
    states: STATES,
    query,
    setQuery: reset(setQueryRaw),
    person: {
      label: mine ? meLabel : viewing ?? '직원',
      options: [
        ...(isTech ? [{ value: null, label: meLabel }] : []),
        ...others.map(name => ({ value: name, label: name, count: openOf.get(name) })),
      ],
      value: mine ? null : viewing,
    },
    setPerson: name => {
      setViewing(name);
      setLimit(PAGE);
    },
    board: {
      label: board ? labelOf(board) : '보드 전체',
      options: [{ value: '', label: '보드 전체' }, ...MY_WORK_BOARDS.map(key => ({ value: key, label: labelOf(key) }))],
      value: board,
    },
    setBoard: reset(setBoardRaw),
    rows: shown.slice(0, limit).map(item => workRowView(item, today)),
    empty:
      !loading && shown.length === 0
        ? items.length === 0
          ? '담당 업무가 없어요.'
          : '조건에 맞는 업무가 없어요.'
        : null,
    more: shown.length > limit ? { remaining: shown.length - limit, onPress: () => setLimit(n => n + PAGE) } : null,
  };
}

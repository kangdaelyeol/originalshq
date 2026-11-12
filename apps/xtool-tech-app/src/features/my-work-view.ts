import { useMemo, useState } from 'react';
import { koreaToday } from '@xtool-core/dates';
import { useCurrentMember } from '@xtool-core/member-context';
import { matchesItem, visibleColumns } from '@xtool-core/monday-values';
import { buildMyWork, type MyWorkItem, type WorkPerson } from '@xtool-core/my-work';
import { BOARD_TABS, type TechBoardKey } from '@xtool-core/tech-boards';
import { useTechBoard } from '@xtool-core/tech-boards-store';
import { buildGroups, type GroupBlock } from './board-model';
import { useMyIdentity, useWorkPeople, useWorkSources, type MyIdentity } from './use-my-work';

// 내 업무의 동작 — 모든 레이아웃이 같이 쓴다. 누구의 업무인지(나 또는 고른 직원, 웹 ?who=), 진행 중·완료·전체,
// 검색, 보드별 묶음. 모양(상자·카드·숫자 카드)은 각 테마 화면이 그린다.

export type WorkState = 'open' | 'done' | 'all';
export const WORK_STATES: readonly { value: WorkState; label: string }[] = [
  { value: 'open', label: '진행 중' },
  { value: 'done', label: '완료' },
  { value: 'all', label: '전체' },
];

export interface MyWorkViewModel {
  me: MyIdentity;
  /** 기술팀원인지 — 아니면 "나"가 없다(관리자 등) */
  isTech: boolean;
  /** 지금 보는 것이 나인지 */
  mine: boolean;
  /** 고른 직원(나면 null) */
  viewing: string | null;
  setViewing: (name: string | null) => void;
  title: string;
  /** 도구 줄 사람 단추 글자 — "나 · 이름" 또는 직원 이름 */
  personLabel: string;
  people: WorkPerson[];
  /** 나의 진행 중 건수(사람 고르기 목록) */
  myOpen: number;
  state: WorkState;
  setState: (state: WorkState) => void;
  query: string;
  setQuery: (q: string) => void;
  needle: string;
  /** 그 사람의 모든 업무(완료 포함) */
  all: MyWorkItem[];
  /** 진행 중·완료·전체로 거른 것 */
  shown: MyWorkItem[];
  /** 보드별 묶음 — 보드 메뉴 순서, 거른 항목이 있는 보드만 */
  boxes: { boardKey: TechBoardKey; label: string; items: MyWorkItem[] }[];
  loading: boolean;
  today: string;
}

export function useMyWorkView(who?: string): MyWorkViewModel {
  const me = useMyIdentity();
  const isTech = useCurrentMember()?.teams.tech === true;
  const { sources, loading } = useWorkSources();
  const today = koreaToday();
  const people = useWorkPeople(sources, today);
  const [state, setState] = useState<WorkState>('open');
  const [query, setQuery] = useState('');
  const [viewing, setViewing] = useState<string | null>(who ?? null);

  const mine = isTech && (!viewing || me.names.has(viewing));
  const names = useMemo(() => (mine ? me.names : new Set(viewing ? [viewing] : [])), [mine, me.names, viewing]);
  const all = useMemo(() => buildMyWork(sources, names, today, { includeDone: true }), [sources, names, today]);
  const shown = useMemo(
    () => all.filter(i => (state === 'open' ? !i.done : state === 'done' ? i.done : true)),
    [all, state],
  );
  const boxes = useMemo(() => {
    const byBoard = new Map<TechBoardKey, MyWorkItem[]>();
    for (const item of shown) byBoard.set(item.boardKey, [...(byBoard.get(item.boardKey) ?? []), item]);
    return BOARD_TABS.filter(t => byBoard.has(t.key)).map(t => ({
      boardKey: t.key,
      label: t.label,
      items: byBoard.get(t.key)!,
    }));
  }, [shown]);

  return {
    me,
    isTech,
    mine,
    viewing,
    setViewing,
    title: who ? `${who}님의 업무` : viewing && !mine ? `${viewing}님의 업무` : '내 업무',
    personLabel: mine ? `나 · ${me.name ?? ''}` : viewing ?? '사람',
    people,
    myOpen: people.filter(p => me.names.has(p.name)).reduce((sum, p) => sum + p.open, 0),
    state,
    setState,
    query,
    setQuery,
    needle: query.trim().toLowerCase(),
    all,
    shown,
    boxes,
    loading,
    today,
  };
}

/** 내 업무 상자 하나 — 그 보드의 실시간 항목 중 내 것만, 검색어로 거르고 그룹으로 나눈다. */
export function useWorkBox(boardKey: TechBoardKey, ids: ReadonlySet<string>, needle: string) {
  const state = useTechBoard(boardKey);
  const { meta, items } = state;
  const columns = useMemo(() => (meta ? visibleColumns(meta) : []), [meta]);
  const people = useMemo(() => columns.filter(c => c.type === 'people' || c.type === 'assignee'), [columns]);
  const mine = useMemo(
    () => (items ?? []).filter(i => ids.has(i.itemId) && matchesItem(i, people, needle, null)),
    [items, ids, people, needle],
  );
  const groups: GroupBlock[] = useMemo(
    () => (meta ? buildGroups(meta, mine, { sort: null }).filter(g => g.items.length > 0) : []),
    [meta, mine],
  );
  return { meta, columns, items: mine, groups };
}

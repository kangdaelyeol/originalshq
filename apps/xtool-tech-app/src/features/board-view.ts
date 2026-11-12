import { useDeferredValue, useMemo, useState } from 'react';
import {
  groupIdOf,
  ITEM_NOUN,
  matchesItem,
  NAME_TITLE,
  nextSort,
  OTHER_GROUP,
  PHONE_IN_NAME_BOARDS,
  splitNamePhone,
  splitNames,
  UPDATE_BOARDS,
  viewColumns,
  visibleColumns,
  type MonSort,
} from '@xtool-core/monday-values';
import { BOARD_TABS, type TechBoardKey, type TechColumn, type TechItemDoc } from '@xtool-core/tech-boards';
import { useTechBoard } from '@xtool-core/tech-boards-store';
import { createItem } from '@xtool-core/tech-outbox';
import { applyViewRules, NAME_COLUMN, ruleReady, useBoardViews, type BoardView } from '@xtool-core/tech-views';
import { buildGroups, type GroupBlock, type SortNames } from './board-model';
import { useOpenGroups } from './open-groups';
import { usePref } from './prefs';

// 보드 화면의 동작 — 모든 레이아웃(Monday 표·대시보드·물)이 같이 쓴다. 보기(저장된 조건·정렬·숨길 칸), 검색, 담당자로
// 거르기, 정렬, 그룹(접기), 새 항목. 모양(카드·표·숫자 카드)은 각 테마 화면이 그린다.
// 그룹은 앱을 켜고 처음 열면 모두 접혀 있고, 펼친 그룹은 앱이 켜져 있는 동안 보드마다 기억한다(open-groups — 기기에
// 남기지 않는다, 2026-11-12). 검색어·사람으로 찾는 중에는 찾은 것이 가려지지 않게 그룹을 펼쳐 보이고, 그때 접은 것은
// 찾기가 바뀌거나 끝나면 잊는다(찾기 전의 펼침은 그대로).

export const boardLabel = (key: TechBoardKey) => BOARD_TABS.find(t => t.key === key)?.label ?? key;
const PEOPLE_TYPES = new Set(['people', 'assignee']);
const NO_GROUPS: ReadonlySet<string> = new Set();

// 보드를 열 때의 정렬(보기에 정렬이 저장돼 있으면 그것이 먼저) — 칸은 제목·종류로 찾고, 못 찾으면 정렬 없이.
// 출장업무·AS·아톡문의는 접수일 최근 먼저(2026-11-11). 접수 날짜 칸은 보드마다 "접수일"·"접수일자"라 띄어쓰기를 빼고
// "접수일"이 든 날짜 칸으로 찾는다.
const isReceivedDate = (c: TechColumn) => c.type === 'date' && c.title.replace(/\s/g, '').includes('접수일');
const RECEIVED_DESC = { column: isReceivedDate, dir: -1 } as const;
const DEFAULT_SORT: Partial<Record<TechBoardKey, { column: (c: TechColumn) => boolean; dir: 1 | -1 }>> = {
  fieldService: RECEIVED_DESC,
  repair: RECEIVED_DESC,
  techInquiry: RECEIVED_DESC,
};

const defaultSort = (boardKey: TechBoardKey, columns: TechColumn[]): MonSort => {
  const want = DEFAULT_SORT[boardKey];
  const column = want ? columns.find(want.column) : undefined;
  return want && column ? { columnId: column.id, dir: want.dir } : null;
};

export interface BoardViewModel {
  boardKey: TechBoardKey;
  /** Monday 보드 이름(없으면 메뉴 이름) */
  title: string;
  /** 메뉴 이름(출장업무·AS …) */
  label: string;
  /** 항목을 부르는 말(고객·업무 …)과 이름 칸 머리글 */
  noun: string;
  nameTitle: string;
  state: ReturnType<typeof useTechBoard>;
  /** 보기 탭 — 첫 탭은 메인 테이블(value '') */
  viewTabs: { value: string; label: string }[];
  viewId: string;
  setViewId: (id: string) => void;
  /** 보이는 칸 전부 / 고른 보기에서 숨긴 칸을 뺀 것 */
  columns: TechColumn[];
  shownColumns: TechColumn[];
  peopleColumns: TechColumn[];
  statusColumn: TechColumn | undefined;
  query: string;
  setQuery: (q: string) => void;
  person: string | null;
  setPerson: (name: string | null) => void;
  /** 담당자로 거를 사람 — [이름, 건수], 많은 순 */
  people: [string, number][];
  sort: MonSort;
  /** 누를 때마다 오름차순 → 내림차순 → 해제(웹 머리글 정렬) */
  cycleSort: (columnId: string) => void;
  clearSort: () => void;
  sortLabel: string;
  /** 정렬할 수 있는 칸 — 이름 칸 + 보이는 칸 */
  sortChoices: TechColumn[];
  /** 보기·검색·사람으로 거른 항목 */
  filtered: TechItemDoc[];
  filtering: boolean;
  /** 그룹 — 거르는 중이면 빈 그룹은 뺀다 */
  groups: GroupBlock[];
  /** 모든 그룹(빈 그룹 포함 — 새 항목 그룹 고르기) */
  allGroups: GroupBlock[];
  isCollapsed: (groupId: string) => boolean;
  toggleGroup: (groupId: string) => void;
  /** 이 기기에 남긴 보기를 다 읽었는지 — 읽기 전에 그리면 메인 테이블로 한 번 더 그린다 */
  prefsReady: boolean;
  allCollapsed: boolean;
  toggleAll: () => void;
  /** 보일 이름 — 출장업무는 이름에 적힌 전화번호를 뗀다 */
  nameOf: (item: TechItemDoc) => string;
  /** 업데이트 말풍선 개수 — 업데이트가 없는 보드·만드는 중인 항목은 undefined */
  updatesOf: (item: TechItemDoc) => number | undefined;
  /** 새 항목 — 그룹 맨 아래에 바로 생기고 뒤에서 저장된다 */
  create: (name: string, groupId: string) => void;
  // ── 아래는 웹 Monday 표(monday-board.tsx)에 맞춘 것 ──
  /** 팀이 저장한 보기 전부(불러오는 중이면 null) · 고른 보기 */
  views: BoardView[] | null;
  view: BoardView | null;
  /** 보기 고르기 — 정렬은 그 보기의 정렬로 다시 시작한다(웹과 같다) */
  selectView: (id: string) => void;
  /** 검색어·사람으로 거르는 중 — "N개 찾음" */
  searching: boolean;
  /** 고른 보기의 다 적은 조건 수 — 도구 줄 "조건 / N" */
  readyRules: number;
  /** 빈 그룹을 숨길 때(검색·사람·조건) — 웹 hideEmptyGroups */
  hideEmptyGroups: boolean;
  /** 정렬 메뉴 — 다른 칸이면 오름차순, 같은 칸이면 방향만 바꾼다(웹 정렬 메뉴 "한 번 더 누르면 반대로") */
  pickSort: (columnId: string) => void;
  /** 그룹 맨 아래 "+ 추가" — "그 밖의 항목"이면 그룹 없이 만든다(웹 addItem) */
  addItem: (groupId: string, name: string) => void;
}

export function useBoardView(boardKey: TechBoardKey): BoardViewModel {
  const state = useTechBoard(boardKey);
  const { meta, items } = state;
  const { views } = useBoardViews(boardKey);
  const [viewId, setViewId, viewReady] = usePref<string>(`xtool-tech:monday-view:${boardKey}`, '');
  const [open, setOpen] = useOpenGroups(boardKey);
  const [query, setQuery] = useState('');
  const [person, setPerson] = useState<string | null>(null);
  const [localSort, setLocalSort] = useState<MonSort | undefined>(undefined);

  const view = views?.find(v => v.id === viewId) ?? null;
  const columns = useMemo(() => (meta ? visibleColumns(meta) : []), [meta]);
  const shownColumns = useMemo(() => columns.filter(c => !view?.hidden.includes(c.id)), [columns, view]);
  const peopleColumns = useMemo(() => columns.filter(c => PEOPLE_TYPES.has(c.type)), [columns]);
  const statusColumn = shownColumns.find(c => c.type === 'status');
  const initialSort = useMemo(() => defaultSort(boardKey, columns), [boardKey, columns]);
  // 직접 고른 정렬이 있으면 그것, 없으면 보기의 정렬, 그것도 없으면 보드의 기본 정렬(출장업무: 접수일 최근 먼저).
  // 직접 해제했으면 null
  const sort = localSort !== undefined ? localSort : view?.sort ?? initialSort;
  const sortColumn = sort && sort.columnId !== NAME_COLUMN ? columns.find(c => c.id === sort.columnId) : undefined;

  // 입력 칸은 바로 바뀌고, 거르기·그룹 만들기는 한 박자 늦게 따라간다(글자마다 전체 항목을 다시 거르지 않게)
  const deferredQuery = useDeferredValue(query);
  const needle = deferredQuery.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!meta || !items) return [];
    const ruled = view
      ? applyViewRules(items, view, viewColumns(meta, boardKey), item => groupIdOf(meta, item))
      : items;
    return ruled.filter(item => matchesItem(item, peopleColumns, needle, person));
  }, [meta, items, view, boardKey, peopleColumns, needle, person]);
  const filtering = Boolean(needle || person || view);

  const names = useMemo<SortNames>(
    () =>
      PHONE_IN_NAME_BOARDS.has(boardKey)
        ? { nameOf: item => splitNamePhone(item.name).label, namePhonesOf: item => splitNamePhone(item.name).phones }
        : {},
    [boardKey],
  );
  const allGroups = useMemo(
    () => (meta ? buildGroups(meta, filtered, { sortColumn, sort, names }) : []),
    [meta, filtered, sortColumn, sort, names],
  );
  const groups = filtering ? allGroups.filter(g => g.items.length > 0) : allGroups;
  const hideEmptyGroups = Boolean(needle || person) || (view?.rules.some(ruleReady) ?? false);
  // 찾는 중(검색어·사람)에는 펼쳐 보이고 그때 접은 것만 따로 — 찾기가 바뀌면 다시 모두 펼친다
  const searchKey = needle || person ? `${needle}\u0000${person ?? ''}` : '';
  const [searchClosed, setSearchClosed] = useState<{ key: string; ids: ReadonlySet<string> }>({
    key: '',
    ids: new Set(),
  });
  const closedInSearch = searchClosed.key === searchKey ? searchClosed.ids : NO_GROUPS;
  const isCollapsed = (id: string) => (searchKey ? closedInSearch.has(id) : !open.has(id));
  const allCollapsed = groups.length > 0 && groups.every(g => isCollapsed(g.id));

  const people = useMemo(() => {
    const count = new Map<string, number>();
    for (const item of items ?? [])
      for (const c of peopleColumns)
        for (const name of splitNames(item.values[c.id]?.text)) count.set(name, (count.get(name) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
  }, [items, peopleColumns]);

  const nameTitle = NAME_TITLE[boardKey];
  const sortLabel = sort
    ? `${sort.columnId === NAME_COLUMN ? nameTitle : sortColumn?.title ?? '정렬'} ${sort.dir === 1 ? '↑' : '↓'}`
    : '정렬';

  return {
    boardKey,
    title: meta?.name || boardLabel(boardKey),
    label: boardLabel(boardKey),
    noun: ITEM_NOUN[boardKey],
    nameTitle,
    state,
    viewTabs: [{ value: '', label: '메인 테이블' }, ...(views ?? []).map(v => ({ value: v.id, label: v.name }))],
    viewId: view ? view.id : '',
    setViewId,
    columns,
    shownColumns,
    peopleColumns,
    statusColumn,
    query,
    setQuery,
    person,
    setPerson,
    people,
    sort,
    cycleSort: columnId => setLocalSort(nextSort(sort, columnId)),
    clearSort: () => setLocalSort(null),
    sortLabel,
    sortChoices: [{ id: NAME_COLUMN, title: nameTitle, type: 'name', writable: false }, ...shownColumns],
    filtered,
    filtering,
    groups,
    allGroups,
    isCollapsed,
    toggleGroup: id => {
      const toggled = (ids: ReadonlySet<string>) => {
        const next = new Set(ids);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      };
      if (searchKey) setSearchClosed({ key: searchKey, ids: toggled(closedInSearch) });
      else setOpen(toggled(open));
    },
    prefsReady: viewReady,
    allCollapsed,
    // 보이는 그룹만 한꺼번에 — 보기 조건으로 가려진 그룹의 펼침은 그대로 둔다
    toggleAll: () => {
      const ids = groups.map(g => g.id);
      const plus = (set: ReadonlySet<string>) => new Set([...set, ...ids]);
      const minus = (set: ReadonlySet<string>) => new Set([...set].filter(id => !ids.includes(id)));
      if (searchKey) setSearchClosed({ key: searchKey, ids: allCollapsed ? minus(closedInSearch) : plus(closedInSearch) });
      else setOpen(allCollapsed ? plus(open) : minus(open));
    },
    nameOf: item => (PHONE_IN_NAME_BOARDS.has(boardKey) ? splitNamePhone(item.name).label : item.name),
    updatesOf: item => (UPDATE_BOARDS.has(boardKey) && !item.draft ? item.updateCount ?? 0 : undefined),
    create: (name, groupId) => {
      createItem(boardKey, { name, groupId });
    },
    views,
    view,
    selectView: id => {
      setViewId(id);
      setLocalSort(undefined);
    },
    searching: Boolean(needle || person),
    readyRules: view?.rules.filter(ruleReady).length ?? 0,
    hideEmptyGroups,
    pickSort: columnId =>
      setLocalSort(sort?.columnId === columnId ? { columnId, dir: sort.dir === 1 ? -1 : 1 } : { columnId, dir: 1 }),
    addItem: (groupId, name) => {
      const next = name.trim();
      if (next) createItem(boardKey, { name: next, groupId: groupId === OTHER_GROUP ? undefined : groupId });
    },
  };
}

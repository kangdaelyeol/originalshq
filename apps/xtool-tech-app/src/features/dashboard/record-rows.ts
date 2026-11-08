import { useCallback, useMemo, useState } from 'react';
import type { TechBoardKey } from '@xtool-core/tech-boards';
import { deleteItems, moveItems } from '@xtool-core/tech-outbox';
import { isDone } from '@xtool-core/tech-stage';

// 기록 목록의 줄 — 웹 components/board/use-record-rows.ts·record-sort.ts·record-selection.ts·use-selection-actions.ts를
// 그대로 옮긴 것. 대시보드 짜임(글라스·물)의 보드 화면이 같이 쓴다: 진행 중·완료·전체 / 담당자 / 검색으로 거르기,
// 칸 정렬(오름 → 내림 → 해제, 빈 값은 늘 뒤, 단계는 Monday 그룹 순서), 보드 기본 순서, "더 보기", 줄 고르기와 옮기기·지우기.

/** 목록에 올리는 기록 — 진행 중/완료는 단계·상태로 가른다(isDone) */
export interface RecordLike {
  itemId: string;
  stage: string | null;
  status: string | null;
}

/** 진행 상태 — 진행 중 / 완료 / 전체 */
export type RecordView = 'open' | 'done' | 'all';
export type SortDir = 'asc' | 'desc';

/** 칸 정렬 — 칸 열쇠와 방향 */
export interface RecordSort {
  key: string;
  dir: SortDir;
}

/** 정렬할 수 있는 칸(웹 RecordColumn에서 머리글·정렬 값만) */
export interface SortColumn<T> {
  key: string;
  header: string;
  sortValue: (record: T) => string | number | null | undefined;
}

/** 처음에 보여 줄 줄 수 — 완료 목록은 수백 건이라 "더 보기"로 늘린다 */
export const RECORD_PAGE = 30;

export const DELETE_CONFIRM_MESSAGE = 'Monday 휴지통으로 가요. 30일 안에는 Monday에서 되살릴 수 있어요.';

const isBlank = (v: unknown) => v === null || v === undefined || v === '';

/** 빈 값은 늘 뒤로, 숫자는 크기, 글자는 한국어 순서 */
export function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  dir: SortDir,
): number {
  if (isBlank(a) || isBlank(b)) return isBlank(a) === isBlank(b) ? 0 : isBlank(a) ? 1 : -1;
  const diff =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), 'ko', { numeric: true });
  return dir === 'asc' ? diff : -diff;
}

interface RecordRowsOptions<T extends RecordLike> {
  records: readonly T[];
  columns: readonly SortColumn<T>[];
  assigneesOf: (record: T) => string[];
  /** 검색에 쓰는 글자(이름·기기·내용 등을 이어 붙인 것) */
  searchOf: (record: T) => string;
  /** 진행 중 / 완료 목록의 순서 — 생략하면 Monday 순서 그대로 */
  sortOpen?: (a: T, b: T) => number;
  sortDone?: (a: T, b: T) => number;
  /** 진행 중/완료 구분이 있는 보드 — 없으면 처음부터 전체 */
  progress: boolean;
  /** Monday 그룹 이름 순서 — 단계 칸 정렬에 쓴다 */
  groupOrder?: readonly string[];
  pageSize?: number;
}

export interface RecordRows<T> {
  view: RecordView;
  setView: (view: RecordView) => void;
  /** 진행 중 N · 완료 N · 전체 N */
  viewOptions: { value: RecordView; label: string }[];
  /** 고른 담당자('' = 전체) */
  assignee: string;
  setAssignee: (name: string) => void;
  /** 담당자 고르기 목록 — 맡은 건이 많은 순 */
  people: string[];
  query: string;
  setQuery: (q: string) => void;
  sort: RecordSort | null;
  /** 칸 누르기 — 오름차순 → 내림차순 → 기본 순서 */
  toggleSort: (key: string) => void;
  /** 보드 기본 순서로 */
  clearSort: () => void;
  /** 거르고 늘어놓은 줄 전부 */
  rows: T[];
  /** 지금 보이는 줄(처음 limit줄) */
  visible: T[];
  limit: number;
  /** 더 보기 — pageSize줄 더 */
  more: () => void;
  /** 줄이 없을 때의 안내 */
  emptyText: string;
}

/**
 * 거른·늘어놓은 줄과 고르는 상태. 칸 정렬이 있으면 그 칸 값으로(단계 칸은 Monday 그룹 순서, 빈 값은 늘 뒤), 없으면
 * 보드 기본 순서(진행 중 sortOpen, 완료·전체 sortDone). 거르는 조건·정렬을 바꾸면 다시 처음 줄 수로.
 */
export function useRecordRows<T extends RecordLike>({
  records,
  columns,
  assigneesOf,
  searchOf,
  sortOpen,
  sortDone,
  progress,
  groupOrder,
  pageSize = RECORD_PAGE,
}: RecordRowsOptions<T>): RecordRows<T> {
  const [view, setViewState] = useState<RecordView>(progress ? 'open' : 'all');
  const [assignee, setAssigneeState] = useState('');
  const [query, setQueryState] = useState('');
  const [limit, setLimit] = useState(pageSize);
  const [sort, setSort] = useState<RecordSort | null>(null);

  const openCount = useMemo(() => records.filter(r => !isDone(r)).length, [records]);
  const viewOptions = [
    { value: 'open' as const, label: `진행 중 ${openCount}` },
    { value: 'done' as const, label: `완료 ${records.length - openCount}` },
    { value: 'all' as const, label: `전체 ${records.length}` },
  ];

  const people = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of records) for (const name of assigneesOf(r)) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [records, assigneesOf]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = records.filter(
      r =>
        (view === 'all' || (view === 'done') === isDone(r)) &&
        (!assignee || assigneesOf(r).includes(assignee)) &&
        (!needle || searchOf(r).toLowerCase().includes(needle)),
    );
    const column = sort && columns.find(c => c.key === sort.key);
    if (sort && column) {
      const valueOf =
        column.key === 'stage' && groupOrder
          ? (r: T) => {
              const i = groupOrder.indexOf(r.stage ?? '');
              return i < 0 ? null : i;
            }
          : column.sortValue;
      return [...filtered].sort((a, b) => compareValues(valueOf(a), valueOf(b), sort.dir));
    }
    if (view === 'open' && sortOpen) return [...filtered].sort(sortOpen);
    if (view !== 'open' && sortDone) return [...filtered].sort(sortDone);
    return filtered;
  }, [records, view, assignee, query, assigneesOf, searchOf, sortOpen, sortDone, sort, columns, groupOrder]);

  const reset =
    <V>(set: (value: V) => void) =>
    (value: V) => {
      set(value);
      setLimit(pageSize);
    };

  return {
    view,
    setView: reset(setViewState),
    viewOptions,
    assignee,
    setAssignee: reset(setAssigneeState),
    people,
    query,
    setQuery: reset(setQueryState),
    sort,
    toggleSort: key => {
      setSort(s => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));
      setLimit(pageSize);
    },
    clearSort: () => {
      setSort(null);
      setLimit(pageSize);
    },
    rows,
    visible: rows.slice(0, limit),
    limit,
    more: () => setLimit(n => n + pageSize),
    emptyText:
      query || assignee ? '조건에 맞는 기록이 없어요.' : view === 'open' ? '진행 중인 건이 없어요.' : '기록이 없어요.',
  };
}

/** 정렬 칩 글 — '정렬' 또는 '방문 일정 ↑' */
export function sortLabel<T>(sort: RecordSort | null, columns: readonly SortColumn<T>[]): string {
  if (!sort) return '정렬';
  const column = columns.find(c => c.key === sort.key);
  return `${column?.header ?? '정렬'} ${sort.dir === 'asc' ? '↑' : '↓'}`;
}

// ── 줄 고르기 ──────────────────────────────────────────────────────────────────────────────────────────────

export interface RecordSelection {
  /** 고른 줄 — 지금 목록에 있는 것만(지운 줄은 저절로 빠진다) */
  selected: ReadonlySet<string>;
  /** 하나 켜고 끄기 */
  toggle: (itemId: string) => void;
  /** 여러 개를 한 번에 */
  set: (itemIds: readonly string[], on: boolean) => void;
  clear: () => void;
}

/** ids는 이 보드의 모든 항목 id — 지우거나 다른 곳에서 사라진 줄은 고른 것에서 빠진다 */
export function useRecordSelection(ids: readonly string[]): RecordSelection {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const selected = useMemo(() => {
    if (picked.size === 0) return picked;
    const have = new Set(ids);
    return new Set([...picked].filter(id => have.has(id)));
  }, [picked, ids]);
  const set = useCallback((itemIds: readonly string[], on: boolean) => {
    setPicked(prev => {
      const next = new Set(prev);
      for (const id of itemIds) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);
  const toggle = useCallback(
    (itemId: string) =>
      setPicked(prev => {
        const next = new Set(prev);
        if (next.has(itemId)) next.delete(itemId);
        else next.add(itemId);
        return next;
      }),
    [],
  );
  const clear = useCallback(() => setPicked(new Set()), []);
  return { selected, toggle, set, clear };
}

export interface SelectionActions {
  count: number;
  /** 이동 시트(어느 진행 단계로) 열림 */
  moving: boolean;
  openMove: () => void;
  closeMove: () => void;
  /** 고른 것을 모두 그 그룹(진행 단계)으로 — 바로 보이고 Monday에는 뒤에서(실패하면 토스트) */
  move: (groupId: string) => void;
  /** 지울지 묻는 중 */
  confirming: boolean;
  askDelete: () => void;
  cancelDelete: () => void;
  /** 확인 — 고른 것을 모두 지우고(Monday 휴지통) 고르기를 푼다 */
  confirmDelete: () => void;
}

/** 고른 줄 옮기기·지우기 — 웹 use-selection-actions(보드 하나). 옮기거나 지우면 고르기를 푼다. */
export function useSelectionActions(
  boardKey: TechBoardKey,
  selected: ReadonlySet<string>,
  clear: () => void,
): SelectionActions {
  const [moving, setMoving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return {
    count: selected.size,
    moving,
    openMove: () => setMoving(true),
    closeMove: () => setMoving(false),
    move: groupId => {
      setMoving(false);
      moveItems(boardKey, [...selected], groupId);
      clear();
    },
    confirming,
    askDelete: () => setConfirming(true),
    cancelDelete: () => setConfirming(false),
    confirmDelete: () => {
      setConfirming(false);
      deleteItems(boardKey, [...selected]);
      clear();
    },
  };
}

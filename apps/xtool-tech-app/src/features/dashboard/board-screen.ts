import { useMemo } from 'react';
import { koreaToday } from '@xtool-core/dates';
import { PERIOD_OPTIONS } from '@xtool-core/period';
import { BOARD_TABS, type TechBoardKey } from '@xtool-core/tech-boards';
import { useTechBoard } from '@xtool-core/tech-boards-store';
import { usePendingSaves } from '@xtool-core/tech-save-queue';
import { UPDATE_BOARDS } from '@xtool-core/use-item-updates';
import { KPI_ICONS, useBoardKpis, usePeriod } from '../kpis';
import type { RecordRowData, StatCardData } from '../../themes/dashboard/parts';
import { dashboardBoard, type SidePanel } from './boards';
import type { RecordLike } from './record-rows';
import {
  sortLabel,
  useRecordRows,
  useRecordSelection,
  useSelectionActions,
  type RecordRows,
  type RecordSelection,
  type SelectionActions,
} from './record-rows';

// 대시보드 보드 화면의 동작 — 웹 board-page.tsx + boards/*-board.tsx(대시보드 짜임). 상태(불러오는 중·오류·동기화 안 됨),
// 숫자 카드(기간), 목록(거르기·정렬·더 보기·고르기·옮기기·지우기), 옆 판. 모양은 themes/dashboard 화면이 그린다.

export type BoardPhase = 'error' | 'unsynced' | 'loading' | 'ready';

export interface DashboardBoardModel {
  boardKey: TechBoardKey;
  /** 메뉴 이름(출장업무 …) */
  label: string;
  /** Monday 보드 이름(없으면 메뉴 이름) */
  title: string;
  phase: BoardPhase;
  error: string | null;
  /** 숫자 카드 — 아직이면 null */
  kpis: StatCardData[] | null;
  period: ReturnType<typeof usePeriod>;
  periodOptions: typeof PERIOD_OPTIONS;
  listTitle: string;
  searchPlaceholder: string;
  progress: boolean;
  list: RecordRows<RecordLike>;
  /** 정렬 고르기 — 칸 이름 순서(웹 머리글) */
  sortChoices: { key: string; label: string }[];
  sortLabel: string;
  /** 지금 보이는 줄(말풍선·저장 중 포함) */
  rows: RecordRowData[];
  /** 남은 줄 — 없으면 null */
  more: { remaining: number; onPress: () => void } | null;
  /** 업데이트 말풍선이 있는 보드 */
  updatesBoard: boolean;
  side: SidePanel[];
  /** 고칠 수 있는지 — 보드 정보(meta)가 왔으면 새로 만들기·고르기·옮기기·지우기 */
  canEdit: boolean;
  selection: RecordSelection;
  actions: SelectionActions;
  /** 옮길 수 있는 진행 단계(그룹) */
  groups: { id: string; title: string }[];
}

/** 보드 하나 — open은 줄·옆 판을 눌렀을 때(상세 화면으로) */
export function useDashboardBoard(boardKey: TechBoardKey, open: (itemId: string) => void): DashboardBoardModel {
  const state = useTechBoard(boardKey);
  const period = usePeriod();
  const kpiCards = useBoardKpis(boardKey);
  const def = dashboardBoard(boardKey);
  const today = koreaToday();
  const saving = usePendingSaves();

  const records = useMemo(() => (state.board ? def.records(state.board) : []), [state.board, def]);
  const groupOrder = useMemo(() => state.meta?.groups.map(g => g.title), [state.meta]);
  const list = useRecordRows({
    records,
    columns: def.columns,
    assigneesOf: def.assigneesOf,
    searchOf: def.searchOf,
    sortOpen: def.sortOpen,
    sortDone: def.sortDone,
    progress: def.progress,
    groupOrder,
  });
  const ids = useMemo(() => records.map(r => r.itemId), [records]);
  const selection = useRecordSelection(ids);
  const actions = useSelectionActions(boardKey, selection.selected, selection.clear);

  const updatesBoard = UPDATE_BOARDS.has(boardKey);
  const rows = list.visible.map(r => ({
    ...def.row(r, today),
    updates: updatesBoard ? state.itemsById.get(r.itemId)?.updateCount ?? 0 : null,
    saving: saving.has(r.itemId),
  }));
  const side = state.board ? def.side(state.board, records, { period: period.period, today, open }) : [];

  const label = BOARD_TABS.find(t => t.key === boardKey)?.label ?? boardKey;
  const phase: BoardPhase =
    state.error && !state.board
      ? 'error'
      : state.metaLoaded && !state.meta
      ? 'unsynced'
      : !state.board || !state.meta
      ? 'loading'
      : 'ready';

  return {
    boardKey,
    label,
    title: state.meta?.name || state.board?.name || label,
    phase,
    error: state.error,
    kpis: kpiCards
      ? kpiCards.map(card => ({
          key: card.key,
          title: card.title,
          value: card.value,
          icon: KPI_ICONS[card.icon],
          tint: card.tint,
          caption: card.caption,
        }))
      : null,
    period,
    periodOptions: PERIOD_OPTIONS,
    listTitle: def.listTitle,
    searchPlaceholder: def.searchPlaceholder,
    progress: def.progress,
    list: list as unknown as RecordRows<RecordLike>,
    sortChoices: def.columns.map(c => ({ key: c.key, label: c.header })),
    sortLabel: sortLabel(list.sort, def.columns),
    rows,
    more: list.rows.length > list.limit ? { remaining: list.rows.length - list.limit, onPress: list.more } : null,
    updatesBoard,
    side,
    canEdit: !!state.meta,
    selection,
    actions,
    groups: state.meta?.groups ?? [],
  };
}

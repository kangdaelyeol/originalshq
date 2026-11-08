import { useMemo } from 'react';
import { koreaToday } from '@xtool-core/dates';
import { BOARD_TABS, type TechBoardKey, type TechItemDoc } from '@xtool-core/tech-boards';
import { useTechBoard } from '@xtool-core/tech-boards-store';
import { deleteItems } from '@xtool-core/tech-outbox';
import { UPDATE_BOARDS } from '@xtool-core/use-item-updates';
import type { PillData, StageValue } from '../../themes/dashboard/parts';
import { dashboardBoard, type DetailSpec } from './boards';

// 대시보드 상세 화면의 동작 — 웹 RecordDrawer(보드 화면·내 업무가 같이 여는 상세 서랍). 보드 기록(정리된 record)과 캐시
// 항목(칸 값·파일·업데이트 수)을 itemId로 잇고, 보드마다 정한 칸·긴 글·작은 목록을 준다. 지우기는 Monday 휴지통(확인은
// 화면이). 편집은 item-editor.ts.

export type ItemPanel = 'info' | 'updates';

// 다음에 열 상세의 처음 탭 — 목록의 말풍선을 누르면 업데이트 탭으로 연다(웹 ?panel=updates). 이동 경로에 칸을 더하지
// 않으려고 여기 한 번 남기고, 상세 화면이 처음 그릴 때 가져간다.
let nextPanel: { itemId: string; panel: ItemPanel } | null = null;

export const requestPanel = (itemId: string, panel: ItemPanel): void => {
  nextPanel = { itemId, panel };
};

/** 이 항목에 남긴 처음 탭(한 번만) — 없으면 정보 */
export function takePanel(itemId: string): ItemPanel {
  const panel = nextPanel?.itemId === itemId ? nextPanel.panel : 'info';
  nextPanel = null;
  return panel;
}

export interface DashboardItemModel {
  boardKey: TechBoardKey;
  /** 보드 이름(상세 이름 위 한 줄) */
  boardName: string;
  phase: 'loading' | 'missing' | 'error' | 'ready';
  error: string | null;
  itemId: string;
  name: string;
  stage: StageValue | null;
  pill: PillData | null;
  detail: DetailSpec | null;
  /** 캐시 항목(칸 값·파일·하위 아이템) — 편집·파일이 쓴다 */
  item: TechItemDoc | null;
  meta: ReturnType<typeof useTechBoard>['meta'];
  /** 업데이트 탭이 있는 보드(출장업무·아톡문의) */
  updatesBoard: boolean;
  updateCount: number;
  /** 지우기(Monday 휴지통) — 확인을 받은 뒤 부른다 */
  remove: () => void;
}

export function useDashboardItem(boardKey: TechBoardKey, itemId: string): DashboardItemModel {
  const state = useTechBoard(boardKey);
  const def = dashboardBoard(boardKey);
  const today = koreaToday();
  const record = useMemo(
    () => (state.board ? def.records(state.board).find(r => r.itemId === itemId) ?? null : null),
    [state.board, def, itemId],
  );
  const item = state.itemsById.get(itemId) ?? state.items?.find(i => i.localKey === itemId) ?? null;
  const label = BOARD_TABS.find(t => t.key === boardKey)?.label ?? boardKey;

  const phase = record ? 'ready' : state.error && !state.board ? 'error' : !state.board ? 'loading' : 'missing';

  return {
    boardKey,
    boardName: state.board?.name || state.meta?.name || label,
    phase,
    error: state.error,
    itemId,
    name: record?.name || item?.name || '',
    stage: record ? { stage: record.stage, status: record.status } : null,
    pill: record && def.pill ? def.pill(record) : null,
    detail: record ? def.detail(record, today) : null,
    item,
    meta: state.meta,
    updatesBoard: UPDATE_BOARDS.has(boardKey),
    updateCount: item?.updateCount ?? 0,
    remove: () => deleteItems(boardKey, [itemId]),
  };
}

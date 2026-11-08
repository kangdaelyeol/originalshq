import { useCallback, useMemo, useState } from 'react';
import type { TechBoardKey } from '@xtool-core/tech-boards';
import { deleteItems, moveItems } from '@xtool-core/tech-outbox';

// 여러 보드에 걸친 줄 고르기 — 내 업무(보드마다 상자)가 쓴다. 웹 monday-selection(열쇠 "보드:항목 id")과
// use-selection-actions(byBoard) 그대로: 한 보드에서만 골랐을 때만 옮기기, 지우기는 보드마다, 옮기거나 지우면 고르기를 푼다.
// 보드 화면(보드 하나)은 대시보드와 같은 features/dashboard/record-rows의 useRecordSelection·useSelectionActions를 쓴다.

const keyOf = (boardKey: TechBoardKey, itemId: string) => `${boardKey}:${itemId}`;

export interface WorkSelection {
  count: number;
  has: (boardKey: TechBoardKey, itemId: string) => boolean;
  toggle: (boardKey: TechBoardKey, itemId: string) => void;
  /** 여러 개를 한 번에(그룹 체크) */
  set: (boardKey: TechBoardKey, itemIds: readonly string[], on: boolean) => void;
  clear: () => void;
  /** 옮길 보드 — 한 보드에서만 골랐을 때, 여러 보드면 null(옮기기 없음) */
  moveBoard: TechBoardKey | null;
  moving: boolean;
  openMove: () => void;
  closeMove: () => void;
  move: (groupId: string) => void;
  confirming: boolean;
  askDelete: () => void;
  cancelDelete: () => void;
  /** 확인 — 고른 것을 보드마다 지우고(Monday 휴지통) 고르기를 푼다 */
  confirmDelete: () => void;
}

export function useWorkSelection(): WorkSelection {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [moving, setMoving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const byBoard = useMemo(() => {
    const map = new Map<TechBoardKey, string[]>();
    for (const key of selected) {
      const at = key.indexOf(':');
      const board = key.slice(0, at) as TechBoardKey;
      map.set(board, [...(map.get(board) ?? []), key.slice(at + 1)]);
    }
    return map;
  }, [selected]);
  const boards = [...byBoard.keys()];
  const moveBoard = boards.length === 1 ? boards[0] : null;

  const set = useCallback((boardKey: TechBoardKey, itemIds: readonly string[], on: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      for (const id of itemIds) {
        if (on) next.add(keyOf(boardKey, id));
        else next.delete(keyOf(boardKey, id));
      }
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);

  return {
    count: selected.size,
    has: (boardKey, itemId) => selected.has(keyOf(boardKey, itemId)),
    toggle: (boardKey, itemId) => set(boardKey, [itemId], !selected.has(keyOf(boardKey, itemId))),
    set,
    clear,
    moveBoard,
    moving,
    openMove: () => setMoving(true),
    closeMove: () => setMoving(false),
    move: groupId => {
      setMoving(false);
      if (moveBoard) moveItems(moveBoard, byBoard.get(moveBoard) ?? [], groupId);
      clear();
    },
    confirming,
    askDelete: () => setConfirming(true),
    cancelDelete: () => setConfirming(false),
    confirmDelete: () => {
      setConfirming(false);
      for (const [boardKey, ids] of byBoard) deleteItems(boardKey, ids);
      clear();
    },
  };
}

import { useCallback, useState } from 'react';
import type { TechBoardKey } from '@xtool-core/tech-boards';

// 보드마다 펼친 그룹 — 앱이 켜져 있는 동안만 기억한다(기기에 남기지 않는다). 앱을 새로 켜면 모든 보드가 그룹을 다
// 접은 채로 열리고, 켜져 있는 동안에는 보드를 나갔다 다시 들어와도 펼쳐 둔 그룹이 그대로다(2026-11-12).

const EMPTY: ReadonlySet<string> = new Set();
const session = new Map<TechBoardKey, ReadonlySet<string>>();

/** 이 보드에서 펼친 그룹 id — 처음(앱을 켠 뒤 첫 방문)은 비어 있다(모두 접힘) */
export function useOpenGroups(boardKey: TechBoardKey): [ReadonlySet<string>, (next: ReadonlySet<string>) => void] {
  const [open, setOpen] = useState<{ key: TechBoardKey; ids: ReadonlySet<string> }>(() => ({
    key: boardKey,
    ids: session.get(boardKey) ?? EMPTY,
  }));
  // 같은 화면이 다른 보드로 바뀌면 그 보드의 기억으로
  const ids = open.key === boardKey ? open.ids : session.get(boardKey) ?? EMPTY;
  const set = useCallback(
    (next: ReadonlySet<string>) => {
      session.set(boardKey, next);
      setOpen({ key: boardKey, ids: next });
    },
    [boardKey],
  );
  return [ids, set];
}

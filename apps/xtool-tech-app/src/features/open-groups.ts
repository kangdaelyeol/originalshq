import { useCallback, useMemo, useState } from 'react';
import type { TechBoardKey } from '@xtool-core/tech-boards';

// 보드마다 펼친 그룹 — 앱이 켜져 있는 동안만 기억한다(기기에 남기지 않는다). 앱을 새로 켜고 보드를 처음 열면 보드의 기본
// 펼침(출장업무는 "일정 확정 건" 그룹, 다른 보드는 모두 접힘 — 2026-11-13)이고, 한 번이라도 접거나 펼치면 그때부터는 앱이
// 켜져 있는 동안 보드를 나갔다 다시 들어와도 펼쳐 둔 그룹이 그대로다(2026-11-12).

const EMPTY: ReadonlySet<string> = new Set();
const session = new Map<TechBoardKey, ReadonlySet<string>>();

// 처음 펼칠 그룹 — Monday 그룹 이름으로 찾는다(id는 보드마다 달라서). 띄어쓰기는 빼고 본다
const DEFAULT_OPEN: Partial<Record<TechBoardKey, (title: string) => boolean>> = {
  fieldService: title => title.replace(/\s/g, '').includes('일정확정'),
};

/**
 * 이 보드에서 펼친 그룹 id — 앱을 켠 뒤 아직 건드리지 않았으면 보드의 기본 펼침(groups에서 이름으로 찾는다. 보드 정보가
 * 오기 전에는 비어 있다)
 */
export function useOpenGroups(
  boardKey: TechBoardKey,
  groups: readonly { id: string; title: string }[],
): [ReadonlySet<string>, (next: ReadonlySet<string>) => void] {
  const [open, setOpen] = useState<{ key: TechBoardKey; ids: ReadonlySet<string> | null }>(() => ({
    key: boardKey,
    ids: session.get(boardKey) ?? null,
  }));
  // 같은 화면이 다른 보드로 바뀌면 그 보드의 기억으로
  const touched = open.key === boardKey ? open.ids : session.get(boardKey) ?? null;
  const pick = DEFAULT_OPEN[boardKey];
  const initial = useMemo(
    () => (pick ? new Set(groups.filter(g => pick(g.title)).map(g => g.id)) : EMPTY),
    [pick, groups],
  );
  const set = useCallback(
    (next: ReadonlySet<string>) => {
      session.set(boardKey, next);
      setOpen({ key: boardKey, ids: next });
    },
    [boardKey],
  );
  return [touched ?? initial, set];
}

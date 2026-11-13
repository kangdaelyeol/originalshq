import type { TechBoardKey, TechBoardMeta, TechItemDoc } from '@xtool-core/tech-boards';

// 하위 아이템 간단 목록(카드의 "설치 품목 N개" 시트) — 줄마다 품명(없으면 이름 + 수량)과 비고. 칸은 제목으로 찾는다
// (출장업무 하위 보드: 품명·수량·비고 — 품명은 서버 규칙이 "{품목명} {수량}개"로 맞춘다).
// 출장업무는 목록 위에 주소를 보인다(누르면 복사, 2026-11-13).

export interface SubitemLine {
  id: string;
  title: string;
  note: string | null;
}

const key = (title: string) => title.replace(/\s/g, '');

export function subitemLines(meta: TechBoardMeta | null, item: TechItemDoc): SubitemLine[] {
  const columns = meta?.subitems?.columns ?? [];
  const find = (title: string) => columns.find(c => key(c.title) === key(title));
  const label = find('품명');
  const quantity = find('수량');
  const note = find('비고');
  return (item.subitems ?? []).map(sub => {
    const text = (id: string | undefined) => (id ? sub.values[id]?.text?.trim() ?? '' : '');
    const qty = text(quantity?.id);
    return {
      id: sub.id,
      title: text(label?.id) || (qty ? `${sub.name} ${qty}개` : sub.name),
      note: text(note?.id) || null,
    };
  });
}

/** 시트 위 주소 — 출장업무의 "주소" 칸(서버 출장 기록 address와 같은 칸). 다른 보드이거나 비었으면 null */
export function subitemAddress(boardKey: TechBoardKey, meta: TechBoardMeta | null, item: TechItemDoc): string | null {
  if (boardKey !== 'fieldService') return null;
  const column = meta?.columns.find(c => key(c.title) === '주소');
  return (column && item.values[column.id]?.text?.trim()) || null;
}

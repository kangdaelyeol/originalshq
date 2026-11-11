import type { TechBoardMeta, TechItemDoc } from '@xtool-core/tech-boards';

// 하위 아이템 간단 목록(카드의 "설치 품목 N개" 시트) — 줄마다 품명(없으면 이름 + 수량)과 비고. 칸은 제목으로 찾는다
// (출장업무 하위 보드: 품명·수량·비고 — 품명은 서버 규칙이 "{품목명} {수량}개"로 맞춘다).

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

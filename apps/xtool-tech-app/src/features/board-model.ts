import { groupColor } from '@xtool-core/monday-colors';
import { groupIdOf, OTHER_GROUP, sortValue, type MonSort } from '@xtool-core/monday-values';
import type { TechBoardMeta, TechColumn, TechItemDoc } from '@xtool-core/tech-boards';
import { isPhoneColumn } from '@xtool-core/tech-edit';

// 보드를 그룹으로 나누기 — 웹 Monday 표와 같은 규칙: meta의 그룹 순서, 모르는 그룹의 항목은 "그 밖의 항목",
// 그룹 색은 차례대로, 정렬하면 빈 값은 늘 맨 아래. 이 탭에서 만든 항목(만드는 중)은 그룹 맨 아래.

export interface GroupBlock {
  id: string;
  title: string;
  color: string;
  items: TechItemDoc[];
  /** 상태 칸 라벨별 개수(그룹 아래 요약 막대) */
  battery: { label: string; count: number }[];
}

export const OTHER_GROUP_TITLE = '그 밖의 항목';

function compare(a: string | number | null, b: string | number | null, dir: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * dir;
  return String(a).localeCompare(String(b), 'ko') * dir;
}

/** 정렬에 쓸 이름·번호 — 출장업무는 이름 뒤에 번호를 적어서, 이름 정렬은 번호를 뗀 이름으로, 전화 칸이 빈 건은
 * 이름에 적힌 번호로 */
export interface SortNames {
  nameOf?: (item: TechItemDoc) => string;
  namePhonesOf?: (item: TechItemDoc) => string;
}

const digits = (text: string | null | undefined) => (text ?? '').replace(/\D/g, '');

export function sortItems(
  items: TechItemDoc[],
  column: TechColumn | undefined,
  sort: MonSort,
  { nameOf, namePhonesOf }: SortNames = {},
): TechItemDoc[] {
  if (!sort) return items;
  const valueOf = (item: TechItemDoc): string | number | null => {
    if (sort.columnId === 'name' || !column) return (nameOf ? nameOf(item) : item.name) || null;
    // 전화번호는 숫자만 견준다(하이픈 있고 없고가 섞여 있다)
    if (isPhoneColumn(column)) return digits(item.values[column.id]?.text) || digits(namePhonesOf?.(item)) || null;
    return sortValue(column, item.values[column.id]);
  };
  return [...items].sort((a, b) => compare(valueOf(a), valueOf(b), sort.dir));
}

/** 숫자 칸 합계 — 웹 그룹 아래 요약 줄(쉼표를 빼고 더한다, 숫자가 아닌 값은 0) */
export const numberSum = (items: readonly TechItemDoc[], column: TechColumn): number =>
  items.reduce((sum, item) => sum + (Number((item.values[column.id]?.text ?? '').replace(/,/g, '')) || 0), 0);

export function buildGroups(
  meta: TechBoardMeta,
  items: TechItemDoc[],
  {
    statusColumn,
    sortColumn,
    sort,
    names,
  }: { statusColumn?: TechColumn; sortColumn?: TechColumn; sort: MonSort; names?: SortNames },
): GroupBlock[] {
  const byGroup = new Map<string, TechItemDoc[]>();
  for (const item of items) {
    const id = groupIdOf(meta, item);
    const list = byGroup.get(id) ?? [];
    list.push(item);
    byGroup.set(id, list);
  }
  const order = [
    ...meta.groups.map(g => ({ id: g.id, title: g.title })),
    { id: OTHER_GROUP, title: OTHER_GROUP_TITLE },
  ];
  return order
    .map((g, index) => {
      const list = byGroup.get(g.id) ?? [];
      const settled = list.filter(i => !i.draft);
      const drafts = list.filter(i => i.draft);
      const sorted = [...sortItems(settled, sortColumn, sort, names), ...drafts];
      const counts = new Map<string, number>();
      if (statusColumn) {
        for (const item of sorted) {
          const label = item.values[statusColumn.id]?.text?.trim() ?? '';
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
      }
      return {
        id: g.id,
        title: g.title,
        color: groupColor(index),
        items: sorted,
        battery: [...counts.entries()].map(([label, count]) => ({ label, count })),
      };
    })
    .filter(g => g.items.length > 0 || g.id !== OTHER_GROUP);
}

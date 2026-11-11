import type { TechBoardKey, TechColumn } from '@xtool-core/tech-boards';
import { isPhoneColumn } from '@xtool-core/tech-edit';

// 카드에 보일 칸 — 폰 화면에는 표의 모든 칸을 못 늘어놓아서, 보드마다 가장 많이 보는 칸 몇 개만 카드 둘째 줄에
// 미니 칸으로 보인다(상태 → 담당자 → 날짜 → 하나 더). 칸 이름은 보드마다 달라서 제목으로 찾고, 못 찾으면 종류로
// 대신한다. 나머지 칸은 항목 화면의 "정보"에서 모두 본다.

interface Want {
  /** 날짜 칸 제목 */
  date?: RegExp;
  /** 넷째 칸 — 제목과 허용 종류 */
  extra?: { title: RegExp; types?: string[] };
  /** 상태·담당자 칸이 없는 보드는 첫 칸들을 이것으로 */
  lead?: { title: RegExp; types?: string[] }[];
}

const WANT: Record<TechBoardKey, Want> = {
  fieldService: { date: /방문/, extra: { title: /연락처|전화/ } },
  repair: { date: /접수/, extra: { title: /기기|제품|모델/, types: ['dropdown', 'text', 'board_relation'] } },
  techInquiry: { date: /접수/, extra: { title: /종류|유형|분류/ } },
  techTask: { date: /마감|기한/, extra: { title: /요청/ } },
  rentals: { date: /대여/, extra: { title: /대여자|빌린/ } },
  asRequests: { date: /접수/, lead: [{ title: /기기|제품|모델/ }, { title: /연락처|전화/ }] },
  parts: { lead: [{ title: /재고/ }, { title: /원가|단가|가격/ }, { title: /카테고리|분류|종류/ }] },
  serials: { date: /입고|접수/, lead: [{ title: /기기|제품|모델/ }] },
};

const pick = (columns: TechColumn[], want: { title: RegExp; types?: string[] }, taken: Set<string>) =>
  columns.find(c => !taken.has(c.id) && want.title.test(c.title) && (!want.types || want.types.includes(c.type)));

/** 카드 둘째 줄 칸 — 보이는 칸(visibleColumns) 중에서, 많아야 넷 */
export function cardColumns(boardKey: TechBoardKey, columns: TechColumn[]): TechColumn[] {
  const want = WANT[boardKey];
  const taken = new Set<string>();
  const out: TechColumn[] = [];
  const add = (c: TechColumn | undefined) => {
    if (!c || taken.has(c.id)) return;
    taken.add(c.id);
    out.push(c);
  };
  add(columns.find(c => c.type === 'status'));
  add(columns.find(c => c.type === 'assignee') ?? columns.find(c => c.type === 'people'));
  for (const lead of want.lead ?? []) add(pick(columns, lead, taken));
  if (want.date)
    add(columns.find(c => c.type === 'date' && want.date!.test(c.title)) ?? columns.find(c => c.type === 'date'));
  if (want.extra) add(pick(columns, want.extra, taken));
  return out.slice(0, 4);
}

// ── 보드별 카드 모양 ─────────────────────────────────────────────────────────────────────────────────────────
// 보드마다 카드를 다르게 짤 수 있다(2026-11-11 출장업무부터). 없는 보드는 위 cardColumns 그대로(둘째 줄 미니 칸만).

interface Layout {
  /** 상태 칸을 뺀다 — 그룹이 진행 단계를 보여 주고, 누르면 상세에서 보인다 */
  noStatus?: boolean;
  /** 이름 오른쪽에 둘 전화번호 칸(연락처) — 둘째 줄에서는 뺀다 */
  phoneBeside?: boolean;
  /** 오른쪽 아래에 둘 날짜 칸 제목(접수일) — 둘째 줄에서는 뺀다 */
  corner?: RegExp;
  /** 하위 아이템 개수를 "{이름} N개" 단추로(누르면 목록 시트) — 이름은 SUBITEM_LABEL */
  subitemButton?: boolean;
}

const LAYOUTS: Partial<Record<TechBoardKey, Layout>> = {
  fieldService: { noStatus: true, phoneBeside: true, corner: /접수/, subitemButton: true },
};

export interface CardLayout {
  /** 둘째 줄 미니 칸 */
  columns: TechColumn[];
  /** 이름 오른쪽 전화번호 칸 */
  phone: TechColumn | null;
  /** 오른쪽 아래 날짜 칸 */
  corner: TechColumn | null;
  /** 하위 아이템을 단추로 보일지 */
  subitemButton: boolean;
}

/** 보드의 카드 모양 — 둘째 줄 미니 칸·이름 옆 전화번호·오른쪽 아래 날짜·하위 아이템 단추 */
export function cardLayout(boardKey: TechBoardKey, columns: TechColumn[]): CardLayout {
  const layout = LAYOUTS[boardKey];
  const minis = cardColumns(boardKey, columns);
  if (!layout) return { columns: minis, phone: null, corner: null, subitemButton: false };
  const phone = layout.phoneBeside ? (columns.find(c => isPhoneColumn(c)) ?? null) : null;
  const corner = layout.corner
    ? (columns.find(c => c.type === 'date' && layout.corner!.test(c.title.replace(/\s/g, ''))) ?? null)
    : null;
  return {
    columns: minis.filter(c => !(layout.noStatus && c.type === 'status') && c.id !== phone?.id && c.id !== corner?.id),
    phone,
    corner,
    subitemButton: !!layout.subitemButton,
  };
}

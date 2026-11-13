import type { Period } from '@xtool-core/period';
import type { TechBoardDoc, TechBoardKey, TechBoardRecordMap } from '@xtool-core/tech-boards';
import type {
  BarListItem,
  DetailListItem,
  MiniListItem,
  PillData,
  RecordRowData,
  UpcomingItem,
} from '../../../themes/dashboard/parts';
import type { PhoneAction } from '../../phone-call';
import type { SortColumn } from '../record-rows';

// 보드 하나의 대시보드 정의 — 웹 pages/boards/*-board.tsx가 보드마다 정한 것(표 칸·검색·순서, 옆 판, 상세 서랍 칸)을
// 폰 화면이 그릴 데이터로 옮긴 것. 모양은 없다 — 화면(themes/dashboard)이 부품으로 그린다.

export type BoardRecord<K extends TechBoardKey> = TechBoardRecordMap[K];

/** 옆 판 하나(웹 board-body__side의 판) — 폰에서는 목록 아래로 쌓는다 */
export interface SidePanel {
  key: string;
  title: string;
  subtitle: string;
  body:
    | { kind: 'bars'; items: BarListItem[]; unit?: string; empty?: string }
    | { kind: 'upcoming'; items: UpcomingItem[]; mode: 'due' | 'since'; empty: string }
    | { kind: 'mini'; items: MiniListItem[]; empty: string };
}

/** 옆 판을 만들 때 쓰는 것 — 기간·오늘, 줄을 누르면 상세 열기 */
export interface SideContext {
  period: Period;
  today: string;
  open: (itemId: string) => void;
}

/** 상세 이름/값 한 줄 — phone이면 전화 링크(phoneAction 'copy'면 누르면 복사), link면 여는 단추, assignees면 담당자로 그린다 */
export interface DetailFieldSpec {
  key: string;
  label: string;
  value: string | null;
  phone?: string | null;
  phoneAction?: PhoneAction;
  link?: { url: string; label: string } | null;
}

/** 하위 아이템 간단 목록 — 줄의 "설치 품목 N개" 단추로 여는 시트(label은 시트 제목에, items는 그 목록) */
export interface SubitemSheetSpec {
  label: string;
  items: DetailListItem[];
  /** 목록 위 주소 — 누르면 복사(출장업무, 2026-11-13). 없으면 안 보인다 */
  address?: string | null;
}

/** 상세 본문(웹 RecordDrawer의 fields·texts·children) */
export interface DetailSpec {
  fields: DetailFieldSpec[];
  /** 긴 글 — 빈 것은 화면이 뺀다 */
  texts: { label: string; text: string | null }[];
  /** 작은 목록(설치 품목·청구 부품) */
  lists: { key: string; title: string; items: DetailListItem[] }[];
}

export interface DashboardBoardDef<K extends TechBoardKey> {
  key: K;
  /** 목록 판 제목(출장 목록 …) */
  listTitle: string;
  searchPlaceholder: string;
  /** 진행 중/완료 구분이 있는 보드 */
  progress: boolean;
  /** 목록에 올릴 기록 — SN은 빈 템플릿 줄을 뺀다 */
  records: (doc: TechBoardDoc<K>) => BoardRecord<K>[];
  assigneesOf: (r: BoardRecord<K>) => string[];
  searchOf: (r: BoardRecord<K>) => string;
  sortOpen?: (a: BoardRecord<K>, b: BoardRecord<K>) => number;
  sortDone?: (a: BoardRecord<K>, b: BoardRecord<K>) => number;
  /** 정렬 고르기(웹 머리글 순서) */
  columns: readonly SortColumn<BoardRecord<K>>[];
  /** 목록 한 줄 — 말풍선·저장 중은 화면 훅이 더한다 */
  row: (r: BoardRecord<K>, today: string) => RecordRowData;
  side: (doc: TechBoardDoc<K>, records: BoardRecord<K>[], ctx: SideContext) => SidePanel[];
  detail: (r: BoardRecord<K>, today: string) => DetailSpec;
  /** 상세 머리에 단계 대신 보일 알약(대여품 상태) — 없으면 단계 알약 */
  pill?: (r: BoardRecord<K>) => PillData | null;
  /** 줄의 하위 아이템 단추로 여는 목록 — 없으면 단추 시트를 열지 않는다(줄의 subitems와 같이 넣는다) */
  subitems?: (r: BoardRecord<K>) => SubitemSheetSpec | null;
}

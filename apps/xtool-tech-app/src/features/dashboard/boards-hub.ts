import { BOARD_TABS, type TechBoardKey } from '@xtool-core/tech-boards';
import { useTechBoard } from '@xtool-core/tech-boards-store';
import { isDone } from '@xtool-core/tech-stage';
import { dashboardBoard } from './boards';

// 보드 허브 — 웹 사이드바의 보드 메뉴를 폰 목록으로: "메뉴"(출장업무·AS·아톡문의·기타업무), "관리"(AS 신청서·부품 마스터·
// 대여품 관리·SN 관리). 같은 순서(BOARD_TABS). 보드마다 진행 중 수(진행 구분이 없는 보드는 전체 수)를 곁들인다.

export interface BoardHubTile {
  key: TechBoardKey;
  label: string;
  /** Monday 보드 이름(메뉴 이름과 다를 때) */
  title: string | null;
  /** '진행 중 12' / '전체 340' — 아직이면 null */
  count: string | null;
  caption: string | null;
}

function useTile(key: TechBoardKey): BoardHubTile {
  const { board, meta, error } = useTechBoard(key);
  const tab = BOARD_TABS.find(t => t.key === key);
  const label = tab?.label ?? key;
  const name = meta?.name || board?.name || null;
  const def = dashboardBoard(key);
  const records = board ? def.records(board) : null;
  const open = records ? records.filter(r => !isDone(r)).length : null;
  return {
    key,
    label,
    title: name && name !== label ? name : null,
    count: records === null ? null : def.progress ? String(open) : String(records.length),
    caption: error && !board ? '불러오지 못했어요' : records === null ? null : def.progress ? '진행 중' : '전체',
  };
}

export function useBoardsHub(): { sections: { key: string; label: string; tiles: BoardHubTile[] }[] } {
  // 보드 여덟 개 — 훅 수가 늘 같게 차례대로 부른다
  const tiles = {
    fieldService: useTile('fieldService'),
    repair: useTile('repair'),
    techInquiry: useTile('techInquiry'),
    techTask: useTile('techTask'),
    asRequests: useTile('asRequests'),
    parts: useTile('parts'),
    rentals: useTile('rentals'),
    serials: useTile('serials'),
  };
  return {
    sections: [
      { key: 'work', label: '메뉴', tiles: BOARD_TABS.filter(t => t.section === 'work').map(t => tiles[t.key]) },
      { key: 'manage', label: '관리', tiles: BOARD_TABS.filter(t => t.section === 'manage').map(t => tiles[t.key]) },
    ],
  };
}

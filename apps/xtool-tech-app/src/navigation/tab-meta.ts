import { LayoutGrid, LayoutList, Settings, UserRoundCheck, Users, type LucideIcon } from 'lucide-react-native';
import type { TabParams } from './types';

/** 탭 이름·아이콘 — 웹 사이드바 메뉴와 같다(보드는 웹에선 메뉴마다 따로라 앱 허브에만 아이콘을 따로 둔다). 모든 테마가 같이 쓴다. */
export const TAB_META: Record<keyof TabParams, { label: string; icon: LucideIcon }> = {
  Overview: { label: '개요', icon: LayoutGrid },
  MyWork: { label: '내 업무', icon: UserRoundCheck },
  Boards: { label: '보드', icon: LayoutList },
  Team: { label: '팀원', icon: Users },
  Settings: { label: '설정', icon: Settings },
};

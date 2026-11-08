import type { ThemeModule, ThemeScreens } from '../types';
import { BoardScreen } from './screens/board-screen';
import { BoardsScreen } from './screens/boards-screen';
import { ItemScreen } from './screens/item-screen';
import { MyWorkScreen } from './screens/my-work-screen';
import { OverviewScreen } from './screens/overview-screen';
import { SettingsScreen } from './screens/settings-screen';
import { TeamScreen } from './screens/team-screen';

// 대시보드 짜임 — 글라스·물이 같이 쓰는 화면(웹처럼 화면은 한 벌, 모양은 테마가 주는 부품(parts.ts)으로 바꿔 끼운다).
// 테마는 Frame에서 PartsProvider(value: glassParts·waterParts)로 이 화면들 바깥을 감싼다.

/** 대시보드 짜임의 아래 탭 — 웹 대시보드 사이드바처럼 개요가 있다 */
export const DASHBOARD_TABS: ThemeModule['tabs'] = ['Overview', 'MyWork', 'Boards', 'Team', 'Settings'];

export const dashboardScreens: ThemeScreens = {
  Overview: OverviewScreen,
  MyWork: MyWorkScreen,
  Boards: BoardsScreen,
  Board: BoardScreen,
  Item: ItemScreen,
  Team: TeamScreen,
  Settings: SettingsScreen,
};

export { PartsProvider, useParts, type DashboardParts } from './parts';

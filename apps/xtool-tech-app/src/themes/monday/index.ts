import type { ThemeModule } from '../types';
import { Toaster } from './parts/toaster';
import { BoardScreen } from './screens/board-screen';
import { BoardsScreen } from './screens/boards-screen';
import { ItemScreen } from './screens/item-screen';
import { MyWorkScreen } from './screens/my-work-screen';
import { SettingsScreen } from './screens/settings-screen';
import { TeamScreen } from './screens/team-screen';
import { MondayTabBar } from './tab-bar';
import { useMon } from './theme-context';

// Monday 표 — 웹 Monday 테마(그룹 표 짜임)를 폰에 맞춘 것. 개요는 웹처럼 기본으로 숨긴다(탭에 없다).

export const mondayTheme: ThemeModule = {
  key: 'monday',
  screens: {
    MyWork: MyWorkScreen,
    Boards: BoardsScreen,
    Board: BoardScreen,
    Item: ItemScreen,
    Team: TeamScreen,
    Settings: SettingsScreen,
  },
  TabBar: MondayTabBar,
  tabs: ['MyWork', 'Boards', 'Team', 'Settings'],
  Toaster,
  useChrome: () => {
    const p = useMon();
    return {
      background: p.bg,
      statusBar: p.scheme === 'dark' ? 'light-content' : 'dark-content',
      text: p.text,
      border: p.line,
      primary: p.primary,
      dark: p.scheme === 'dark',
    };
  },
};

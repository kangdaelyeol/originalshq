import { DASHBOARD_TABS, dashboardScreens } from '../dashboard';
import type { ThemeModule } from '../types';
import { GlassFrame } from './frame';
import { Toaster } from './parts/toaster';
import { GlassTabBar } from './tab-bar';
import { DEFAULT_ACCENT, T } from './theme';
import { useGlassAppearance } from './theme-context';

// 글라스 — 웹 기술팀 보드의 기본 "대시보드" 레이아웃(유리 판). 화면은 대시보드 짜임 한 벌(themes/dashboard)을 쓰고,
// 이 테마는 틀(배경·아래 탭·토스트·외관)과 부품(glassParts — Frame이 PartsProvider로 준다)을 맡는다.

export const glassTheme: ThemeModule = {
  key: 'glass',
  screens: dashboardScreens,
  tabs: DASHBOARD_TABS,
  TabBar: GlassTabBar,
  Frame: GlassFrame,
  Toaster,
  // 화면·내비게이션 바탕은 투명 — 배경 그림은 Frame이 화면 뒤에 한 장 그린다. Frame 밖에서 불리니 저장소에서 읽는다.
  useChrome: () => {
    const { appearance } = useGlassAppearance();
    return {
      background: 'transparent',
      statusBar: 'light-content',
      text: T.text1,
      border: T.line,
      primary: appearance.background === 'photo' ? DEFAULT_ACCENT : appearance.accent,
      dark: true,
    };
  },
};

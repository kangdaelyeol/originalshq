import { DASHBOARD_TABS, dashboardScreens } from '../dashboard';
import type { ThemeModule } from '../types';
import { WaterFrame } from './frame';
import { WaterToaster } from './parts/toaster';
import { WaterTabBar } from './tab-bar';
import { W } from './theme';
import { useWater } from './theme-context';

// 물 — 웹 설정 > 레이아웃 "물"(D7 물 디자인). 화면은 대시보드 짜임 한 벌(../dashboard)을 같이 쓰고, 이 테마는 부품
// (물 부품 — PartsProvider)과 틀(무대 배경·아래 탭·토스트·물 설정)만 내놓는다. 모양만 다르고 기능은 같다.

export const waterTheme: ThemeModule = {
  key: 'water',
  screens: dashboardScreens,
  tabs: DASHBOARD_TABS,
  TabBar: WaterTabBar,
  Frame: WaterFrame,
  Toaster: WaterToaster,
  useChrome: () => {
    const p = useWater();
    return {
      // 화면 바탕은 비워 둔다 — 틀(WaterFrame)의 무대 벽이 비친다
      background: 'transparent',
      statusBar: 'dark-content',
      text: W.ink,
      border: 'rgba(63, 62, 67, 0.12)',
      primary: p.dark2,
      dark: false,
    };
  },
};

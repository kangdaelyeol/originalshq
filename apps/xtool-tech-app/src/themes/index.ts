import type { AppLayout } from '../features/layout';
import { glassTheme } from './glass';
import { mondayTheme } from './monday';
import type { ThemeModule } from './types';
import { waterTheme } from './water';

// 레이아웃 → 테마. Monday 표는 자기 화면, 글라스(대시보드)·물은 대시보드 화면 한 벌(themes/dashboard)에 부품만 바꿔 끼운다.
export const THEMES: Record<AppLayout, ThemeModule> = {
  monday: mondayTheme,
  glass: glassTheme,
  water: waterTheme,
};

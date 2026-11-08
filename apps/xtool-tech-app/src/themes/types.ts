import type { ComponentType, ReactNode } from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { AppLayout } from '../features/layout';
import type { RootScreenProps, TabParams } from '../navigation/types';

// 테마 하나가 내놓는 것 — 화면 틀(navigation/root)이 지금 레이아웃의 테마에서 화면·아래 탭·토스트·배경을 꺼내 쓴다.
// 화면의 동작은 모두 src/features의 공용 훅에서 오고, 테마는 모양만 그린다(웹: 모양만 다르고 기능은 같게).

export interface ThemeScreens {
  /** 개요(대시보드 짜임만 — 글라스·물). 없으면 탭에서 뺀다. */
  Overview?: ComponentType;
  /** 내 업무 — who가 있으면 그 직원의 업무(팀원에서 연다), onBack이 있으면 뒤로 단추 */
  MyWork: ComponentType<{ who?: string; onBack?: () => void }>;
  Boards: ComponentType;
  Board: ComponentType<RootScreenProps<'Board'>>;
  Item: ComponentType<RootScreenProps<'Item'>>;
  Team: ComponentType;
  Settings: ComponentType;
}

export interface ThemeChrome {
  /** 화면·내비게이션 바탕 */
  background: string;
  /** 위 상태 막대 글자색 */
  statusBar: 'light-content' | 'dark-content';
  text: string;
  border: string;
  primary: string;
  dark: boolean;
}

export interface ThemeModule {
  key: AppLayout;
  screens: ThemeScreens;
  /** 아래 탭 모양 */
  TabBar: ComponentType<BottomTabBarProps>;
  /** 탭 순서 — 이 이름들만 보인다 */
  tabs: readonly (keyof TabParams)[];
  /** 화면 전체를 감싸는 것 — 배경 그림·테마 공급자 등(없으면 그대로) */
  Frame?: ComponentType<{ children: ReactNode }>;
  /** 저장 실패·성공 토스트(아래 탭 위에 띄운다) */
  Toaster: ComponentType<{ bottom: number }>;
  /** 내비게이션 바탕·상태 막대 — 훅이라 테마 설정(색 등)을 읽을 수 있다 */
  useChrome: () => ThemeChrome;
}

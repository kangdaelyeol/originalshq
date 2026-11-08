import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TechBoardKey } from '@xtool-core/tech-boards';

// 화면 이동 — 아래 탭(웹 사이드바: 개요·내 업무·보드 메뉴·팀원·설정 — 테마가 고른다) 위로 보드·항목·직원 업무 화면을
// 쌓는다.

export type RootStackParams = {
  Tabs: undefined;
  Board: { boardKey: TechBoardKey };
  Item: { boardKey: TechBoardKey; itemId: string };
  /** 다른 직원의 업무(웹 내 업무 ?who=) */
  PersonWork: { who: string };
};

export type TabParams = {
  /** 개요 — 대시보드 짜임(글라스·물)에만 */
  Overview: undefined;
  MyWork: undefined;
  Boards: undefined;
  Team: undefined;
  Settings: undefined;
};

export type RootScreenProps<K extends keyof RootStackParams> = NativeStackScreenProps<RootStackParams, K>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParams {}
  }
}

import type { TechBoardKey } from '@xtool-core/tech-boards';
import { asRequestsDef } from './as-requests';
import { fieldServiceDef } from './field-service';
import { inquiryDef } from './inquiry';
import { partsDef } from './parts';
import { rentalsDef } from './rentals';
import { repairDef } from './repair';
import { serialsDef } from './serials';
import { taskDef } from './task';
import type { DashboardBoardDef } from './types';

// 보드 키 → 대시보드 정의(웹 pages/boards/registry.ts의 BOARD_DEFS — 숫자 카드는 features/kpis가 따로 센다).

export const DASHBOARD_BOARDS: { [K in TechBoardKey]: DashboardBoardDef<K> } = {
  fieldService: fieldServiceDef,
  repair: repairDef,
  techInquiry: inquiryDef,
  techTask: taskDef,
  asRequests: asRequestsDef,
  parts: partsDef,
  rentals: rentalsDef,
  serials: serialsDef,
};

/**
 * 키 하나의 정의 — 키와 기록이 같은 보드라는 것은 부르는 쪽이 맞춘다(useTechBoard(key).board를 넘긴다). 키가 여러 보드 중
 * 하나인 자리(보드 화면·상세)에서 보드마다 나눠 쓰지 않게 한 번에 푼다(웹 boardDef와 같다).
 */
export const dashboardBoard = (key: TechBoardKey) =>
  DASHBOARD_BOARDS[key] as unknown as DashboardBoardDef<TechBoardKey>;

export type { DashboardBoardDef, DetailFieldSpec, DetailSpec, SidePanel } from './types';

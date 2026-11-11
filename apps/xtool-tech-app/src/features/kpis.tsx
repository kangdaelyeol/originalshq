import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  Barcode,
  Boxes,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  ClipboardPen,
  Hourglass,
  Inbox,
  Link2,
  ListTodo,
  MessageCircle,
  MessagesSquare,
  OctagonAlert,
  Package,
  PackageOpen,
  PackagePlus,
  PackageX,
  Paperclip,
  Receipt,
  Send,
  SquareCheck,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import { boardKpis, type KpiCard, type KpiIcon } from '@xtool-core/board-kpis';
import { koreaToday } from '@xtool-core/dates';
import type { Period } from '@xtool-core/period';
import type { TechBoardKey } from '@xtool-core/tech-boards';
import { useTechBoard } from '@xtool-core/tech-boards-store';

// 보드 숫자 카드 — 세는 법은 웹과 같이 쓴다(@xtool-core/board-kpis). 대시보드 짜임(글라스·물)은 카드 네 장으로
// 그린다(Monday 표는 앱에서 요약 줄을 두지 않는다 — 2026-11-11). 기간은 앱 전체에 하나 — 웹 PeriodProvider처럼 처음은 30일, 기기에 남기지 않는다.

interface PeriodState {
  period: Period;
  setPeriod: (period: Period) => void;
}

const PeriodContext = createContext<PeriodState | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>('30d');
  const value = useMemo(() => ({ period, setPeriod }), [period]);
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

/** 조회 기간 — 숫자 카드의 "… 완료"·"… 접수"가 이 기간을 센다(고르는 단추는 PERIOD_OPTIONS) */
export function usePeriod(): PeriodState {
  const state = useContext(PeriodContext);
  if (!state) throw new Error('usePeriod는 PeriodProvider 안에서만 쓸 수 있어요');
  return state;
}

/** 숫자 카드 아이콘 — 웹 kpi-icons.ts와 같은 이름의 lucide 아이콘 */
export const KPI_ICONS: Record<KpiIcon, LucideIcon> = {
  Barcode,
  Boxes,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  ClipboardPen,
  Hourglass,
  Inbox,
  Link2,
  ListTodo,
  MessageCircle,
  MessagesSquare,
  OctagonAlert,
  Package,
  PackageOpen,
  PackagePlus,
  PackageX,
  Paperclip,
  Receipt,
  Send,
  SquareCheck,
  Truck,
  Wrench,
};

/** 보드 하나의 숫자 카드 네 장 — 보드(meta·항목)가 아직 안 왔으면 null */
export function useBoardKpis(boardKey: TechBoardKey): KpiCard[] | null {
  const { board } = useTechBoard(boardKey);
  const { period } = usePeriod();
  return useMemo(() => (board ? boardKpis(boardKey, board, period, koreaToday()) : null), [board, boardKey, period]);
}

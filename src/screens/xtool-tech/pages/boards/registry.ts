import type { ComponentType, ReactNode } from 'react'
import type { StatCardData } from '@/ohq-ui/types'
import type { Period } from '../../data/period'
import type { TechBoardDoc, TechBoardKey } from '../../data/tech-boards'
import { AsRequestsDrawer } from './as-requests-board'
import { asRequestsKpis } from './as-requests-kpis'
import { FieldServiceDrawer } from './field-service-board'
import { fieldServiceKpis } from './field-service-kpis'
import { InquiryDrawer } from './inquiry-board'
import { inquiryKpis } from './inquiry-kpis'
import { PartsDrawer } from './parts-board'
import { partsKpis } from './parts-kpis'
import { RecordsDrawer } from './records-board'
import { recordsKpis } from './records-kpis'
import { RentalsDrawer } from './rentals-board'
import { rentalsKpis } from './rentals-kpis'
import { RepairDrawer } from './repair-board'
import { repairKpis } from './repair-kpis'
import { SerialsDrawer } from './serials-board'
import { serialsKpis } from './serials-kpis'
import { TaskDrawer } from './task-board'
import { taskKpis } from './task-kpis'

// 보드마다 다른 화면에서도 쓰는 것 — 숫자 카드와 상세 서랍. 대시보드·물의 보드 화면이 그대로 그리고,
// Monday 표는 숫자 카드를 요약 줄(MondayNumbers)로, 내 업무는 줄을 누르면 같은 서랍(BoardItemHost)을 연다.

/** 상세 서랍 — 보드 화면은 표에서 고른 항목, 내 업무는 주소(?board·?item)로 연 항목을 준다. */
export interface BoardDrawerProps<K extends TechBoardKey> {
  doc: TechBoardDoc<K>
  /** 열 항목 — null이거나 보드에 없는 id면 닫힌다. */
  selectedId: string | null
  onClose: () => void
  /** 이름 위 한 줄(기본은 보드 이름) — 내 업무는 그 보드로 가는 링크("보드에서 보기")를 준다 */
  eyebrow?: ReactNode
}

export interface BoardDef<K extends TechBoardKey> {
  /** 숫자 카드 네 장 — 기간(… 완료 등)과 오늘(한국 날짜)로 센다. */
  kpis: (doc: TechBoardDoc<K>, period: Period, today: string) => StatCardData[]
  Drawer: ComponentType<BoardDrawerProps<K>>
}

export const BOARD_DEFS: { [K in TechBoardKey]: BoardDef<K> } = {
  fieldService: { kpis: fieldServiceKpis, Drawer: FieldServiceDrawer },
  repair: { kpis: repairKpis, Drawer: RepairDrawer },
  records: { kpis: recordsKpis, Drawer: RecordsDrawer },
  techInquiry: { kpis: inquiryKpis, Drawer: InquiryDrawer },
  techTask: { kpis: taskKpis, Drawer: TaskDrawer },
  asRequests: { kpis: asRequestsKpis, Drawer: AsRequestsDrawer },
  parts: { kpis: partsKpis, Drawer: PartsDrawer },
  rentals: { kpis: rentalsKpis, Drawer: RentalsDrawer },
  serials: { kpis: serialsKpis, Drawer: SerialsDrawer },
}

/**
 * 키 하나의 정의 — 키와 doc이 같은 보드라는 것은 부르는 쪽이 맞춘다(useTechBoard(key).board를 넘긴다).
 * 키가 여러 보드 중 하나인 자리(보드 화면·내 업무 서랍)에서 보드마다 나눠 쓰지 않게 한 번에 푼다.
 */
export const boardDef = (key: TechBoardKey) => BOARD_DEFS[key] as unknown as BoardDef<TechBoardKey>

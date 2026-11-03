import { createContext, useCallback, useContext } from 'react'
import { useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react'
import { D8_DOCK } from './sidebar-data'

/** 툴팁이 가리킬 것 — 접힌 메뉴 항목(패널 오른쪽에 뜸) 또는 토글(토글 오른쪽에 뜸) */
export interface D8TipTarget {
  key: string
  label: string
  chip?: string
  anchor: 'panel' | 'toggle'
  el: HTMLElement
}

/** 독 확대에 참여하는 항목 하나 */
export interface D8DockEntry {
  el: HTMLElement
  /** 높이 증가(em) — 사이드바가 커서 거리로 스프링 애니메이션을 건다 */
  grow: MotionValue<number>
  /** 최대 높이 증가(em) */
  max: number
  /** 지금 향하는 목표(em) — 같은 목표면 스프링을 다시 걸지 않는다 */
  target: number
}

export interface D8SidebarContextValue {
  expanded: boolean
  /** 시간 배율(1 = 영상 속도) — 렌더에서 쓰는 값 */
  timeScale: number
  /** 지금 시간 배율 — 효과·이벤트 안에서 애니메이션을 시작할 때 읽는다 */
  getScale: () => number
  /** 펼침 전용 글자 불투명도(0~1) — 라벨·배지·섹션 이름이 함께 쓴다 */
  labels: MotionValue<number>
  /** 접힘 전용 장식 불투명도(구분선·아이콘 위 빨간 점) */
  rail: MotionValue<number>
  registerDock: (key: string, entry: D8DockEntry | null) => void
  /** 선택 알약이 찾을 메뉴 항목 요소 */
  registerItem: (key: string, el: HTMLElement | null) => void
  itemEl: (key: string) => HTMLElement | undefined
  /** 툴팁 대상(접혔을 때 hover·focus) — null이면 잠깐 뒤 숨긴다(항목 사이를 지날 때 깜빡이지 않게) */
  showTip: (target: D8TipTarget | null) => void
  /** 독·하위 메뉴가 움직였다 — 알약·툴팁 위치를 다음 프레임에 다시 잰다 */
  notifyLayout: () => void
  subscribeLayout: (cb: () => void) => () => void
}

export const D8SidebarContext = createContext<D8SidebarContextValue | null>(null)

export function useD8Sidebar() {
  const ctx = useContext(D8SidebarContext)
  if (!ctx) throw new Error('GlassSidebar(또는 SidebarPreview) 안에서만 쓴다')
  return ctx
}

/**
 * 독 확대 항목 — 높이 증가(em) 값을 만들어 사이드바에 등록한다.
 * 돌려주는 ref를 항목 상자에 걸면 커서 거리로 grow가 움직이고 height·iconScale이 따라간다.
 */
export function useDockItem(key: string, max: number, baseHeight: number) {
  const { registerDock, notifyLayout } = useD8Sidebar()
  const grow = useMotionValue(0)
  useMotionValueEvent(grow, 'change', notifyLayout)
  const ref = useCallback(
    (el: HTMLElement | null) => {
      registerDock(key, el ? { el, grow, max, target: 0 } : null)
    },
    [registerDock, key, grow, max],
  )
  const height = useTransform(grow, (g) => `${baseHeight + g}em`)
  const iconScale = useTransform(grow, (g) => 1 + (D8_DOCK.iconScale * g) / max)
  return { ref, grow, height, iconScale }
}

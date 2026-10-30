import { createContext, useContext } from 'react'

/** 이 화면의 루트 요소(.xtool-tech) — 포털(알림 패널)을 body 대신 여기에 띄워야 화면의
 * 스타일·CSS 변수(강조색·유리)가 그대로 적용된다. */
export const PortalRootContext = createContext<HTMLElement | null>(null)

export const usePortalRoot = (): HTMLElement | null => useContext(PortalRootContext)

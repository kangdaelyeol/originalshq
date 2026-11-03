import { createContext, useContext } from 'react'

/** 디자인 루트 요소(.ohq-ui, ThemeRoot) — 포털(팝오버·모달·토스트)을 body 대신 여기에 띄워야
 * 스타일·CSS 변수(강조색·유리)가 그대로 적용된다. */
export const PortalRootContext = createContext<HTMLElement | null>(null)

export const usePortalRoot = (): HTMLElement | null => useContext(PortalRootContext)

import { createContext, useContext } from 'react'
import type { XtoolMember } from '@/xtool-auth/members'

/** 지금 로그인한 구성원 — 화면 잠금(AppLayout)이 확인한 뒤에만 채워진다. */
export const MemberContext = createContext<XtoolMember | null>(null)

export const useCurrentMember = (): XtoolMember | null => useContext(MemberContext)

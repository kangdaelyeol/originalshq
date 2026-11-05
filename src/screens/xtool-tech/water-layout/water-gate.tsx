import { Suspense, use, type ReactNode } from 'react'
import type { XtoolMember } from '@xtool-core/members'
import { loadWaterLayout } from './load'

/** 물 묶음을 받는 동안의 바탕 — 무대와 같은 밝기(styles/_water-boot.scss) */
export function WaterBackdrop() {
  return <div className="wl-backdrop" aria-hidden />
}

export interface WaterShellProps {
  member: XtoolMember
  /** 아이콘 줄로 접었는지(넓은 화면에서만 — 좁으면 CSS가 늘 접는다) */
  collapsed: boolean
  onToggle: () => void
  children: ReactNode
}

/** 물 화면 틀 — 물 묶음을 받은 뒤 셸을 그린다(받는 동안은 바탕만). AppLayout이 로그인 확인 뒤에 쓴다. */
export function WaterShellGate(props: WaterShellProps) {
  return (
    <Suspense fallback={<WaterBackdrop />}>
      <ShellAfterLoad {...props} />
    </Suspense>
  )
}

function ShellAfterLoad(props: WaterShellProps) {
  const { WaterShell } = use(loadWaterLayout())
  return <WaterShell {...props} />
}

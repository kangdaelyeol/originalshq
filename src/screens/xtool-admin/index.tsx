import { motion, MotionConfig } from 'motion/react'
import { lazy, Suspense, use, useState, type ReactNode } from 'react'
import { useXtoolSession } from '@/xtool-auth/use-xtool-session'
import { MemberContext } from '@xtool-core/member-context'
import { AppearanceProvider } from '@/ohq-ui/appearance/appearance-provider'
import { pageStagger } from '@/ohq-ui/lib/motion'
import { SegmentedControl } from '@/screens/xtool-tech/components/basic-parts'
import { useLayoutKind } from '@/screens/xtool-tech/lib/layout-kind'
import { AppearanceSettings } from '@/screens/xtool-tech/pages/settings/appearance-settings'
import { loadWaterLayout } from '@/screens/xtool-tech/water-layout/load'
import { AdminBackground } from './admin-background'
import { AdminHeader } from './admin-header'
import { AdminSignIn } from './admin-sign-in'
import { AssigneeCopyCard } from './assignee-copy-card'
import { InstallItemsCard } from './install-items-card'
import { WorksTestCard } from './works-test-card'
import { EditLogCard } from './edit-log-card'
import { MemberForm } from './member-form'
import { MembersTable, type MemberFilter } from './members-table'
import { PhoneCopyCard } from './phone-copy-card'
import { TechSyncCard } from './tech-sync-card'
import './admin.scss'

// 시스템 지도 — D14 두뇌 지도 장면(캔버스 엔진·별 판 스타일)이 커서 따로 받는다
const SystemMapCard = lazy(() => import('./system-map-card'))

/**
 * /admin/xtool — xtool 팀 페이지(기술팀, 앞으로 영업팀·콜백팀)에 들어올 수 있는 사람을 등록하고
 * 팀별 권한·관리자·정지를 바꾼다. 외관 설정(레이아웃 디자인·배경·강조색·유리 효과)은 기술팀 보드와 같이 쓰고, "설정"
 * 탭에서도 고른다. 카드·버튼·탭 등은 기술팀 보드의 기본 부품(basic-parts)이라 물 디자인이면 물 부품으로 바뀐다.
 * 첫 탭 "시스템 지도"는 사람 × 시스템 권한을 D14 두뇌 지도로 그린다(system-map-card).
 */
export default function XtoolAdminRoot() {
  return (
    <MotionConfig reducedMotion="user">
      <AppearanceProvider className="xtool-admin">
        <AdminScreen />
      </AppearanceProvider>
    </MotionConfig>
  )
}

type Tab = 'map' | 'members' | 'monday' | 'logs' | 'settings'

const TABS = [
  { value: 'map' as const, label: '시스템 지도' },
  { value: 'members' as const, label: '구성원' },
  { value: 'monday' as const, label: 'Monday 연동' },
  { value: 'logs' as const, label: '수정 기록' },
  { value: 'settings' as const, label: '설정' },
]

/** 물 디자인이면 물 부품 묶음(기술팀 보드와 같은 것)을 받은 뒤에 그린다 — 부품이 렌더 중에 바로 꺼내 쓴다. */
function WaterReady({ children }: { children: ReactNode }) {
  const { design } = useLayoutKind()
  if (design !== 'water') return children
  return (
    <Suspense fallback={null}>
      <AfterWaterLoad>{children}</AfterWaterLoad>
    </Suspense>
  )
}

function AfterWaterLoad({ children }: { children: ReactNode }) {
  use(loadWaterLayout())
  return children
}

function AdminScreen() {
  const session = useXtoolSession('admin')
  const [tab, setTab] = useState<Tab>('map')
  // 시스템 지도에서 고른 사람(그 줄 강조)이나 허브(+N — 그 필터로) — 구성원 탭을 열 때 한 번 쓴다
  const [jump, setJump] = useState<{ email?: string; filter?: MemberFilter } | null>(null)
  const openTab = (next: Tab) => {
    setJump(null)
    setTab(next)
  }

  // 배경은 화면마다 — 물 벽은 물 부품을 받은 뒤(WaterReady 안)에 깔린다
  if (session.status === 'loading') return <AdminBackground />
  if (session.status !== 'ready') {
    return (
      <>
        <AdminBackground />
        <AdminSignIn session={session} />
      </>
    )
  }

  return (
    <MemberContext.Provider value={session.member}>
      <WaterReady>
        <AdminBackground />
        <div className="admin">
          <AdminHeader member={session.member} />
          <div className="admin__tabs">
            <SegmentedControl ariaLabel="관리 화면" options={TABS} value={tab} onChange={openTab} />
          </div>
          <motion.main key={tab} className="admin__main" variants={pageStagger} initial="hidden" animate="show">
            {tab === 'map' && (
              <Suspense fallback={null}>
                <SystemMapCard
                  self={session.member}
                  onOpenMember={(email) => {
                    setJump({ email })
                    setTab('members')
                  }}
                  onOpenGroup={(filter) => {
                    setJump({ filter })
                    setTab('members')
                  }}
                />
              </Suspense>
            )}
            {tab === 'members' && (
              <>
                <MemberForm adminEmail={session.member.email} />
                <MembersTable
                  selfEmail={session.member.email}
                  highlight={jump?.email ?? null}
                  initialFilter={jump?.filter}
                />
              </>
            )}
            {tab === 'monday' && (
              <>
                <TechSyncCard />
                <PhoneCopyCard />
                <AssigneeCopyCard />
                <InstallItemsCard />
                <WorksTestCard />
              </>
            )}
            {tab === 'logs' && <EditLogCard />}
            {/* 외관 — 기술팀 보드 설정과 같은 카드(같은 값). 개요 보드처럼 보드에만 쓰는 고르기는 뺀다 */}
            {tab === 'settings' && <AppearanceSettings techOptions={false} />}
          </motion.main>
        </div>
      </WaterReady>
    </MemberContext.Provider>
  )
}

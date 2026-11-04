import { motion, MotionConfig } from 'motion/react'
import { useState } from 'react'
import { useXtoolSession } from '@/xtool-auth/use-xtool-session'
import { AppearanceProvider } from '@/ohq-ui/appearance/appearance-provider'
import { SegmentedControl } from '@/ohq-ui/components/segmented-control'
import { pageStagger } from '@/ohq-ui/lib/motion'
import { AdminBackground } from './admin-background'
import { AdminHeader } from './admin-header'
import { AdminSignIn } from './admin-sign-in'
import { AssigneeCopyCard } from './assignee-copy-card'
import { EditLogCard } from './edit-log-card'
import { MemberForm } from './member-form'
import { MembersTable } from './members-table'
import { PhoneCopyCard } from './phone-copy-card'
import { TechSyncCard } from './tech-sync-card'
import './admin.scss'

/**
 * /admin/xtool — xtool 팀 페이지(기술팀, 앞으로 영업팀·콜백팀)에 들어올 수 있는 사람을 등록하고
 * 팀별 권한·관리자·정지를 바꾼다. 화면 바탕은 공용 디자인(src/ohq-ui)만으로 — 외관 설정(강조색·유리·테마·배경)은
 * 기술팀 보드와 같이 쓴다.
 */
export default function XtoolAdminRoot() {
  return (
    <MotionConfig reducedMotion="user">
      <AppearanceProvider className="xtool-admin">
        <AdminBackground />
        <AdminScreen />
      </AppearanceProvider>
    </MotionConfig>
  )
}

type Tab = 'members' | 'monday' | 'logs'

const TABS = [
  { value: 'members' as const, label: '구성원' },
  { value: 'monday' as const, label: 'Monday 연동' },
  { value: 'logs' as const, label: '수정 기록' },
]

function AdminScreen() {
  const session = useXtoolSession('admin')
  const [tab, setTab] = useState<Tab>('members')

  if (session.status === 'loading') return null
  if (session.status !== 'ready') return <AdminSignIn session={session} />

  return (
    <div className="admin">
      <AdminHeader member={session.member} />
      <div className="admin__tabs">
        <SegmentedControl ariaLabel="관리 화면" options={TABS} value={tab} onChange={setTab} />
      </div>
      <motion.main key={tab} className="admin__main" variants={pageStagger} initial="hidden" animate="show">
        {tab === 'members' && (
          <>
            <MemberForm adminEmail={session.member.email} />
            <MembersTable selfEmail={session.member.email} />
          </>
        )}
        {tab === 'monday' && (
          <>
            <TechSyncCard />
            <PhoneCopyCard />
            <AssigneeCopyCard />
          </>
        )}
        {tab === 'logs' && <EditLogCard />}
      </motion.main>
    </div>
  )
}

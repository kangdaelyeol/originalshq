import { KeyRound, ListTodo } from 'lucide-react'
import { MotionConfig } from 'motion/react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppLayout } from './components/layout/app-layout'
import { PeriodProvider } from './context/period-provider'
import { SettingsProvider } from './settings/settings-provider'
import { AnalyticsPage } from './pages/analytics-page'
import { ComingSoonPage } from './pages/coming-soon-page'
import { DeployStationPage } from './pages/deploy-station-page'
import { LoginPage } from './pages/login-page'
import { OverviewPage } from './pages/overview-page'
import { SettingsPage } from './pages/settings-page'
import { TeamPage } from './pages/team-page'

const router = createBrowserRouter([
  // 로그인은 사이드바·상단바 없이 화면 전체를 쓴다.
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'deploy', element: <DeployStationPage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'settings', element: <SettingsPage /> },
      {
        path: 'tasks',
        element: (
          <ComingSoonPage
            icon={ListTodo}
            title="작업 보드"
            description="샘플 영상에 없는 화면이라 자리만 만들어 뒀어요. 칸반·이슈 목록 중 원하는 형태가 정해지면 같은 유리 컴포넌트로 채울게요."
          />
        ),
      },
      {
        path: 'security',
        element: (
          <ComingSoonPage
            icon={KeyRound}
            title="보안 & 키"
            description="API 키·접근 권한 관리 화면 자리예요. 샘플 영상에 없는 화면이라 레이아웃이 정해지면 채울게요."
          />
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export function App() {
  return (
    // 운영체제에서 "동작 줄이기"를 켠 사람에게는 등장·hover 애니메이션을 끈다.
    <MotionConfig reducedMotion="user">
      <SettingsProvider>
        <PeriodProvider>
          <RouterProvider router={router} />
        </PeriodProvider>
      </SettingsProvider>
    </MotionConfig>
  )
}

// 페이지는 파일에서 바로 불러온다 — '@/pages' 묶음은 xtool·cmip·parke 페이지를
// 전부 불러와서, 아래에서 따로(lazy) 받으려는 화면까지 첫 번들에 섞인다.
import { AdminPage } from '@/pages/admin-page'
import { BasePage } from '@/pages/base-page'
import { DevPage } from '@/pages/dev-page'
import { createBrowserRouter } from 'react-router-dom'
import { Dev } from '@/screens/dev'
import Cafe24Adjustments from '@/screens/cafe24-adjustments'
import HomeScreen from '@/screens/home'
import PrivacyScreen from '@/screens/privacy'
import PrivacyDocScreen from '@/screens/privacy/doc'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <BasePage />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'privacy', element: <PrivacyScreen /> },
      // 문서별 고정 주소 — 예: /privacy/parke/privacy (구글 개발자 콘솔 등록용)
      { path: 'privacy/:appName/:docType', element: <PrivacyDocScreen /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminPage />,
    children: [
      {
        // Lazy: Parké 관리자 화면만 Firebase SDK(로그인·Realtime Database)를
        // 쓴다 — 다른 화면 번들에 넣지 않는다.
        path: 'parke',
        lazy: async () => ({
          Component: (await import('@/screens/parke')).default,
        }),
      },
      { path: 'cafe24', element: <Cafe24Adjustments /> },
    ],
  },
  {
    // Lazy: the Parké product site carries ~300 kB of its own CSS, and nothing
    // else in the app uses it.
    path: '/parke',
    lazy: async () => ({
      Component: (await import('@/pages/parke-page')).ParkePage,
    }),
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('@/screens/parke-landing')).default,
        }),
      },
      {
        path: 'reservation',
        lazy: async () => ({
          Component: (
            await import('@/screens/parke-landing/reservation-cancel')
          ).default,
        }),
      },
    ],
  },
  {
    // Lazy: xtool·cmip은 화면·스타일이 커서(유리 부품 포함) 그 주소로 들어올
    // 때만 받는다 — 서로의 번들·다른 화면에 섞이지 않는다. 페이지와 화면은
    // 동시에 받는다.
    path: '/xtool-lead-manager',
    lazy: async () => ({
      Component: (await import('@/pages/xtool-page')).XtoolPage,
    }),
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('@/screens/xtool-lead-manager')).default,
        }),
      },
    ],
  },
  {
    path: '/cmip',
    lazy: async () => ({
      Component: (await import('@/pages/cmip-page')).CmipPage,
    }),
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('@/screens/cmip')).default,
        }),
      },
    ],
  },
  {
    // 배치(예약 실행) 함수의 실행 기록 — functions-xtool·functions-cmip 공용.
    path: '/log',
    lazy: async () => ({
      Component: (await import('@/screens/log')).default,
    }),
  },
  {
    path: '/dev',
    element: <DevPage />,
    children: [{ index: true, element: <Dev /> }],
  },
])

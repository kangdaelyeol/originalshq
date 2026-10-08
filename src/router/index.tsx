import { AdminPage, BasePage, XtoolPage, CmipPage, DevPage } from '@/pages'
import { createBrowserRouter } from 'react-router-dom'
import { Dev } from '@/screens/dev'
import Cafe24Adjustments from '@/screens/cafe24-adjustments'
import CmipScreen from '@/screens/cmip'
import HomeScreen from '@/screens/home'
import ParkeScreen from '@/screens/parke'
import PrivacyScreen from '@/screens/privacy'
import XtoolLeadManager from '@/screens/xtool-lead-manager'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <BasePage />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'privacy', element: <PrivacyScreen /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminPage />,
    children: [
      { path: 'parke', element: <ParkeScreen /> },
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
    path: '/xtool-lead-manager',
    element: <XtoolPage />,
    children: [{ index: true, element: <XtoolLeadManager /> }],
  },
  {
    path: '/cmip',
    element: <CmipPage />,
    children: [{ index: true, element: <CmipScreen /> }],
  },
  {
    path: '/dev',
    element: <DevPage />,
    children: [{ index: true, element: <Dev /> }],
  },
])

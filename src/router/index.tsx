import { AdminPage, BasePage, XtoolPage } from '@/pages'
import { CmipPage } from '@/pages/cmip-page'
import CmipScreen from '@/screens/cmip'
import HomeScreen from '@/screens/home'
import ParkeScreen from '@/screens/parke'
import PrivacyScreen from '@/screens/privacy'
import XtoolLeadManager from '@/screens/xtool-lead-manager'
import { createBrowserRouter } from 'react-router-dom'

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
    children: [{ path: 'parke', element: <ParkeScreen /> }],
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
])

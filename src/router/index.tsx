import { AdminPage, BasePage, XtoolPage } from '@/pages'
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
])

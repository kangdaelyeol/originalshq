import AdminPage from '@/pages/admin-page'
import BasePage from '@/pages/base-page'
import HomeScreen from '@/screens/home'
import ParkeScreen from '@/screens/parke'
import PrivacyScreen from '@/screens/privacy'
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
])

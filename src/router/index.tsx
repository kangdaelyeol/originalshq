import BasePage from '@/pages/base-page'
import HomeScreen from '@/screens/home'
import { createBrowserRouter } from 'react-router-dom'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <BasePage />,
    children: [{ index: true, element: <HomeScreen /> }],
  },
])

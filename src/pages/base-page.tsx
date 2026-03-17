import { Footer } from '@/components/footer'
import { Nav } from '@/components/navigation-bar'
import { Outlet } from 'react-router-dom'

export default function BasePage() {
  return (
    <div>
      <Nav />
      <Outlet />
      <Footer />
    </div>
  )
}

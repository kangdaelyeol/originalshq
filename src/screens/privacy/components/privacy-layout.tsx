import type { ReactNode } from 'react'
import { Footer, Header } from '@/screens/home/components'
import HomeStyles from '@/screens/home/styles/global.module.scss'

/** 개인정보 관련 페이지의 틀 — 홈페이지와 같은 머리글·바닥글·검은 배경 위에
 * 내용을 얹는다. 홈과 같은 틀(HomeStyles.home / wrap)을 그대로 써서 색과
 * 여백이 홈페이지와 어긋나지 않게 한다. */
export const PrivacyLayout = ({ children }: { children: ReactNode }) => (
  <div className={HomeStyles.home}>
    <div className={HomeStyles.wrap}>
      <Header />
      <main className="privacy-main">{children}</main>
      <Footer />
    </div>
  </div>
)

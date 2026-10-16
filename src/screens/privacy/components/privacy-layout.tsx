import type { ReactNode } from 'react'
import { Footer, Header } from '@/screens/home/components'
import HomeStyles from '@/screens/home/styles/global.module.scss'

/** 개인정보 관련 페이지의 틀 — 홈페이지와 같은 머리글·바닥글·검은 배경 위에
 * 내용을 얹는다. 홈과 같은 틀(HomeStyles.home / wrap)을 그대로 써서 색과
 * 여백이 홈페이지와 어긋나지 않게 한다. */
export const PrivacyLayout = ({ children }: { children: ReactNode }) => (
  <div className={HomeStyles.home}>
    {/* privacy-wrap — 홈의 wrap은 width 100%에 좌우 여백(50px)을 더해 화면보다
        100px 넓어진다(홈에서는 넘친 부분이 가려져 티가 안 난다). 문서는 글이
        오른쪽 끝까지 차서 잘려 보이므로, 여기서는 여백을 폭 안에 넣는다. */}
    <div className={`${HomeStyles.wrap} privacy-wrap`}>
      <Header />
      <main className="privacy-main">{children}</main>
      <Footer />
    </div>
  </div>
)

import { RevealContextProvider } from '@/context/reveal-context'
import {
  Hero,
  About,
  Products,
  Contact,
  BackToTopButton,
  Footer,
  Header,
} from './components'
import Styles from '@/screens/home/styles/global.module.scss'

export default function HomeScreen() {
  return (
    <RevealContextProvider>
      <div className={Styles.home}>
        <div className={Styles.wrap}>
          <Header />
          <Hero />
          <About />
          <Products />
          <Contact />
          <BackToTopButton />
          <Footer />
        </div>
      </div>
    </RevealContextProvider>
  )
}

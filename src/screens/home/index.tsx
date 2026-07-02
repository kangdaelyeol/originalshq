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

export default function HomeScreen() {
  return (
    <RevealContextProvider>
      <Header />
      <Hero />
      <About />
      <Products />
      <Contact />
      <BackToTopButton />
      <Footer />
    </RevealContextProvider>
  )
}

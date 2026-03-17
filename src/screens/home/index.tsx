import { RevealContextProvider } from '@/context/reveal-context'
import { Hero, About, Products, Contact, BackToTopButton } from './components'

export default function HomeScreen() {
  return (
    <RevealContextProvider>
      <Hero />
      <About />
      <Products />
      <Contact />
      <BackToTopButton />
    </RevealContextProvider>
  )
}

import { About } from './components/about'
import { BackToTopButton } from './components/back-to-top-button'
import { Contact } from './components/contact'
import { Footer } from './components/footer'
import { Hero } from './components/hero'
import { Nav } from './components/navigation-bar'
import { Products } from './components/products'
import { RevealContextProvider } from './context/reveal-context'

function App() {
  return (
    <RevealContextProvider>
      <Nav />
      <Hero />
      <About />
      <Products />
      <Contact />
      <Footer />
      <BackToTopButton />
    </RevealContextProvider>
  )
}

export default App

import { RevealContextProvider } from '@/context/reveal-context'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'

function App() {
  return (
    <RevealContextProvider>
      <RouterProvider router={router} />
    </RevealContextProvider>
  )
}

export default App

// 함수 하나씩 — 'lodash' 전체(CJS)를 부르면 라이브러리 통째로 첫 번들에 들어간다.
import debounce from 'lodash/debounce'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react'

interface RevealContextValue {
  pushRevealRef: (ref: React.RefObject<HTMLDivElement>) => void
}

const RevealContext = createContext({} as RevealContextValue)

export const RevealContextProvider = ({ children }: PropsWithChildren) => {
  const [revealRefList, setRevealRefList] = useState(
    [] as React.RefObject<HTMLDivElement>[],
  )

  const checkElements = useCallback(() => {
    const windowHeight = window.innerHeight
    const revealPoint = 100

    revealRefList.forEach((ref) => {
      const elementTop = ref.current.getBoundingClientRect().top

      if (elementTop < windowHeight - revealPoint) {
        ref.current.classList.add('active')
      }
    })
  }, [revealRefList])

  const pushRevealRef = useCallback((ref: React.RefObject<HTMLDivElement>) => {
    setRevealRefList((prev) => [...prev, ref])
  }, [])

  useEffect(() => {
    const listener = debounce(checkElements, 50)
    window.addEventListener('scroll', listener)
    window.addEventListener('resize', listener)

    return () => {
      window.removeEventListener('scroll', listener)
      window.removeEventListener('resize', listener)
    }
  }, [checkElements, revealRefList])

  return (
    <RevealContext.Provider value={{ pushRevealRef }}>
      {children}
    </RevealContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useRevealContext = () => useContext(RevealContext)

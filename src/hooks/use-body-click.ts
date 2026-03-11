import { useEffect } from 'react'

export const useBodyClick = (listener: (e: PointerEvent) => void) => {
  useEffect(() => {
    document.addEventListener('click', listener)

    return () => {
      document.removeEventListener('click', listener)
    }
  }, [])
}

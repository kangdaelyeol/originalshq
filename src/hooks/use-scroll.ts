import { useEffect } from 'react'
import { throttle } from 'lodash'

interface UseScrollProps {
  listener: () => void
  wait: number
}

export const useScroll = ({ listener, wait }: UseScrollProps) => {
  useEffect(() => {
    window.addEventListener('scroll', listener)
    return () => {
      window.removeEventListener('scroll', throttle(listener, wait))
    }
  }, [])
}

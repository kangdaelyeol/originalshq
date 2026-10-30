import { useEffect } from 'react'
// 함수 하나씩 — 'lodash' 전체(CJS)를 부르면 라이브러리 통째로 첫 번들에 들어간다.
import throttle from 'lodash/throttle'

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

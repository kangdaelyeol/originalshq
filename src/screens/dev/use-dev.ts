import { useEffect } from 'react'

export const useDev = () => {
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      console.log(e)
    }
    console.log('effect')
    addEventListener('keydown', onKeydown)
    return () => {
      console.log('clean up func')
      removeEventListener('keydown', onKeydown)
    }
  }, [])

  return
}

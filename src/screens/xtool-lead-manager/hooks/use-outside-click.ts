import { useEffect } from 'react'

export const useOutsideClick = (
  ref: React.RefObject<HTMLElement | null>,
  cb: () => void,
) => {
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) cb()
    }
    document.body.addEventListener('mousedown', onMouseDown)

    return () => {
      document.body.removeEventListener('mousedown', onMouseDown)
    }
  }, [ref, cb])
}

import { useEffect, useRef, type RefObject } from 'react'

/** 모달 공통 — 떠 있는 동안 배경 스크롤을 막고, Esc로 닫고, 열릴 때
 * focusRef로 포커스를 옮긴다. onClose는 매 렌더 바뀌어도 된다. */
export const useDialog = (
  onClose: () => void,
  focusRef?: RefObject<HTMLElement | null>,
) => {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    focusRef?.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
    }
    // 열릴 때 한 번만 — focusRef는 ref라 바뀌지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

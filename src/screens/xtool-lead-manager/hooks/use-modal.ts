import { useEffect, useRef, type RefObject } from 'react'

// 지금 떠 있는 모달들 — 나중에 열린 것이 뒤에. 모달이 겹치면(상세 모달 위의
// 삭제 확인창) 맨 위 모달만 Esc에 반응해야 하고, 배경 스크롤 잠금은 마지막
// 모달이 닫힐 때만 풀어야 한다.
const openModals: object[] = []

const isTopModal = (token: object) =>
  openModals[openModals.length - 1] === token

/**
 * 모달 공통 동작 — 떠 있는 동안 배경 스크롤을 잠그고, Esc로 닫고, 열릴 때
 * 포커스를 옮긴다(initialFocus를 주면). 다른 모달 위에 떠 있으면 Esc는 이
 * 모달만 닫는다.
 *
 * onClose는 매 렌더 바뀌어도 된다(항상 최신 것을 부른다). 지금은 닫으면 안
 * 되는 상황(저장 중 등)이면 onClose 안에서 무시하면 된다.
 */
export const useModal = (
  onClose: () => void,
  initialFocus?: RefObject<HTMLElement | null>,
) => {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const token = {}
    openModals.push(token)
    document.body.style.overflow = 'hidden'
    initialFocus?.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isTopModal(token)) onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      openModals.splice(openModals.indexOf(token), 1)
      if (openModals.length === 0) document.body.style.overflow = ''
    }
    // 처음 열릴 때 한 번만 — initialFocus는 ref라 바뀌지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

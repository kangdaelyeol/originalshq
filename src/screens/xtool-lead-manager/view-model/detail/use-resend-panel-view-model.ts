import { useState } from 'react'

/*
 * Meta 이벤트 재전송 패널의 상태 — 테스트 이벤트로 보낼지, 그 코드, 전송 중
 * 여부. 테스트를 켰더라도 코드가 비어 있으면 일반 이벤트로 보낸다.
 */
export const useResendPanelViewModel = (
  onResend: (testEventCode?: string) => Promise<void>,
  onClose: () => void,
) => {
  const [isTest, setIsTest] = useState(false)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  return {
    state: { isTest, code, submitting },
    actions: {
      toggleTest: () => setIsTest((v) => !v),
      setCode,
      submit: async () => {
        setSubmitting(true)
        await onResend(isTest && code.trim() ? code.trim() : undefined)
        setSubmitting(false)
        onClose()
      },
    },
  }
}

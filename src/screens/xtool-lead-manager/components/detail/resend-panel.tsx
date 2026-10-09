import { useResendPanelViewModel } from '@/screens/xtool-lead-manager/view-model/detail'

/** Meta 이벤트 재전송 직전에 "테스트 이벤트로 보낼지"를 그 자리에서 고르는
 * 패널 — 예전엔 표의 행마다 있던 테스트 체크박스/코드 입력을 재전송 시점
 * 하나로 옮긴 자리라, window.confirm 대신 이 패널의 취소/보내기 버튼이
 * 확인 역할까지 겸한다. */
export function ResendPanel({
  onResend,
  onClose,
}: {
  onResend: (testEventCode?: string) => Promise<void>
  onClose: () => void
}) {
  const { state, actions } = useResendPanelViewModel(onResend, onClose)
  const { isTest, code, submitting } = state
  const { toggleTest, setCode, submit } = actions

  return (
    <div className="resend_panel" onClick={(e) => e.stopPropagation()}>
      <label className="toggle">
        <input
          type="checkbox"
          checked={isTest}
          onChange={toggleTest}
        />
        <span>테스트 이벤트로 전송</span>
      </label>
      {isTest && (
        <input
          className="code_input"
          placeholder="test_event_code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      )}
      <div className="actions">
        <button
          type="button"
          className="cancel_btn"
          onClick={onClose}
          disabled={submitting}
        >
          취소
        </button>
        <button
          type="button"
          className="save_btn"
          disabled={submitting}
          onClick={submit}
        >
          {submitting ? '전송 중...' : '보내기'}
        </button>
      </div>
    </div>
  )
}

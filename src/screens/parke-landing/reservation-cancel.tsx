import { Link } from 'react-router-dom'
import { useReservationCancelViewModel } from './view-model'

/** Cancellation page reached from the receipt link in the reservation dialog. */
export default function ReservationCancel() {
  const { state, actions } = useReservationCancelViewModel()
  const { id, status, busy, done, canCancel } = state

  return (
    <main className="pf-cancel-page">
      <Link to="/parke">Parké</Link>
      <h1>예약 취소</h1>
      <p>접수 번호: {id || '접수증의 취소 링크로 접속해 주세요.'}</p>
      {status && <p role="status">{status}</p>}
      {!done && (
        <button
          className="pf-primary"
          disabled={!canCancel}
          onClick={actions.cancel}
        >
          {busy ? '처리 중…' : '예약 취소 및 정보 삭제'}
        </button>
      )}
      <Link to="/parke">제품 페이지로 돌아가기</Link>
    </main>
  )
}

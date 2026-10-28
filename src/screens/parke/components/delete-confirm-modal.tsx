import { useRef } from 'react'
import { useParkeContext } from '@/screens/parke/context'
import { useCardDetail } from '@/screens/parke/controller/use-card-detail'
import { useDialog } from '@/screens/parke/controller/use-dialog'
import { formatCardPhone } from '@/screens/parke/entity/card'
import '@/screens/parke/styles/admin-ui.scss'

/** 시리얼 삭제 확인 — 등록된 카드면 누구의 카드인지 보여주고, 카드까지
 * 지워진다고 알린다. 지운 뒤에는 토스트·삭제 기록에서 되돌릴 수 있다. */
const DeleteConfirm = ({ serial }: { serial: string }) => {
  const { confirmDelete, cancelDelete, deleting } = useParkeContext()
  const { status, card } = useCardDetail(serial)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useDialog(() => {
    if (!deleting) cancelDelete()
  }, cancelRef)

  return (
    <div className="parke-dialog" onClick={() => !deleting && cancelDelete()}>
      <div
        className="parke-dialog__box is-narrow"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-title" className="parke-dialog__title">
          <span className="parke-dialog__mono">{serial}</span>을(를) 삭제할까요?
        </h2>
        {status === 'loading' && (
          <p className="parke-dialog__text">카드 정보를 확인하는 중…</p>
        )}
        {status === 'ready' && card && (
          <div className="parke-dialog__warn">
            앱 사용자가 등록한 카드도 함께 삭제됩니다.
            <dl>
              <dt>카드 이름</dt>
              <dd>{card.title || '-'}</dd>
              <dt>휴대전화번호</dt>
              <dd className="parke-dialog__mono">
                {card.phone ? formatCardPhone(card.phone) : '-'}
              </dd>
            </dl>
          </div>
        )}
        {status === 'ready' && !card && (
          <p className="parke-dialog__text">아직 등록되지 않은 시리얼입니다.</p>
        )}
        {status === 'error' && (
          <p className="parke-dialog__text">
            카드 정보를 확인하지 못했습니다. 등록된 카드가 있다면 함께
            삭제됩니다.
          </p>
        )}
        <p className="parke-dialog__hint">
          삭제한 뒤에도 알림의 "되돌리기"나 아래 삭제 기록에서 되돌릴 수
          있습니다.
        </p>
        <div className="parke-dialog__actions">
          <button
            ref={cancelRef}
            type="button"
            className="parke-btn is-ghost"
            onClick={cancelDelete}
            disabled={deleting}
          >
            취소
          </button>
          <button
            type="button"
            className="parke-btn is-danger"
            onClick={() => void confirmDelete()}
            disabled={deleting || status === 'loading'}
          >
            {deleting ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}

export const DeleteConfirmModal = () => {
  const { pendingDelete } = useParkeContext()
  // 시리얼이 바뀌면 새로 그린다(카드 조회 상태가 섞이지 않게).
  return pendingDelete ? (
    <DeleteConfirm key={pendingDelete} serial={pendingDelete} />
  ) : null
}

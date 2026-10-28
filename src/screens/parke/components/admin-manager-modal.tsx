import { useRef } from 'react'
import { useAdminList } from '@/screens/parke/controller/use-admin-list'
import { useDialog } from '@/screens/parke/controller/use-dialog'
import '@/screens/parke/styles/admin-ui.scss'

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

/** 관리자 관리 — Google 계정 이메일로 추가·제거. 추가된 사람은 그 계정으로
 * 로그인하면 바로 들어올 수 있다. 자기 자신은 제거할 수 없다. */
export const AdminManagerModal = ({
  myEmail,
  onClose,
}: {
  myEmail: string
  onClose: () => void
}) => {
  const { admins, status, draft, setDraft, busy, message, add, remove } =
    useAdminList(myEmail)
  const inputRef = useRef<HTMLInputElement>(null)
  useDialog(onClose, inputRef)
  const me = myEmail.toLowerCase()

  return (
    <div className="parke-dialog" onClick={onClose}>
      <div
        className="parke-dialog__box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="parke-dialog__head">
          <h2 id="admin-title" className="parke-dialog__title">
            관리자 관리
          </h2>
          <button
            type="button"
            className="parke-dialog__close"
            aria-label="닫기"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="parke-dialog__text">
          여기 있는 Google 계정만 이 화면에 들어오고 시리얼을 만들거나 지울 수
          있습니다.
        </p>
        <form
          className="parke-admin__add"
          onSubmit={(event) => {
            event.preventDefault()
            void add()
          }}
        >
          <input
            ref={inputRef}
            type="email"
            placeholder="추가할 Google 계정 이메일"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="추가할 관리자 이메일"
          />
          <button
            type="submit"
            className="parke-btn"
            disabled={busy || !draft.trim()}
          >
            추가
          </button>
        </form>
        {message && <p className="parke-dialog__hint">{message}</p>}

        {status === 'loading' && (
          <p className="parke-dialog__text">불러오는 중…</p>
        )}
        {status === 'error' && (
          <p className="parke-dialog__text">
            관리자 목록을 불러오지 못했습니다
          </p>
        )}
        {status === 'ready' && (
          <ul className="parke-admin__list">
            {admins.map((admin) => (
              <li key={admin.key}>
                <div>
                  <span className="parke-admin__email">
                    {admin.email}
                    {admin.email === me && <em> (나)</em>}
                  </span>
                  <span className="parke-admin__meta">
                    {admin.addedAt
                      ? `${formatDate(admin.addedAt)} 추가`
                      : '추가일 없음'}
                    {admin.addedBy ? ` · ${admin.addedBy}` : ''}
                  </span>
                </div>
                {admin.email !== me && (
                  <button
                    type="button"
                    className="parke-btn is-small is-ghost"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `${admin.email}을(를) 관리자에서 제거할까요?`,
                        )
                      )
                        void remove(admin.email)
                    }}
                  >
                    제거
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

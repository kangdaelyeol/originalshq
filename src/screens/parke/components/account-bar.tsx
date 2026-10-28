import '@/screens/parke/styles/admin-ui.scss'

/** 헤더 아래 — 로그인한 관리자, 관리자 관리, 로그아웃. */
export const AccountBar = ({
  email,
  onManageAdmins,
  onSignOut,
}: {
  email: string
  onManageAdmins: () => void
  onSignOut: () => void
}) => (
  <div className="parke-account">
    <span className="parke-account__email">{email}</span>
    <button
      type="button"
      className="parke-btn is-small is-ghost"
      onClick={onManageAdmins}
    >
      관리자 관리
    </button>
    <button
      type="button"
      className="parke-btn is-small is-ghost"
      onClick={onSignOut}
    >
      로그아웃
    </button>
  </div>
)

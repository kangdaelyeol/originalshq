import '@/screens/parke/styles/admin-ui.scss'

/** 관리자 화면에 들어오기 전 — 로그인 확인 중 / Google 로그인 / 권한 없음. */
export const AuthScreen = ({
  status,
  email,
  error,
  onSignIn,
  onSignOut,
}: {
  status: 'loading' | 'signedOut' | 'notAdmin'
  email?: string
  error: string | null
  onSignIn: () => void
  onSignOut: () => void
}) => (
  <div className="parke-auth">
    {status === 'loading' && <p className="parke-auth__text">확인 중…</p>}
    {status === 'signedOut' && (
      <>
        <p className="parke-auth__text">
          관리자 Google 계정으로 로그인해 주세요.
        </p>
        <button type="button" className="parke-btn" onClick={onSignIn}>
          Google로 로그인
        </button>
      </>
    )}
    {status === 'notAdmin' && (
      <>
        <p className="parke-auth__text">
          <strong>{email}</strong>은(는) 관리자로 등록되지 않은 계정입니다.
          <span>기존 관리자에게 추가를 요청해 주세요.</span>
        </p>
        <button
          type="button"
          className="parke-btn is-ghost"
          onClick={onSignOut}
        >
          다른 계정으로 로그인
        </button>
      </>
    )}
    {error && <p className="parke-auth__error">{error}</p>}
  </div>
)

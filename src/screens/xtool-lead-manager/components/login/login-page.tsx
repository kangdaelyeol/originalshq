import '@/screens/xtool-lead-manager/styles/login.scss'
import { useState, type FormEvent } from 'react'
import { Spinner, ThemePicker, type GlassThemeId } from '@/components/glass'
import { DENIED_MESSAGE } from '@/xtool-auth/access'
import {
  completePasswordSetup,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutXtool,
  type AuthOutcome,
} from '@/xtool-auth/auth-actions'
import { MIN_PASSWORD } from '@/xtool-auth/members'
import type { XtoolSession } from '@/xtool-auth/use-xtool-session'

/**
 * 리드 관리자 로그인 — 가입한 사람(xtool 구성원, 관리자가 아니어도) 누구나. 계정은
 * 관리자 화면(/admin/xtool)이 발급하고 기술 보드·/log와 같아서, 한쪽에서 로그인하면
 * 다른 쪽도 로그인돼 있다. 서버도 요청마다 같은 기준으로 다시 확인한다
 * (functions-xtool admin-auth.ts checkMember).
 *
 * 임시 비밀번호로 처음 들어오면 로그인을 유지한 채 여기서 바로 자기 비밀번호를
 * 정한다. 들어갈 수 없는 계정(등록 안 됨·정지)은 이유를 보이고 다른 계정으로.
 */
export const LoginPage = ({
  session,
  theme,
  onSelectTheme,
}: {
  /** ready가 아닌 상태 — ready면 부모가 화면을 보여 준다. */
  session: Exclude<XtoolSession, { status: 'ready' }>
  theme: GlassThemeId
  onSelectTheme: (theme: GlassThemeId) => void
}) => {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const run = async (action: Promise<AuthOutcome>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    const outcome = await action
    // 성공하면 세션이 바뀌면서 화면으로 넘어간다.
    if (!outcome.ok && !outcome.cancelled) {
      if (outcome.setupDone) setNotice(outcome.message)
      else setError(outcome.message)
    }
    setBusy(false)
  }

  const signIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    void run(
      signInWithEmail(email, String(data.get('password') ?? ''), 'member'),
    )
  }

  const setUpPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') ?? '')
    if (password.length < MIN_PASSWORD) {
      setError(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요.`)
      return
    }
    if (password !== String(data.get('confirm') ?? '')) {
      setError('두 비밀번호가 같지 않아요.')
      return
    }
    void run(completePasswordSetup(password, 'member'))
  }

  const resetPassword = async () => {
    if (busy) return
    if (!email.trim()) {
      setError('비밀번호를 다시 정할 이메일을 먼저 넣어 주세요.')
      return
    }
    setBusy(true)
    setError(null)
    const outcome = await sendPasswordReset(email)
    setBusy(false)
    if (outcome.ok)
      setNotice(
        '비밀번호를 다시 정하는 메일을 보냈어요. 등록된 이메일이면 곧 도착해요.',
      )
    else setError(outcome.message)
  }

  const messages = (
    <>
      {error && (
        <p id="lm-login-error" className="lm_login__error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="lm_login__notice" role="status">
          {notice}
        </p>
      )}
    </>
  )

  const body = (() => {
    switch (session.status) {
      case 'loading':
        return (
          <div className="lm_login__loading">
            <Spinner label="로그인 확인 중" />
          </div>
        )
      case 'unconfigured':
        return (
          <p className="lm_login__notice" role="status">
            Firebase 웹 앱 설정(src/xtool-auth/firebase-config.ts)이 비어
            있어요.
          </p>
        )
      case 'denied':
        // 임시 비밀번호로 들어왔다 — 로그인은 유지한 채 새 비밀번호부터.
        if (session.reason === 'password-setup')
          return (
            <>
              <p className="lm_login__lead">
                {session.email} — 임시 비밀번호로 로그인했어요. 앞으로 쓸
                비밀번호를 정해 주세요.
              </p>
              <form
                className="lm_login__form"
                onSubmit={setUpPassword}
                inert={busy}
              >
                <label className="lm_login__field">
                  <span>새 비밀번호</span>
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD}
                    required
                    onChange={() => setError(null)}
                  />
                </label>
                <label className="lm_login__field">
                  <span>새 비밀번호 확인</span>
                  <input
                    type="password"
                    name="confirm"
                    autoComplete="new-password"
                    required
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'lm-login-error' : undefined}
                    onChange={() => setError(null)}
                  />
                </label>
                {messages}
                <button type="submit" className="lm_login__submit">
                  {busy ? '저장하는 중…' : '비밀번호 정하고 들어가기'}
                </button>
              </form>
              <button
                type="button"
                className="lm_login__link"
                onClick={() => void signOutXtool()}
              >
                다른 계정으로 로그인
              </button>
            </>
          )
        return (
          <>
            <p className="lm_login__notice" role="status">
              {session.email} — {DENIED_MESSAGE[session.reason]}
            </p>
            <button
              type="button"
              className="lm_login__submit"
              onClick={() => void signOutXtool()}
            >
              다른 계정으로 로그인
            </button>
          </>
        )
      case 'signedOut':
        return (
          <>
            <form className="lm_login__form" onSubmit={signIn} inert={busy}>
              <label className="lm_login__field">
                <span>이메일</span>
                <input
                  type="email"
                  name="email"
                  placeholder="name@xtool.co.kr"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError(null)
                  }}
                  required
                />
              </label>
              <label className="lm_login__field">
                <span>비밀번호</span>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'lm-login-error' : undefined}
                  onChange={() => setError(null)}
                />
              </label>
              {messages}
              <button type="submit" className="lm_login__submit">
                {busy ? '확인하는 중…' : '로그인'}
              </button>
            </form>
            <button
              type="button"
              className="lm_login__link"
              disabled={busy}
              onClick={() => void resetPassword()}
            >
              비밀번호를 잊으셨나요?
            </button>
            <p className="lm_login__or">또는</p>
            <button
              type="button"
              className="lm_login__google"
              disabled={busy}
              // 팝업이 막히지 않게 클릭 안에서 곧바로 부른다.
              onClick={() => void run(signInWithGoogle('member'))}
            >
              Google 계정으로 로그인
            </button>
          </>
        )
    }
  })()

  return (
    <main className="lm_login">
      <div className="lm_login__theme">
        <ThemePicker value={theme} onChange={onSelectTheme} />
      </div>
      <section className="lm_login__card" aria-labelledby="lm-login-title">
        <div className="lm_login__brand">
          <img
            src="https://www.xtool.co.kr/web/upload/goodymall/kr/main/LOGO_1.png"
            alt="xtool"
            className="xtool-logo"
          />
          <span>Lead manager</span>
        </div>
        <h1 id="lm-login-title">
          {session.status === 'denied' && session.reason === 'password-setup'
            ? '비밀번호 정하기'
            : '로그인'}
        </h1>
        {session.status === 'signedOut' && (
          <p className="lm_login__lead">
            xtool 팀 계정으로 로그인해 주세요. 계정은 관리자에게 발급을 요청하면
            돼요.
          </p>
        )}
        {body}
      </section>
    </main>
  )
}

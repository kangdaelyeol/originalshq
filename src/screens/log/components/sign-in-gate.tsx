import { useState, type FormEvent } from 'react'
import { DENIED_MESSAGE } from '@/xtool-auth/access'
import {
  signInWithEmail,
  signInWithGoogle,
  signOutXtool,
  type AuthOutcome,
} from '@/xtool-auth/auth-actions'
import type { XtoolSession } from '@/xtool-auth/use-xtool-session'

type Props = {
  session: Exclude<XtoolSession, { status: 'ready' } | { status: 'loading' }>
}

/**
 * /log 잠금 — xtool 관리자만 들어온다(문의 고객의 연락처와 기록 지우기·다시
 * 실행·문자 설정이 있어서). 계정은 /admin/xtool과 같다 — 한쪽에서 로그인하면
 * 다른 쪽도 로그인돼 있다. 서버도 같은 기준으로 다시 확인한다(admin-auth.ts).
 */
export const SignInGate = ({ session }: Props) => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (signingIn: Promise<AuthOutcome>) => {
    setBusy(true)
    setError(null)
    const outcome = await signingIn
    // 성공하면 세션이 바뀌면서 로그 화면으로 넘어간다.
    if (!outcome.ok && !outcome.cancelled) setError(outcome.message)
    setBusy(false)
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    void run(
      signInWithEmail(
        String(data.get('email') ?? ''),
        String(data.get('password') ?? ''),
        'admin',
      ),
    )
  }

  return (
    <main className="log-gate">
      <section className="log-gate__card" aria-labelledby="log-gate-title">
        <p className="log-gate__brand">
          ORIGINALS<i>/</i>OPS LOG
        </p>
        <h1 id="log-gate-title">관리자 로그인</h1>
        <p className="log-gate__lead">
          실행 기록과 문의 고객 정보가 있어 xtool 관리자만 볼 수 있어요.
        </p>

        {session.status === 'unconfigured' ? (
          <p className="log-gate__note" role="status">
            Firebase 웹 앱 설정(src/xtool-auth/firebase-config.ts)이 비어
            있어요.
          </p>
        ) : session.status === 'denied' ? (
          <>
            <p className="log-gate__note" role="status">
              {session.email} —{' '}
              {session.reason === 'no-access'
                ? '관리자 권한이 없는 계정이에요.'
                : DENIED_MESSAGE[session.reason]}
            </p>
            <button
              type="button"
              className="log-gate__submit"
              onClick={() => void signOutXtool()}
            >
              다른 계정으로 로그인
            </button>
          </>
        ) : (
          <>
            <form className="log-gate__form" onSubmit={onSubmit} inert={busy}>
              <label>
                <span>이메일</span>
                <input
                  type="email"
                  name="email"
                  placeholder="name@xtool.co.kr"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                <span>비밀번호</span>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'log-gate-error' : undefined}
                  onChange={() => setError(null)}
                />
              </label>
              {error && (
                <p id="log-gate-error" className="log-gate__error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="log-gate__submit">
                {busy ? '확인하는 중…' : '로그인'}
              </button>
            </form>
            <p className="log-gate__or">또는</p>
            <button
              type="button"
              className="log-gate__google"
              disabled={busy}
              // 팝업이 막히지 않게 클릭 안에서 곧바로 부른다.
              onClick={() => void run(signInWithGoogle('admin'))}
            >
              Google 계정으로 로그인
            </button>
            <p className="log-gate__hint">
              계정·권한은 <a href="/admin/xtool">xtool 관리자 화면</a>과 같아요.
            </p>
          </>
        )}
      </section>
    </main>
  )
}

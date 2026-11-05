import { useState, type FormEvent, type ReactNode } from 'react'
import { DENIED_MESSAGE } from '@xtool-core/access'
import {
  signInWithEmail,
  signInWithGoogle,
  signOutXtool,
  type AuthOutcome,
} from './auth-actions'
import { useXtoolSession } from './use-xtool-session'
import './admin-gate.scss'

/**
 * 관리자 화면 잠금 — xtool 관리자(활성·관리자·메일 인증)만 children을 본다.
 * /cmip·/admin/cafe24처럼 functions-cmip을 부르는 화면에 씌운다. 서버도 같은
 * 기준으로 다시 확인한다(functions-cmip auth.ts). 계정은 /admin/xtool·/log와
 * 같아서 한쪽에서 로그인하면 다른 쪽도 로그인돼 있다.
 */
export function AdminGate({
  title,
  lead,
  children,
}: {
  /** 카드 제목 — "CMIP" 등. */
  title: string
  /** 왜 잠갔는지 한 줄. */
  lead: string
  children: ReactNode
}) {
  const session = useXtoolSession('admin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session.status === 'ready') return <>{children}</>
  if (session.status === 'loading') return <main className="admin-gate" />

  const run = async (signingIn: Promise<AuthOutcome>) => {
    setBusy(true)
    setError(null)
    const outcome = await signingIn
    // 성공하면 세션이 바뀌면서 children으로 넘어간다.
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
    <main className="admin-gate">
      <section className="admin-gate__card" aria-labelledby="admin-gate-title">
        <p className="admin-gate__brand">{title}</p>
        <h1 id="admin-gate-title">관리자 로그인</h1>
        <p className="admin-gate__lead">{lead}</p>

        {session.status === 'unconfigured' ? (
          <p className="admin-gate__note" role="status">
            Firebase 웹 앱 설정(src/xtool-auth/firebase-config.ts)이 비어
            있어요.
          </p>
        ) : session.status === 'denied' ? (
          <>
            <p className="admin-gate__note" role="status">
              {session.email} —{' '}
              {session.reason === 'no-access'
                ? '관리자 권한이 없는 계정이에요.'
                : DENIED_MESSAGE[session.reason]}
            </p>
            <button
              type="button"
              className="admin-gate__submit"
              onClick={() => void signOutXtool()}
            >
              다른 계정으로 로그인
            </button>
          </>
        ) : (
          <>
            <form className="admin-gate__form" onSubmit={onSubmit} inert={busy}>
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
                  aria-describedby={error ? 'admin-gate-error' : undefined}
                  onChange={() => setError(null)}
                />
              </label>
              {error && (
                <p
                  id="admin-gate-error"
                  className="admin-gate__error"
                  role="alert"
                >
                  {error}
                </p>
              )}
              <button type="submit" className="admin-gate__submit">
                {busy ? '확인하는 중…' : '로그인'}
              </button>
            </form>
            <p className="admin-gate__or">또는</p>
            <button
              type="button"
              className="admin-gate__google"
              disabled={busy}
              // 팝업이 막히지 않게 클릭 안에서 곧바로 부른다.
              onClick={() => void run(signInWithGoogle('admin'))}
            >
              Google 계정으로 로그인
            </button>
            <p className="admin-gate__hint">
              계정·권한은 <a href="/admin/xtool">xtool 관리자 화면</a>과 같아요.
            </p>
          </>
        )}
      </section>
    </main>
  )
}

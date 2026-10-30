import { ArrowRight, Info, Lock, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { DENIED_MESSAGE } from '@/xtool-auth/access'
import { signInWithEmail, signInWithGoogle, signOutXtool, type AuthOutcome } from '@/xtool-auth/auth-actions'
import type { XtoolSession } from '@/xtool-auth/use-xtool-session'
import { BrandMark } from '@/screens/xtool-tech/components/brand/brand-mark'
import { GoogleMark } from '@/screens/xtool-tech/components/login/brand-marks'
import { LoginField } from '@/screens/xtool-tech/components/login/login-field'
import { xtPath } from '@/screens/xtool-tech/paths'

type Props = { session: Exclude<XtoolSession, { status: 'ready' } | { status: 'loading' }> }

/** 관리자 로그인 — 기술팀 보드의 로그인 연출 없이, 같은 유리 판 위에 간단히. */
export function AdminSignIn({ session }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (signingIn: Promise<AuthOutcome>) => {
    setBusy(true)
    setError(null)
    const outcome = await signingIn
    // 성공하면 세션이 바뀌면서 관리 화면으로 넘어간다.
    if (!outcome.ok && !outcome.cancelled) setError(outcome.message)
    setBusy(false)
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return
    const data = new FormData(e.currentTarget)
    void run(signInWithEmail(String(data.get('email') ?? ''), String(data.get('password') ?? ''), 'admin'))
  }

  return (
    <main className="admin-gate">
      <section className="glass admin-gate__card" aria-labelledby="admin-gate-title">
        <div className="admin-gate__brand">
          <BrandMark />
          <div>
            <h1 id="admin-gate-title">xtool 관리자</h1>
            <p>구성원 등록 · 팀 권한 관리</p>
          </div>
        </div>

        {session.status === 'unconfigured' ? (
          <p className="login-note login-note--info">
            <Info size={15} aria-hidden />
            Firebase 웹 앱 설정(src/xtool-auth/firebase-config.ts)이 비어 있어요. 설정을 넣으면 로그인할 수 있어요.
          </p>
        ) : session.status === 'denied' ? (
          <>
            <p className="login-note login-note--info" role="status">
              <Info size={15} aria-hidden />
              {session.email} — {session.reason === 'no-access' ? '관리자 권한이 없는 계정이에요.' : DENIED_MESSAGE[session.reason]}
            </p>
            <button type="button" className="login-submit" onClick={() => void signOutXtool()}>
              다른 계정으로 로그인
              <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
            </button>
          </>
        ) : (
          <>
            <form className="login-form" onSubmit={onSubmit} inert={busy}>
              <LoginField
                label="이메일"
                icon={Mail}
                type="email"
                name="email"
                placeholder="name@xtool.co.kr"
                autoComplete="username"
                required
              />
              <LoginField
                label="비밀번호"
                icon={Lock}
                type="password"
                name="password"
                placeholder="비밀번호 입력"
                autoComplete="current-password"
                required
                error={error}
                onChange={() => setError(null)}
              />
              <button type="submit" className="login-submit">
                {busy ? '확인하는 중…' : '로그인'}
                <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
              </button>
            </form>
            <p className="login-divider">또는</p>
            <div className="login-social login-social--single">
              <button
                type="button"
                className="social-button"
                disabled={busy}
                onClick={() => void run(signInWithGoogle('admin'))}
              >
                <GoogleMark />
                Google 계정으로 로그인
              </button>
            </div>
            <p className="admin-gate__hint">
              비밀번호 계정이 처음이면 <a href={xtPath('/login')}>기술팀 로그인 화면</a>에서 회원가입부터 해 주세요.
            </p>
          </>
        )}
      </section>
    </main>
  )
}

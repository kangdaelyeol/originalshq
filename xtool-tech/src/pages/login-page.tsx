import { ArrowRight, ChevronsRight, CircleCheck, Info, Lock, Mail, User } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import xtoolLogoUrl from '../../assets/symbols/xtool-logo-text.png'
import { AppBackground } from '../components/layout/app-background'
import { GithubMark, GoogleMark } from '../components/login/brand-marks'
import { LoginCard } from '../components/login/login-card'
import { LoginField } from '../components/login/login-field'
import { useParticleField } from '../components/login/particles/use-particle-field'
import { useLoginChoreography } from '../components/login/use-login-choreography'
import { usePointerTilt } from '../components/login/use-pointer-tilt'
import { LOGIN_FAILED_MESSAGE, verifyLogin } from '../data/auth'
import { cx } from '../lib/cx'
import { useSettings } from '../settings/settings'

type Mode = 'login' | 'request'
type Note = { tone: 'good' | 'info'; text: string }

// 로고가 뜨고 링이 퍼지는 걸 잠깐 보여준 뒤 다음 단계로.
const RING_HOLD_MS = 460
const LOGIN_HOLD_MS = 520
const YEAR = new Date().getFullYear()

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * 로그인 — 지금은 목업 인증(data/auth.ts: 비밀번호에 '!'가 있으면 실패).
 * 누르면 모서리 조각이 가운데로 모이는 동안 검증하고, 성공이면 로고가 뜬 뒤 대시보드로,
 * 실패면 조각이 빨갛게 떨리고 카드가 흔들린 뒤 폼으로 돌아와 오류를 보여 준다.
 * "접근 요청"으로 바꿀 때도 같은 연출로 폼이 갈아끼워진다(샘플 영상의 Sign in ↔ Sign up).
 */
export function LoginPage() {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const { accentInUse } = useSettings()
  const tilt = usePointerTilt()
  const choreo = useLoginChoreography()
  const [mode, setMode] = useState<Mode>('login')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [mismatch, setMismatch] = useState(false)

  // 입자 인트로 — xTool 워드마크(assets/symbols/xtool-logo-text.png)와 그 아래 부제가 카드 위
  // 자리(hero)로 옮겨 가기 시작하면 카드를 보여 준다.
  const [introDone, setIntroDone] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const heroRef = useRef<HTMLButtonElement>(null)
  const particles = useParticleField({
    canvasRef,
    slotRef: heroRef,
    logoUrl: xtoolLogoUrl,
    fallbackText: 'xTool',
    subtitle: 'TECH TEAM',
    accentColor: accentInUse,
    reducedMotion: Boolean(reduceMotion),
    onSettle: () => setIntroDone(true),
  })

  useEffect(() => {
    if (introDone) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') particles.skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [introDone, particles])

  /** 폼의 inert를 먼저(동기로) 풀어야 포커스가 들어간다 — inert 안의 칸은 focus()가 무시된다. */
  const unlockAndFocus = (field?: string) => {
    flushSync(() => setBusy(false))
    choreo.focusField(field)
  }

  /** verifying은 연출과 동시에 돌린다 — 조각이 모이는 동안 서버 응답을 기다리는 셈. */
  const runSignIn = async (verifying: Promise<boolean>) => {
    if (busy) return
    setNote(null)
    setLoginError(null)

    if (reduceMotion) {
      if (await verifying) {
        navigate('/', { replace: true })
      } else {
        flushSync(() => setLoginError(LOGIN_FAILED_MESSAGE))
        choreo.focusField('password')
      }
      return
    }

    setBusy(true)
    await choreo.gather()
    if (await verifying) {
      choreo.celebrate()
      await wait(LOGIN_HOLD_MS)
      await choreo.exit()
      navigate('/', { replace: true })
      return
    }

    await choreo.reject()
    // 오류 문구로 카드가 길어진 크기를 split이 바로 읽도록 동기로 그린다.
    flushSync(() => setLoginError(LOGIN_FAILED_MESSAGE))
    await choreo.split()
    unlockAndFocus('password')
  }

  const switchTo = async (next: Mode, nextNote: Note | null = null) => {
    if (busy) return
    setMismatch(false)
    setLoginError(null)
    if (reduceMotion) {
      setMode(next)
      setNote(nextNote)
      return
    }
    setBusy(true)
    setNote(null)
    await choreo.merge()
    await wait(RING_HOLD_MS)
    // 내용이 가려진 동안 폼을 바꾼다 — split이 새 폼 크기를 바로 읽도록 동기로 그린다.
    flushSync(() => {
      setMode(next)
      setNote(nextNote)
    })
    await choreo.split()
    unlockAndFocus()
  }

  const onLogin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    void runSignIn(
      verifyLogin({ email: String(data.get('email') ?? ''), password: String(data.get('password') ?? '') }),
    )
  }

  const onRequest = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    if (data.get('password') !== data.get('confirm')) {
      setMismatch(true)
      return
    }
    void switchTo('login', { tone: 'good', text: '접근 요청을 보냈어요. 승인되면 사내 메일로 알려드릴게요.' })
  }

  return (
    <div className={cx('login', !introDone && 'login--intro')}>
      <AppBackground />
      <div className="login__aura" aria-hidden />
      <div className="login__veil" aria-hidden />
      <canvas ref={canvasRef} className="login__particles" aria-hidden />

      <main className="login__stage">
        {/* 입자 'xTool'이 자리 잡는 곳 — 글자는 뒤 캔버스에 그려지고, 이 버튼은 위치와 클릭만 맡는다. */}
        <button
          ref={heroRef}
          type="button"
          className="login__hero"
          onClick={particles.replay}
          disabled={!introDone}
          title="눌러서 다시 모으기"
        >
          <span className="sr-only">xTool TECH TEAM — 눌러서 입자를 다시 모으기</span>
        </button>

        <LoginCard
          scope={choreo.scope}
          glassRef={choreo.glassRef}
          size={choreo.size}
          tilt={tilt}
          pieces={choreo.pieces}
          shakeX={choreo.shakeX}
          busy={busy}
          revealed={introDone}
        >
          {mode === 'login' ? (
            <>
              <h1 className="login-content__title">환영합니다</h1>

              {note && (
                <p className={cx('login-note', `login-note--${note.tone}`)} role="status">
                  {note.tone === 'good' ? <CircleCheck size={15} aria-hidden /> : <Info size={15} aria-hidden />}
                  {note.text}
                </p>
              )}

              <form className="login-form" onSubmit={onLogin}>
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
                  error={loginError}
                  onChange={() => setLoginError(null)}
                />
                <div className="login-row">
                  <label className="check">
                    <input type="checkbox" name="remember" defaultChecked />
                    로그인 상태 유지
                  </label>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setNote({ tone: 'info', text: '비밀번호 초기화는 테크 리드에게 요청해 주세요.' })}
                  >
                    비밀번호를 잊으셨나요?
                  </button>
                </div>
                <button type="submit" className="login-submit">
                  로그인
                  <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
                </button>
              </form>

              <p className="login-divider">또는 다음 계정으로 계속</p>
              <div className="login-social">
                <button type="button" className="social-button" onClick={() => void runSignIn(Promise.resolve(true))}>
                  <GoogleMark />
                  Google
                </button>
                <button type="button" className="social-button" onClick={() => void runSignIn(Promise.resolve(true))}>
                  <GithubMark />
                  GitHub
                </button>
              </div>

              <p className="login-switch">
                아직 계정이 없나요?
                <button type="button" className="text-link text-link--accent" onClick={() => void switchTo('request')}>
                  접근 요청
                </button>
              </p>
            </>
          ) : (
            <>
              <h1 className="login-content__title">
                보드 <em>접근 요청</em>
              </h1>

              <form className="login-form" onSubmit={onRequest}>
                <LoginField label="이름" icon={User} name="name" placeholder="홍길동" autoComplete="name" required />
                <LoginField
                  label="회사 이메일"
                  icon={Mail}
                  type="email"
                  name="email"
                  placeholder="name@xtool.co.kr"
                  autoComplete="email"
                  required
                />
                <div className="login-grid-2">
                  <LoginField
                    label="비밀번호"
                    icon={Lock}
                    type="password"
                    name="password"
                    placeholder="8자 이상"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <LoginField
                    label="비밀번호 확인"
                    icon={Lock}
                    type="password"
                    name="confirm"
                    placeholder="한 번 더"
                    autoComplete="new-password"
                    required
                  />
                </div>
                {mismatch && (
                  <p className="login-error" role="alert">
                    비밀번호가 서로 달라요
                  </p>
                )}
                <label className="check">
                  <input type="checkbox" name="agree" required />
                  이용 약관과 개인정보 처리방침에 동의해요
                </label>
                <button type="submit" className="login-submit">
                  접근 요청 보내기
                  <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
                </button>
              </form>

              <p className="login-switch">
                이미 계정이 있나요?
                <button type="button" className="text-link text-link--accent" onClick={() => void switchTo('login')}>
                  로그인
                </button>
              </p>
            </>
          )}
        </LoginCard>
      </main>

      {!introDone && (
        <button type="button" className="login__skip" onClick={particles.skip}>
          건너뛰기
          <ChevronsRight size={15} aria-hidden />
        </button>
      )}

      <footer className="login__footer">© {YEAR} xtool tech · 사내 전용 서비스</footer>
    </div>
  )
}

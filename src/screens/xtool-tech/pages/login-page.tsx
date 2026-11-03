import { ArrowRight, ChevronsRight, CircleCheck, Info, KeyRound, Lock, Mail } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { checkAccess } from '@/xtool-auth/access'
import {
  completePasswordSetup,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutXtool,
  type AuthOutcome,
} from '@/xtool-auth/auth-actions'
import { DENIED_MESSAGE } from '@/xtool-auth/access'
import { isXtoolFirebaseConfigured, xtoolFirebase } from '@/xtool-auth/firebase'
import { MIN_PASSWORD, normalizeEmail } from '@/xtool-auth/members'
import xtoolLogoUrl from '../assets/symbols/xtool-logo-text.png'
import { AppBackground } from '../components/layout/app-background'
import { GoogleMark } from '../components/login/brand-marks'
import { LoginCard } from '../components/login/login-card'
import { LoginField } from '../components/login/login-field'
import { useParticleField } from '../components/login/particles/use-particle-field'
import { useLoginChoreography } from '../components/login/use-login-choreography'
import { usePointerTilt } from '../components/login/use-pointer-tilt'
import { cx } from '@/ohq-ui/lib/cx'
import { XT_BASE } from '../paths'
import { useSettings } from '../settings/settings'

// setup — 관리자가 발급한 임시 비밀번호로 처음 들어온 사람이 자기 비밀번호를 정한다.
type Mode = 'login' | 'setup' | 'reset'
type Note = { tone: 'good' | 'info'; text: string }

/** 다른 화면(잠금·로그아웃)에서 넘겨주는 안내 — navigate(..., { state: { notice } }). */
export interface LoginLocationState {
  notice?: string
}

const SETUP_NOTE: Note = { tone: 'info', text: DENIED_MESSAGE['password-setup'] }

const UNCONFIGURED_NOTE: Note = {
  tone: 'info',
  text: '로그인 설정이 아직 안 됐어요. 관리자가 Firebase 웹 앱 설정을 넣으면 쓸 수 있어요.',
}

// 로고가 뜨고 링이 퍼지는 걸 잠깐 보여준 뒤 다음 단계로.
const RING_HOLD_MS = 460
const LOGIN_HOLD_MS = 520
const YEAR = new Date().getFullYear()

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * 로그인 — Firebase Auth(이메일·비밀번호, Google). 계정은 관리자(/admin/xtool)가 아이디(회사 이메일)와
 * 임시 비밀번호로 발급하고, 처음 로그인하면 바로 자기 비밀번호를 정한다(setup). 로그인은 이 브라우저에
 * 계속 남는다.
 * 누르면 모서리 조각이 가운데로 모이는 동안 검증하고, 성공이면 로고가 뜬 뒤 대시보드로,
 * 실패면 조각이 빨갛게 떨리고 카드가 흔들린 뒤 폼으로 돌아와 오류를 보여 준다.
 * 회원가입·비밀번호 재설정으로 바꿀 때도 같은 연출로 폼이 갈아끼워진다(샘플 영상의 Sign in ↔ Sign up).
 */
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const notice = (location.state as LoginLocationState | null)?.notice
  const reduceMotion = useReducedMotion()
  const { accentInUse } = useSettings()
  const tilt = usePointerTilt()
  const choreo = useLoginChoreography()
  const [mode, setMode] = useState<Mode>('login')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note | null>(() =>
    !isXtoolFirebaseConfigured ? UNCONFIGURED_NOTE : notice ? { tone: 'info', text: notice } : null,
  )
  const [loginError, setLoginError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  // 재설정 메일을 보내는 중(버튼 문구) — busy는 폼 전환 연출 중에도 켜져서 따로 둔다.
  const [sending, setSending] = useState(false)
  const [mismatch, setMismatch] = useState(false)
  // 로그인을 진행하는 중엔 "이미 로그인돼 있으면 바로 넘기기" 확인이 끼어들지 않게.
  const signingInRef = useRef(false)

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

  // 이미 로그인돼 있고 권한도 있으면 인트로 없이 대시보드로.
  useEffect(() => {
    if (!isXtoolFirebaseConfigured) return
    let cancelled = false
    const { auth } = xtoolFirebase()
    void auth.authStateReady().then(async () => {
      const user = auth.currentUser
      if (!user || cancelled || signingInRef.current) return
      const access = await checkAccess(user, 'tech').catch(() => null)
      if (cancelled || signingInRef.current || !access) return
      if (access.ok) navigate(XT_BASE, { replace: true })
      // 임시 비밀번호로 들어와 있다(보드에서 넘어왔거나 새로 고침) — 비밀번호 설정부터.
      else if (access.reason === 'password-setup') {
        setMode('setup')
        setNote(SETUP_NOTE)
      }
    })
    return () => {
      cancelled = true
    }
  }, [navigate])

  /** 폼의 inert를 먼저(동기로) 풀어야 포커스가 들어간다 — inert 안의 칸은 focus()가 무시된다. */
  const unlockAndFocus = (field?: string) => {
    flushSync(() => setBusy(false))
    choreo.focusField(field)
  }

  /**
   * verifying은 연출과 동시에 돌린다 — 조각이 모이는 동안 서버 응답을 기다리는 셈. 호출하는 쪽이
   * 클릭 처리 안에서 바로 만들어 넘긴다(Google 팝업이 막히지 않게).
   */
  const runSignIn = async (verifying: Promise<AuthOutcome>) => {
    signingInRef.current = true
    setNote(null)
    setLoginError(null)

    if (reduceMotion) {
      const outcome = await verifying
      if (outcome.ok) {
        navigate(XT_BASE, { replace: true })
        return
      }
      signingInRef.current = false
      if (!outcome.ok && (outcome.setup || outcome.setupDone)) {
        setMode(outcome.setup ? 'setup' : 'login')
        setNote(outcome.setup ? SETUP_NOTE : { tone: 'good', text: outcome.message })
        return
      }
      if (!outcome.cancelled) {
        flushSync(() => setLoginError(outcome.message))
        choreo.focusField('password')
      }
      return
    }

    setBusy(true)
    await choreo.gather()
    const outcome = await verifying
    if (outcome.ok) {
      choreo.celebrate()
      await wait(LOGIN_HOLD_MS)
      await choreo.exit()
      navigate(XT_BASE, { replace: true })
      return
    }

    signingInRef.current = false
    // 임시 비밀번호로 들어왔다 — 흔들지 않고 모인 조각이 갈라지며 비밀번호 설정 폼으로. 첫 비밀번호는
    // 정했는데 다시 로그인만 실패했으면 로그인 폼으로(새 비밀번호로 다시 로그인).
    if (outcome.setup || outcome.setupDone) {
      flushSync(() => {
        setMode(outcome.setup ? 'setup' : 'login')
        setNote(outcome.setup ? SETUP_NOTE : { tone: 'good', text: outcome.message })
      })
      await choreo.split()
      unlockAndFocus(outcome.setup ? 'password' : 'email')
      return
    }
    // Google 창을 닫은 거면 흔들지 않고 조용히 폼으로 돌아온다.
    if (outcome.cancelled) {
      await choreo.split()
      unlockAndFocus()
      return
    }
    await choreo.reject()
    // 오류 문구로 카드가 길어진 크기를 split이 바로 읽도록 동기로 그린다.
    flushSync(() => setLoginError(outcome.message))
    await choreo.split()
    unlockAndFocus('password')
  }

  /** 재설정 메일 보내기 — 성공하면 로그인 폼으로 돌아가 안내를, 실패하면 이 폼에 오류를. */
  const runRequest = async (request: Promise<AuthOutcome>, successNote: Note) => {
    setBusy(true)
    setSending(true)
    setFormError(null)
    const outcome = await request
    setSending(false)
    if (outcome.ok) {
      await switchTo('login', successNote)
      return
    }
    flushSync(() => setFormError(outcome.message))
    unlockAndFocus('email')
  }

  const switchTo = async (next: Mode, requestedNote: Note | null = null) => {
    setMismatch(false)
    setLoginError(null)
    setFormError(null)
    const nextNote = isXtoolFirebaseConfigured ? requestedNote : UNCONFIGURED_NOTE
    if (reduceMotion) {
      setBusy(false)
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
    if (busy || !isXtoolFirebaseConfigured) return
    const data = new FormData(e.currentTarget)
    void runSignIn(
      signInWithEmail(String(data.get('email') ?? ''), String(data.get('password') ?? ''), 'tech'),
    )
  }

  const onGoogle = () => {
    if (busy || !isXtoolFirebaseConfigured) return
    void runSignIn(signInWithGoogle('tech'))
  }

  const onSetup = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy || !isXtoolFirebaseConfigured) return
    const data = new FormData(e.currentTarget)
    if (data.get('password') !== data.get('confirm')) {
      setMismatch(true)
      return
    }
    void runSignIn(completePasswordSetup(String(data.get('password') ?? ''), 'tech'))
  }

  /** 비밀번호 설정을 그만두고 다른 계정으로 — 임시 비밀번호 로그인을 끊고 로그인 폼으로. */
  const leaveSetup = async () => {
    await signOutXtool()
    await switchTo('login')
  }

  const onReset = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy || !isXtoolFirebaseConfigured) return
    const email = normalizeEmail(String(new FormData(e.currentTarget).get('email') ?? ''))
    // 계정이 있는지는 알려 주지 않는다 — 있으면 메일이 가고, 없으면 아무 일도 없다.
    void runRequest(sendPasswordReset(email), {
      tone: 'good',
      text: `등록된 계정이면 비밀번호 재설정 메일이 갔어요(${email}). 메일의 링크로 새 비밀번호를 정해 주세요.`,
    })
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

              <form key="login" className="login-form" onSubmit={onLogin}>
                <LoginField
                  label="아이디(이메일)"
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
                <div className="login-row login-row--end">
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => void switchTo('reset')}
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
              <div className="login-social login-social--single">
                <button type="button" className="social-button" onClick={onGoogle}>
                  <GoogleMark />
                  Google 계정으로 로그인
                </button>
              </div>

              <p className="login-switch">처음이면 관리자에게 받은 임시 비밀번호로 로그인하세요.</p>
            </>
          ) : mode === 'setup' ? (
            <>
              <h1 className="login-content__title">
                비밀번호 <em>설정</em>
              </h1>
              {note && (
                <p className={cx('login-note', `login-note--${note.tone}`)} role="status">
                  <Info size={15} aria-hidden />
                  {note.text}
                </p>
              )}

              {/* key — 폼이 바뀌면 칸을 새로 그린다(안 그러면 방금 친 이메일이 새 비밀번호 칸에 남는다). */}
              <form key="setup" className="login-form" onSubmit={onSetup}>
                <LoginField
                  label="새 비밀번호"
                  icon={KeyRound}
                  type="password"
                  name="password"
                  placeholder={`${MIN_PASSWORD}자 이상`}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD}
                  required
                  error={loginError}
                  onChange={() => {
                    setMismatch(false)
                    setLoginError(null)
                  }}
                />
                <LoginField
                  label="새 비밀번호 확인"
                  icon={Lock}
                  type="password"
                  name="confirm"
                  placeholder="한 번 더"
                  autoComplete="new-password"
                  required
                  onChange={() => setMismatch(false)}
                />
                {mismatch && (
                  <p className="login-error" role="alert">
                    비밀번호가 서로 달라요
                  </p>
                )}
                <button type="submit" className="login-submit">
                  비밀번호 정하고 시작하기
                  <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
                </button>
              </form>

              <p className="login-switch">
                내 계정이 아닌가요?
                <button type="button" className="text-link text-link--accent" onClick={() => void leaveSetup()}>
                  다른 계정으로 로그인
                </button>
              </p>
            </>
          ) : (
            <>
              <h1 className="login-content__title">
                비밀번호 <em>재설정</em>
              </h1>
              <p className="login-note login-note--info">
                <Info size={15} aria-hidden />
                로그인 이메일을 넣으면 새 비밀번호를 정하는 링크를 보내 드려요. 메일이 안 오면 관리자에게 비밀번호 재발급을 요청하세요.
              </p>

              <form key="reset" className="login-form" onSubmit={onReset}>
                <LoginField
                  label="이메일"
                  icon={Mail}
                  type="email"
                  name="email"
                  placeholder="name@xtool.co.kr"
                  autoComplete="username"
                  required
                  error={formError}
                  onChange={() => setFormError(null)}
                />
                <button type="submit" className="login-submit">
                  {sending ? '보내는 중…' : '재설정 메일 보내기'}
                  <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
                </button>
              </form>

              <p className="login-switch">
                비밀번호가 생각났나요?
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

import {
  browserLocalPersistence,
  getAdditionalUserInfo,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  setPersistence,
  signInWithPopup,
  signOut,
  type UserCredential,
} from 'firebase/auth'
import { checkAccess, DENIED_MESSAGE, type AccessTarget } from './access'
import { googleProvider, xtoolFirebase } from './firebase'
import { normalizeEmail, recordSignIn, setOwnPassword } from './members'

export type AuthOutcome =
  | { ok: true }
  | {
      ok: false
      message: string
      /** 사용자가 Google 창을 닫은 경우 — 오류로 보여 주지 않는다. */
      cancelled?: boolean
      /** 임시 비밀번호로 들어왔다 — 로그인은 유지한 채 비밀번호 설정 화면으로. */
      setup?: boolean
      /** 첫 비밀번호는 정했는데 다시 로그인이 실패했다 — 로그인 폼으로. */
      setupDone?: boolean
    }

const errorCode = (e: unknown): string => (e as { code?: string }).code ?? ''

/** Firebase Auth 오류 → 화면 문구. 이메일 존재 여부를 흘리지 않게 아이디·비밀번호 오류는 한 문구로. */
export function authErrorMessage(e: unknown): string {
  switch (errorCode(e)) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return '이메일 또는 비밀번호가 올바르지 않아요. 다시 확인해 주세요.'
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않아요.'
    case 'auth/too-many-requests':
      return '시도가 너무 많아요. 잠시 후 다시 해 주세요.'
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 해요.'
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일이에요. 로그인해 주세요.'
    case 'auth/popup-blocked':
      return '로그인 창이 막혔어요. 브라우저에서 팝업을 허용해 주세요.'
    case 'auth/account-exists-with-different-credential':
      return '같은 이메일이 다른 방식으로 가입돼 있어요. 처음 가입한 방식으로 로그인해 주세요.'
    case 'auth/network-request-failed':
      return '네트워크에 연결할 수 없어요. 연결을 확인해 주세요.'
    default:
      return '로그인하지 못했어요. 잠시 후 다시 해 주세요.'
  }
}

/** 로그인은 됐는데 들어갈 권한이 없으면 바로 로그아웃시키고 이유를 돌려준다. */
async function admit(cred: UserCredential, target: AccessTarget): Promise<AuthOutcome> {
  const { user } = cred
  const access = await checkAccess(user, target)
  if (!access.ok && access.reason === 'password-setup') {
    await recordSignIn(user).catch(() => undefined)
    return { ok: false, message: DENIED_MESSAGE['password-setup'], setup: true }
  }
  if (!access.ok) {
    // 인증 안 된 비밀번호 계정에 인증 메일을 다시 보내지 않는다 — 가입이 없어진 지금 그런 계정은
    // 남이 등록된 이메일로 만든 것일 수 있고, 메일을 받은 직원이 링크를 누르면 그 계정이 인증된다.
    const message = DENIED_MESSAGE[access.reason]
    // 등록 안 된 Google 계정으로 처음 들어온 거면 인증 목록에 남기지 않는다.
    if (access.reason === 'not-registered' && getAdditionalUserInfo(cred)?.isNewUser) {
      await user.delete().catch(() => undefined)
    }
    await signOut(xtoolFirebase().auth)
    return { ok: false, message }
  }
  // 로그인 기록은 실패해도 들어가는 데엔 지장이 없다.
  await recordSignIn(user).catch(() => undefined)
  return { ok: true }
}

/**
 * 로그인은 이 브라우저에 계속 남긴다(local) — 로그아웃하거나, 관리자가 비밀번호를 다시 발급·
 * 계정을 정지하기 전까지는 다시 로그인할 일이 없다(Firebase 갱신 토큰은 기한이 없다).
 */
export async function signInWithEmail(email: string, password: string, target: AccessTarget): Promise<AuthOutcome> {
  try {
    const { auth } = xtoolFirebase()
    await setPersistence(auth, browserLocalPersistence)
    const cred = await signInWithEmailAndPassword(auth, normalizeEmail(email), password)
    return await admit(cred, target)
  } catch (e) {
    return { ok: false, message: authErrorMessage(e) }
  }
}

/**
 * 첫 비밀번호 정하기 — 임시 비밀번호로 로그인한 상태에서. 비밀번호가 바뀌면 지금 로그인이
 * 끊기므로(함수가 바꾼다) 새 비밀번호로 곧바로 다시 로그인한다.
 */
export async function completePasswordSetup(password: string, target: AccessTarget): Promise<AuthOutcome> {
  const { auth } = xtoolFirebase()
  const email = auth.currentUser?.email
  if (!email) return { ok: false, message: '로그인이 풀렸어요. 임시 비밀번호로 다시 로그인해 주세요.' }
  try {
    await setOwnPassword(password)
  } catch (e) {
    const message = e instanceof Error ? e.message.replace(/\s*\[\d+\]$/, '') : ''
    // 함수가 문구 없이 실패하면 코드(INTERNAL)만 온다.
    return {
      ok: false,
      message: message && !/^internal$/i.test(message) ? message : '비밀번호를 저장하지 못했어요. 잠시 후 다시 해 주세요.',
    }
  }
  const outcome = await signInWithEmail(email, password, target)
  // 비밀번호는 정해졌는데 다시 로그인만 실패했다(연결·시도 제한) — 설정 폼에 두면 "이미 정했어요"만
  // 반복되니 로그인 폼으로 돌려보낸다.
  if (!outcome.ok && !outcome.setup) {
    await signOut(auth).catch(() => undefined)
    return { ok: false, message: '새 비밀번호를 정했어요. 새 비밀번호로 다시 로그인해 주세요.', setupDone: true }
  }
  return outcome
}

/** 팝업이 막히지 않게 클릭 처리 안에서 곧바로(await 없이) 불러야 한다. */
export async function signInWithGoogle(target: AccessTarget): Promise<AuthOutcome> {
  try {
    // 팝업을 먼저 띄워야 해서 저장 방식은 따로 정하지 않는다 — 기본값이 local(계속 로그인)이다.
    const cred = await signInWithPopup(xtoolFirebase().auth, googleProvider)
    return await admit(cred, target)
  } catch (e) {
    const code = errorCode(e)
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { ok: false, message: '', cancelled: true }
    }
    return { ok: false, message: authErrorMessage(e) }
  }
}

export async function sendPasswordReset(email: string): Promise<AuthOutcome> {
  try {
    await sendPasswordResetEmail(xtoolFirebase().auth, normalizeEmail(email))
    return { ok: true }
  } catch (e) {
    return { ok: false, message: authErrorMessage(e) }
  }
}

export const signOutXtool = (): Promise<void> => signOut(xtoolFirebase().auth)

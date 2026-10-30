import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  setPersistence,
  signInWithPopup,
  signOut,
  type UserCredential,
} from 'firebase/auth'
import { checkAccess, DENIED_MESSAGE, type AccessTarget } from './access'
import { googleProvider, xtoolFirebase } from './firebase'
import { getMember, normalizeEmail, recordSignIn } from './members'

export type AuthOutcome =
  | { ok: true }
  | {
      ok: false
      message: string
      /** 사용자가 Google 창을 닫은 경우 — 오류로 보여 주지 않는다. */
      cancelled?: boolean
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
  if (!access.ok) {
    let message = DENIED_MESSAGE[access.reason]
    if (access.reason === 'unverified') {
      // 인증 메일을 못 찾는 경우가 많아 다시 보내 준다(너무 잦으면 Firebase가 막는다 — 그땐 그냥 둔다).
      const resent = await sendEmailVerification(user).then(
        () => true,
        () => false,
      )
      if (resent) message = '메일 인증이 아직 안 됐어요. 인증 메일을 다시 보냈으니 링크를 누른 뒤 다시 로그인해 주세요.'
    }
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

/** remember가 false면 브라우저(탭)를 닫을 때 로그아웃된다. */
export async function signInWithEmail(
  email: string,
  password: string,
  target: AccessTarget,
  remember = true,
): Promise<AuthOutcome> {
  try {
    const { auth } = xtoolFirebase()
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
    const cred = await signInWithEmailAndPassword(auth, normalizeEmail(email), password)
    return await admit(cred, target)
  } catch (e) {
    return { ok: false, message: authErrorMessage(e) }
  }
}

/** 팝업이 막히지 않게 클릭 처리 안에서 곧바로(await 없이) 불러야 한다. */
export async function signInWithGoogle(target: AccessTarget): Promise<AuthOutcome> {
  try {
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

/**
 * 가입 — 등록된 이메일만. 계정을 먼저 만든 뒤 등록 여부를 보고(가입 전엔 목록을 볼 권한이
 * 없다), 등록이 없거나 정지면 방금 만든 계정을 바로 지운다. 등록돼 있으면 인증 메일을 보내고
 * 로그아웃 — 인증 링크를 누른 뒤 로그인하면 들어간다.
 */
export async function registerWithEmail(email: string, password: string): Promise<AuthOutcome> {
  const { auth } = xtoolFirebase()
  try {
    const cred = await createUserWithEmailAndPassword(auth, normalizeEmail(email), password)
    const member = await getMember(cred.user.email ?? email).catch(() => null)
    if (!member || member.status !== 'active') {
      await cred.user.delete().catch(() => signOut(auth))
      return { ok: false, message: member ? DENIED_MESSAGE.disabled : DENIED_MESSAGE['not-registered'] }
    }
    await sendEmailVerification(cred.user)
    await signOut(auth)
    return { ok: true }
  } catch (e) {
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

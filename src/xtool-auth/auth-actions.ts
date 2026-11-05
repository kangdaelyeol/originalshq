import { browserLocalPersistence, setPersistence, signInWithPopup } from 'firebase/auth'
import type { AccessTarget } from '@xtool-core/access'
import { admit, authErrorMessage, signInWithEmail as signInWithEmailCore, type AuthOutcome } from '@xtool-core/auth'
import { googleProvider, xtoolFirebase } from './firebase'

// 로그인·로그아웃 — 공용(xtool-core auth)에 웹에서만 쓰는 것(브라우저 저장 방식·Google 팝업)을 얹는다.
export * from '@xtool-core/auth'

const errorCode = (e: unknown): string => (e as { code?: string }).code ?? ''

/**
 * 로그인은 이 브라우저에 계속 남긴다(local) — 로그아웃하거나, 관리자가 비밀번호를 다시 발급·
 * 계정을 정지하기 전까지는 다시 로그인할 일이 없다(Firebase 갱신 토큰은 기한이 없다).
 */
export async function signInWithEmail(email: string, password: string, target: AccessTarget): Promise<AuthOutcome> {
  try {
    await setPersistence(xtoolFirebase().auth, browserLocalPersistence)
  } catch (e) {
    return { ok: false, message: authErrorMessage(e) }
  }
  return signInWithEmailCore(email, password, target)
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

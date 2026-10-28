import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { googleProvider, parkeAuth } from '../firebase'
import { isAdmin } from '../client/admin-client'

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'notAdmin'; email: string }
  | { status: 'admin'; user: User; email: string }

/**
 * 관리자 화면 로그인 — Google 계정으로 로그인하고, 관리자 목록(admin/)에
 * 있는 계정만 들여보낸다. 실제 보호는 DB 보안 규칙이 한다(이 판단은 화면을
 * 보여줄지 정하는 용도).
 */
export const useAdminAuth = () => {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      onAuthStateChanged(parkeAuth, (user) => {
        if (!user || !user.email) {
          setState({ status: 'signedOut' })
          return
        }
        const email = user.email
        setState({ status: 'loading' })
        void isAdmin(email).then((ok) =>
          setState(
            ok
              ? { status: 'admin', user, email }
              : { status: 'notAdmin', email },
          ),
        )
      }),
    [],
  )

  const signIn = async () => {
    setError(null)
    try {
      await signInWithPopup(parkeAuth, googleProvider)
    } catch (e) {
      const code = (e as { code?: string }).code
      // 사용자가 창을 닫은 경우는 오류로 보여주지 않는다.
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      )
        return
      setError(e instanceof Error ? e.message : '로그인하지 못했습니다')
    }
  }

  return {
    state,
    error,
    signIn,
    signOut: () => signOut(parkeAuth),
  }
}

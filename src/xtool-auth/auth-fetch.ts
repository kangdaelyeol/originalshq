import { isXtoolFirebaseConfigured, xtoolFirebase } from './firebase'

/**
 * fetch에 로그인한 사람의 Firebase ID 토큰(Authorization: Bearer)을 붙인다 —
 * functions-cmip은 이 토큰으로 관리자인지 확인한다(auth.ts). 로그인 전이면
 * 그냥 보내고, 서버가 401을 돌려준다. 만료가 가까우면 SDK가 새 토큰을 받아 준다.
 */
export const authFetch = async (
  input: string,
  init?: RequestInit,
): Promise<Response> => {
  const token = isXtoolFirebaseConfigured
    ? await xtoolFirebase().auth.currentUser?.getIdToken()
    : undefined
  if (!token) return fetch(input, init)
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

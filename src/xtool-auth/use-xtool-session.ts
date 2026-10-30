import { onAuthStateChanged, type User } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { checkAccess, type AccessTarget, type DeniedReason } from './access'
import { isXtoolFirebaseConfigured, xtoolFirebase } from './firebase'
import type { XtoolMember } from './members'

export type XtoolSession =
  | { status: 'unconfigured' }
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'denied'; reason: DeniedReason; email: string }
  | { status: 'ready'; user: User; member: XtoolMember }

/** 지금 로그인한 사람과 target(팀 페이지·관리자) 권한 — 화면 잠금(가드)에 쓴다. */
export function useXtoolSession(target: AccessTarget): XtoolSession {
  const [session, setSession] = useState<XtoolSession>(() =>
    isXtoolFirebaseConfigured ? { status: 'loading' } : { status: 'unconfigured' },
  )

  useEffect(() => {
    if (!isXtoolFirebaseConfigured) return
    let current = 0
    return onAuthStateChanged(xtoolFirebase().auth, (user) => {
      // 로그인 상태가 빠르게 바뀌면 늦게 끝난 이전 확인 결과는 버린다.
      const ticket = ++current
      if (!user) {
        setSession({ status: 'signedOut' })
        return
      }
      setSession({ status: 'loading' })
      void checkAccess(user, target)
        .then((access) => {
          if (ticket !== current) return
          setSession(
            access.ok
              ? { status: 'ready', user, member: access.member }
              : { status: 'denied', reason: access.reason, email: user.email ?? '' },
          )
        })
        .catch(() => {
          if (ticket === current) setSession({ status: 'denied', reason: 'not-registered', email: user.email ?? '' })
        })
    })
  }, [target])

  return session
}

/**
 * 이름에서 아바타 두 글자 — 한글 이름 한 단어는 뒤 두 글자(김도윤 → 도윤), 여러 단어면 첫 단어
 * 앞 두 글자(대표 관리자 → 대표), 영문은 단어 첫 글자(Jane Doe → JD).
 */
export function initialsOf(name: string, email: string): string {
  const source = name.trim() || email.split('@')[0]
  const words = source.split(/[\s._-]+/).filter(Boolean)
  if (/[가-힣]/.test(source)) return words.length > 1 ? words[0].slice(0, 2) : source.slice(-2)
  return (words.length > 1 ? words[0][0] + words[1][0] : source.slice(0, 2)).toUpperCase()
}

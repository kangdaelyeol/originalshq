import { onIdTokenChanged, type User } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { checkAccess, type AccessTarget, type DeniedReason } from '@xtool-core/access'
import { isXtoolFirebaseConfigured, xtoolFirebase } from './firebase'
import type { XtoolMember } from '@xtool-core/members'

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
    let retry: ReturnType<typeof setTimeout> | undefined
    // 마지막으로 확인을 끝낸 사람 — 같은 사람이면 다시 확인하는 동안 화면을 비우지 않는다.
    let checkedUid: string | null = null
    const check = (user: User, ticket: number, attempt: number) => {
      void checkAccess(user, target)
        .then((access) => {
          if (ticket !== current) return
          checkedUid = user.uid
          setSession(
            access.ok
              ? { status: 'ready', user, member: access.member }
              : { status: 'denied', reason: access.reason, email: user.email ?? '' },
          )
        })
        .catch((error: { code?: string }) => {
          if (ticket !== current) return
          // 권한 오류는 다시 해도 같다 — 등록되지 않은 계정으로 본다.
          if (error?.code === 'permission-denied') {
            checkedUid = user.uid
            setSession({ status: 'denied', reason: 'not-registered', email: user.email ?? '' })
            return
          }
          // 그 밖(대개 잠깐 끊긴 연결)은 거절(→ 로그아웃)하지 않고 다시 확인해서 로그인이 풀리지
          // 않게 한다(1·2·4…초, 최대 30초 간격).
          retry = setTimeout(() => check(user, ticket, attempt + 1), Math.min(30_000, 1000 * 2 ** attempt))
        })
    }
    // 로그인·로그아웃뿐 아니라 토큰이 바뀔 때도(같은 사람이 다시 로그인 — 첫 비밀번호를 정한 뒤,
    // 한 시간마다 갱신) 다시 확인한다. onAuthStateChanged는 같은 사람이면 다시 부르지 않아서
    // 비밀번호를 정한 뒤에도 "비밀번호 설정" 상태에 머물렀다. 갱신 때 정지·권한 변경도 반영된다.
    const off = onIdTokenChanged(xtoolFirebase().auth, (user) => {
      // 로그인 상태가 빠르게 바뀌면 늦게 끝난 이전 확인 결과는 버린다.
      const ticket = ++current
      clearTimeout(retry)
      if (!user) {
        checkedUid = null
        setSession({ status: 'signedOut' })
        return
      }
      if (user.uid !== checkedUid) setSession({ status: 'loading' })
      check(user, ticket, 0)
    })
    return () => {
      current++
      clearTimeout(retry)
      off()
    }
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

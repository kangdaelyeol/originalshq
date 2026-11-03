// cmip API의 로그인 확인 — 화면이 보낸 Firebase ID 토큰(Authorization:
// Bearer)의 주인이 xtool 관리자(xtoolMembers: 활성·관리자)이고 메일 인증을
// 마쳤는지 본다. /log(functions-xtool admin-auth.ts)·/admin/xtool과 같은 기준
// 이다. 같은 Firebase 프로젝트·DB라 구성원 명단을 그대로 읽는다.
import { getAuth } from 'firebase-admin/auth'
import type { Request } from 'firebase-functions/v2/https'
import { db } from './data'

export type AdminCheck =
  { ok: true; email: string } | { ok: false; status: 401 | 403; error: string }

interface MemberLite {
  status?: string
  isAdmin?: boolean
}

// 구성원 명단은 1분 동안 기억한다 — 화면 하나가 API를 여러 번 부를 때마다
// 명단 문서를 다시 읽지 않게. 권한을 뺏어도 늦어야 1분 안에 막힌다.
const MEMBER_TTL_MS = 60_000
const memberCache = new Map<string, { member: MemberLite | null; at: number }>()

const readMember = async (email: string): Promise<MemberLite | null> => {
  const cached = memberCache.get(email)
  if (cached && Date.now() - cached.at < MEMBER_TTL_MS) return cached.member
  const doc = await db.collection('xtoolMembers').doc(email).get()
  const member = doc.exists ? (doc.data() as MemberLite) : null
  memberCache.set(email, { member, at: Date.now() })
  return member
}

export async function checkAdmin(request: Request): Promise<AdminCheck> {
  const bearer = request.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!bearer) return { ok: false, status: 401, error: '로그인이 필요해요' }
  const token = await getAuth()
    .verifyIdToken(bearer)
    .catch(() => null)
  if (!token?.email) {
    return {
      ok: false,
      status: 401,
      error: '로그인이 만료됐어요. 다시 로그인해 주세요',
    }
  }
  if (token.email_verified !== true) {
    return { ok: false, status: 403, error: '메일 인증이 필요해요' }
  }
  const email = token.email.trim().toLowerCase()
  const member = await readMember(email)
  if (member?.status !== 'active' || !member.isAdmin) {
    return { ok: false, status: 403, error: '관리자 계정만 쓸 수 있어요' }
  }
  return { ok: true, email }
}

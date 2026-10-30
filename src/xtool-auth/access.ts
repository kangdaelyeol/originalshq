import type { User } from 'firebase/auth'
import { getMember, type TeamKey, type XtoolMember } from './members'

/** 들어가려는 곳 — 팀 페이지 하나 또는 관리자 화면. */
export type AccessTarget = TeamKey | 'admin'

export type DeniedReason = 'not-registered' | 'disabled' | 'no-access' | 'unverified'

export type AccessResult = { ok: true; member: XtoolMember } | { ok: false; reason: DeniedReason }

export const DENIED_MESSAGE: Record<DeniedReason, string> = {
  'not-registered': '등록되지 않은 계정이에요. 관리자에게 등록을 요청해 주세요.',
  disabled: '사용이 정지된 계정이에요. 관리자에게 문의해 주세요.',
  'no-access': '이 페이지를 쓸 권한이 없는 계정이에요. 관리자에게 권한을 요청해 주세요.',
  unverified: '메일 인증이 아직 안 됐어요. 받은 메일의 인증 링크를 누른 뒤 다시 로그인해 주세요.',
}

/**
 * 로그인한 사람이 target에 들어갈 수 있는지 — 화면을 보여 줄지 정하는 판단이다. 실제 보호는
 * Firestore 규칙이 한다(등록·권한이 없으면 데이터를 못 읽는다).
 */
export async function checkAccess(user: User, target: AccessTarget): Promise<AccessResult> {
  if (!user.email) return { ok: false, reason: 'not-registered' }
  const member = await getMember(user.email)
  if (!member) return { ok: false, reason: 'not-registered' }
  if (member.status !== 'active') return { ok: false, reason: 'disabled' }
  const allowed = target === 'admin' ? member.isAdmin : member.teams[target] === true
  if (!allowed) return { ok: false, reason: 'no-access' }
  // 비밀번호 계정은 메일 인증 전엔 막는다 — 남이 등록된 이메일로 먼저 가입해 들어오는 걸 막는다.
  if (!user.emailVerified) return { ok: false, reason: 'unverified' }
  return { ok: true, member }
}

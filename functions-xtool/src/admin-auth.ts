// 화면 API의 로그인 확인 — 화면이 보낸 Firebase ID 토큰(Authorization: Bearer)의
// 주인이 등록된 구성원(xtoolMembers: 활성)이고 메일 인증·첫 비밀번호 설정을
// 마쳤는지 본다. 기술 보드 함수(endpoints/tech-boards.ts memberOf)·로그인 화면과
// 같은 기준이다.
//   checkMember  가입한 사람 누구나(관리자가 아니어도) — 리드 관리자
//   checkAdmin   관리자만 — /log, 보드 등록 같은 관리 작업
// 사용 기록(logUsage)·상담 신청(submitInquiry)처럼 로그인 없이 들어오는 요청에는
// 쓰지 않는다.
import { getAuth } from 'firebase-admin/auth'
import type { Request } from 'firebase-functions/https'
import { db } from './app'
import { getMember } from './tech-boards/firestore'

type Denied = { ok: false; status: 401 | 403; error: string }

export type MemberCheck = { ok: true; email: string; isAdmin: boolean } | Denied

export type AdminCheck = { ok: true; email: string } | Denied

/** 토큰을 확인하고 그 사람의 구성원 문서를 읽는다(없으면 member: null). */
async function verifiedMember(
  request: Request,
): Promise<
  { ok: true; member: Awaited<ReturnType<typeof getMember>> } | Denied
> {
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
  return { ok: true, member: await getMember(db, token.email) }
}

export async function checkMember(request: Request): Promise<MemberCheck> {
  const verified = await verifiedMember(request)
  if (!verified.ok) return verified
  const { member } = verified
  if (member?.status !== 'active') {
    return { ok: false, status: 403, error: '등록된 계정만 볼 수 있어요' }
  }
  // 임시 비밀번호로는 비밀번호 설정만 — 로그인 화면이 먼저 정하게 한다.
  if (member.mustChangePassword === true) {
    return { ok: false, status: 403, error: '먼저 비밀번호를 정해 주세요' }
  }
  return { ok: true, email: member.email, isAdmin: member.isAdmin === true }
}

export async function checkAdmin(request: Request): Promise<AdminCheck> {
  const verified = await verifiedMember(request)
  if (!verified.ok) return verified
  const { member } = verified
  if (member?.status !== 'active' || !member.isAdmin) {
    return { ok: false, status: 403, error: '관리자 계정만 볼 수 있어요' }
  }
  // 비밀번호를 다시 발급받은 관리자도 임시 비밀번호로는 관리 작업을 못 한다
  // (checkMember·Firestore 규칙·기술 보드 함수와 같은 기준).
  if (member.mustChangePassword === true) {
    return { ok: false, status: 403, error: '먼저 비밀번호를 정해 주세요' }
  }
  return { ok: true, email: member.email }
}

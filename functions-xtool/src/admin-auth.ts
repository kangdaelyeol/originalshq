// 관리 화면(/log) API의 로그인 확인 — 화면이 보낸 Firebase ID 토큰
// (Authorization: Bearer)의 주인이 등록된 관리자(xtoolMembers: 활성·관리자)이고
// 메일 인증을 마쳤는지 본다. 기술 보드 함수(endpoints/tech-boards.ts memberOf)·
// 로그인 화면과 같은 기준이다. 사용 기록(logUsage)·상담 신청(submitInquiry)처럼
// 로그인 없이 들어오는 요청에는 쓰지 않는다.
import { getAuth } from 'firebase-admin/auth'
import type { Request } from 'firebase-functions/https'
import { db } from './app'
import { getMember } from './tech-boards/firestore'

export type AdminCheck =
  | { ok: true; email: string }
  | { ok: false; status: 401 | 403; error: string }

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
  const member = await getMember(db, token.email)
  if (member?.status !== 'active' || !member.isAdmin) {
    return { ok: false, status: 403, error: '관리자 계정만 볼 수 있어요' }
  }
  return { ok: true, email: member.email }
}

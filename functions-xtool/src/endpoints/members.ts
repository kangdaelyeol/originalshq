import { getAuth } from 'firebase-admin/auth'
import { FieldValue } from 'firebase-admin/firestore'
import {
  CallableRequest,
  HttpsError,
  onCall,
} from 'firebase-functions/https'
import { traced } from '../cost-trace'
import { db } from '../app'

// xtool 팀 페이지 계정 — 관리자(/admin/xtool)가 아이디(회사 이메일)와 임시
// 비밀번호를 발급하면, 직원은 그걸로 처음 로그인해 바로 자기 비밀번호를 정한다.
// 비밀번호 계정은 Firebase Auth에만 있고, 구성원 문서(xtoolMembers/{이메일})에는
// "첫 비밀번호를 아직 안 정함"(mustChangePassword)만 남긴다. 이 표시가 있는
// 동안은 Firestore 규칙·보드 함수가 데이터를 내주지 않는다(임시 비밀번호로는
// 비밀번호 설정만 할 수 있다).
//
// 발급한 계정은 메일 인증을 거치지 않는다(emailVerified: true) — 관리자가 직접
// 만든 계정이라 남이 먼저 가입해 들어올 걱정이 없다.

const MEMBERS = 'xtoolMembers'
const MIN_PASSWORD = 8
const MAX_PASSWORD = 128
const TEAM_KEYS = ['tech', 'sales', 'callback']

const normalizeEmail = (email: string) => email.trim().toLowerCase()

/** 비밀번호 규칙 — 화면(로그인·관리자)과 같게 8자 이상. */
function checkPassword(password: unknown): string {
  if (typeof password !== 'string') {
    throw new HttpsError('invalid-argument', '비밀번호를 넣어 주세요')
  }
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    throw new HttpsError(
      'invalid-argument',
      `비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요`,
    )
  }
  return password
}

/** 부른 사람이 활성 관리자인지(첫 비밀번호를 정한 뒤) — 아니면 거절. */
async function requireAdmin(
  request: CallableRequest<unknown>,
): Promise<string> {
  const token = request.auth?.token
  if (!request.auth?.uid || !token?.email) {
    throw new HttpsError('unauthenticated', '로그인이 필요해요')
  }
  if (token.email_verified !== true) {
    throw new HttpsError('permission-denied', '메일 인증이 필요해요')
  }
  const email = normalizeEmail(token.email)
  const snap = await db.collection(MEMBERS).doc(email).get()
  const member = snap.data()
  if (
    member?.status !== 'active' ||
    member.isAdmin !== true ||
    member.mustChangePassword === true
  ) {
    throw new HttpsError('permission-denied', '관리자 계정만 할 수 있어요')
  }
  return email
}

/** 그 이메일의 Auth 계정에 비밀번호를 넣는다 — 없으면 만들고, 있으면(예: 전에
 * Google로 로그인) 비밀번호를 바꾸고 기존 로그인을 모두 끊는다. */
async function setAuthPassword(
  email: string,
  password: string,
  name: string,
): Promise<string> {
  const auth = getAuth()
  const existing = await auth.getUserByEmail(email).catch((error) => {
    if (error?.code === 'auth/user-not-found') return null
    throw error
  })
  if (!existing) {
    const user = await auth.createUser({
      email,
      password,
      displayName: name || undefined,
      emailVerified: true,
    })
    return user.uid
  }
  await auth.updateUser(existing.uid, {
    password,
    emailVerified: true,
    disabled: false,
  })
  // 임시 비밀번호를 새로 줬으면 쓰던 기기에서도 다시 로그인해야 한다.
  await auth.revokeRefreshTokens(existing.uid)
  return existing.uid
}

interface IssueInput {
  email: string
  name: string
  isAdmin: boolean
  teams: Record<string, boolean>
  password: string
}

// ────────────────────────────────
// xtoolIssueAccount — 구성원 등록 + 아이디·임시 비밀번호 발급. 관리자만.
// ────────────────────────────────
export const xtoolIssueAccount = onCall(
  { timeoutSeconds: 30 },
  traced(
    'xtoolIssueAccount',
    'callable',
    async (request: CallableRequest<IssueInput>) => {
      const adminEmail = await requireAdmin(request)
      const data = request.data ?? ({} as IssueInput)
      const email = normalizeEmail(String(data.email ?? ''))
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpsError('invalid-argument', '이메일 형식이 올바르지 않아요')
      }
      const name = String(data.name ?? '').trim()
      if (!name || name.length > 60) {
        throw new HttpsError('invalid-argument', '이름을 60자 안으로 넣어 주세요')
      }
      const password = checkPassword(data.password)
      const teams = Object.fromEntries(
        TEAM_KEYS.map((key) => [key, data.teams?.[key] === true]),
      )

      const ref = db.collection(MEMBERS).doc(email)
      if ((await ref.get()).exists) {
        throw new HttpsError(
          'already-exists',
          '이미 등록된 이메일이에요. 목록에서 비밀번호를 다시 발급해 주세요',
        )
      }
      await setAuthPassword(email, password, name)
      await ref.set({
        email,
        name,
        isAdmin: data.isAdmin === true,
        teams,
        status: 'active',
        mustChangePassword: true,
        passwordIssuedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        createdBy: adminEmail,
        updatedAt: FieldValue.serverTimestamp(),
      })
      return { email }
    },
  ),
)

// ────────────────────────────────
// xtoolResetPassword — 등록된 구성원에게 임시 비밀번호를 다시 발급(잊었을 때·
// Google만 쓰던 사람에게 비밀번호 로그인 열어 주기). 쓰던 로그인은 끊긴다. 관리자만.
// ────────────────────────────────
export const xtoolResetPassword = onCall(
  { timeoutSeconds: 30 },
  traced(
    'xtoolResetPassword',
    'callable',
    async (request: CallableRequest<{ email: string; password: string }>) => {
      const adminEmail = await requireAdmin(request)
      const email = normalizeEmail(String(request.data?.email ?? ''))
      const password = checkPassword(request.data?.password)
      if (email === adminEmail) {
        throw new HttpsError(
          'failed-precondition',
          '자기 비밀번호는 로그인 화면의 "비밀번호를 잊으셨나요?"로 바꿔 주세요',
        )
      }
      const ref = db.collection(MEMBERS).doc(email)
      const member = (await ref.get()).data()
      if (!member) throw new HttpsError('not-found', '등록되지 않은 구성원이에요')
      await setAuthPassword(email, password, String(member.name ?? ''))
      await ref.update({
        mustChangePassword: true,
        passwordIssuedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      return { email }
    },
  ),
)

// ────────────────────────────────
// xtoolSetPassword — 임시 비밀번호로 처음 로그인한 본인이 자기 비밀번호를 정한다.
// 비밀번호를 바꾸면 지금 로그인도 끊겨서, 화면이 새 비밀번호로 곧바로 다시 로그인한다.
// ────────────────────────────────
export const xtoolSetPassword = onCall(
  { timeoutSeconds: 30 },
  traced(
    'xtoolSetPassword',
    'callable',
    async (request: CallableRequest<{ password: string }>) => {
      const uid = request.auth?.uid
      const tokenEmail = request.auth?.token.email
      if (!uid || !tokenEmail) {
        throw new HttpsError('unauthenticated', '로그인이 필요해요')
      }
      const password = checkPassword(request.data?.password)
      const ref = db.collection(MEMBERS).doc(normalizeEmail(tokenEmail))
      const member = (await ref.get()).data()
      if (!member || member.status !== 'active') {
        throw new HttpsError('permission-denied', '사용할 수 없는 계정이에요')
      }
      if (member.mustChangePassword !== true) {
        throw new HttpsError(
          'failed-precondition',
          '이미 비밀번호를 정했어요. 로그인해 주세요',
        )
      }
      await getAuth().updateUser(uid, { password })
      await ref.update({
        mustChangePassword: FieldValue.delete(),
        passwordChangedAt: FieldValue.serverTimestamp(),
      })
      return { ok: true }
    },
  ),
)

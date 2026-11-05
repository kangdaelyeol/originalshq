import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { xtoolFirebase } from './firebase'

// ────────────────────────────────────────────────────────────────────────
// 등록된 구성원(xtoolMembers/{소문자 이메일}) — 관리자(/admin/xtool)가 등록·발급한 사람만 팀 페이지에
// 로그인할 수 있다. 팀이 늘면 TEAMS에 한 줄 더하면 된다(규칙은 팀 이름을 몰라도 된다).
// ────────────────────────────────────────────────────────────────────────

export type TeamKey = 'tech' | 'sales' | 'callback'

export const TEAMS: readonly { key: TeamKey; label: string; ready: boolean }[] = [
  { key: 'tech', label: '기술팀', ready: true },
  { key: 'sales', label: '영업팀', ready: false },
  { key: 'callback', label: '콜백팀', ready: false },
]

export type MemberStatus = 'active' | 'disabled'

/** 기술팀 담당영역 — 관리자가 정한다(기술팀 팀원 화면에 보인다). 키 visit은 저장된 값·규칙과 맞추려고 그대로 두고
 *  이름만 "설치"로 바꿨다(처음엔 "방문체험"). */
export type TechArea = 'visit' | 'as'

export const TECH_AREAS: readonly { key: TechArea; label: string }[] = [
  { key: 'visit', label: '설치' },
  { key: 'as', label: 'AS' },
]

/** 직책 — 관리자가 정한다(tech 팀원 & 권한에 보인다). 낮은 것부터. 키를 바꾸면 firestore.rules도 같이. */
export type Position = 'staff' | 'associate' | 'assistant' | 'manager' | 'deputy' | 'general' | 'ceo'

export const POSITIONS: readonly { key: Position; label: string }[] = [
  { key: 'staff', label: '사원' },
  { key: 'associate', label: '주임' },
  { key: 'assistant', label: '대리' },
  { key: 'manager', label: '과장' },
  { key: 'deputy', label: '차장' },
  { key: 'general', label: '부장' },
  { key: 'ceo', label: '대표' },
]

/** 그룹 안의 역할 — 그룹장·팀원 */
export type GroupRole = 'lead' | 'member'

export const GROUP_ROLES: readonly { key: GroupRole; label: string }[] = [
  { key: 'lead', label: '그룹장' },
  { key: 'member', label: '팀원' },
]

export interface XtoolMember {
  email: string
  name: string
  isAdmin: boolean
  /** 팀 페이지별 접근 권한 */
  teams: Partial<Record<TeamKey, boolean>>
  status: MemberStatus
  /** 기술팀 담당영역 — 정하지 않았으면 없음 */
  techArea?: TechArea | null
  /** 직책 — 정하지 않았으면 없음 */
  position?: Position | null
  /** 그룹장·팀원 — 정하지 않았으면 없음 */
  groupRole?: GroupRole | null
  createdAt?: Timestamp | null
  createdBy?: string
  updatedAt?: Timestamp | null
  /** 처음 로그인하면 본인이 남긴다 — 관리자 화면에서 "가입 전/로그인함"을 가른다. */
  uid?: string
  lastSignInAt?: Timestamp | null
  /** 관리자가 발급한 임시 비밀번호를 아직 안 바꿨으면 true — 그동안은 비밀번호 설정만 할 수 있다. */
  mustChangePassword?: boolean
  passwordIssuedAt?: Timestamp | null
}

const COLLECTION = 'xtoolMembers'

export const normalizeEmail = (email: string): string => email.trim().toLowerCase()

const memberRef = (email: string) => doc(xtoolFirebase().db, COLLECTION, normalizeEmail(email))

export async function getMember(email: string): Promise<XtoolMember | null> {
  const snap = await getDoc(memberRef(email))
  return snap.exists() ? (snap.data() as XtoolMember) : null
}

/** 관리자 화면용 — 구성원 목록을 실시간으로 받는다. 해제 함수를 돌려준다. */
export function watchMembers(onChange: (members: XtoolMember[]) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(
    collection(xtoolFirebase().db, COLLECTION),
    (snap) => {
      const members = snap.docs.map((d) => d.data() as XtoolMember)
      members.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
      onChange(members)
    },
    onError,
  )
}

export interface MemberInput {
  email: string
  name: string
  isAdmin: boolean
  teams: Partial<Record<TeamKey, boolean>>
  status: MemberStatus
}

/** 새 구성원 등록 — 이미 있으면 덮어쓰지 않고 false. */
export async function addMember(input: MemberInput, adminEmail: string): Promise<boolean> {
  const ref = memberRef(input.email)
  if ((await getDoc(ref)).exists()) return false
  await setDoc(ref, {
    ...input,
    email: normalizeEmail(input.email),
    name: input.name.trim(),
    createdAt: serverTimestamp(),
    createdBy: normalizeEmail(adminEmail),
    updatedAt: serverTimestamp(),
  })
  return true
}

/** 권한·상태·담당영역·직책 바꾸기(관리자) — 넘긴 값만 바뀐다. */
export async function updateMember(
  email: string,
  patch: Partial<Pick<XtoolMember, 'name' | 'isAdmin' | 'teams' | 'status' | 'techArea' | 'position' | 'groupRole'>>,
): Promise<void> {
  await updateDoc(memberRef(email), { ...patch, updatedAt: serverTimestamp() })
}

export async function removeMember(email: string): Promise<void> {
  await deleteDoc(memberRef(email))
}

/** 로그인에 성공하면 본인 문서에 uid·마지막 로그인 시각을 남긴다(규칙이 이 두 칸만 허락). */
export async function recordSignIn(user: User): Promise<void> {
  if (!user.email) return
  await updateDoc(memberRef(user.email), { uid: user.uid, lastSignInAt: serverTimestamp() })
}

// ── 아이디·비밀번호 발급(functions-xtool endpoints/members.ts) ─────────────────
// 비밀번호 계정은 관리자만 만든다 — Auth 계정 생성·비밀번호 지정은 함수(관리자 SDK)가 한다.

/** 비밀번호 최소 길이 — 함수와 같게 */
export const MIN_PASSWORD = 8

// 헷갈리는 글자(0·O·1·l·I)는 뺀다 — 직원에게 말로·메신저로 옮겨 적기 쉽게.
const PASSWORD_CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** 임시 비밀번호 — 10자, 글자·숫자 섞어서 */
export function generateTempPassword(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint32Array(length))
  let out = ''
  for (const b of bytes) out += PASSWORD_CHARS[b % PASSWORD_CHARS.length]
  // 숫자가 하나도 없으면 마지막 자리를 숫자로
  return /\d/.test(out) ? out : out.slice(0, -1) + String(2 + (bytes[0] % 8))
}

/** 구성원 등록 + 아이디(이메일)·임시 비밀번호 발급 */
export async function issueAccount(input: Omit<MemberInput, 'status'> & { password: string }): Promise<void> {
  await httpsCallable(xtoolFirebase().functions, 'xtoolIssueAccount')({
    ...input,
    email: normalizeEmail(input.email),
    name: input.name.trim(),
  })
}

/** 임시 비밀번호 다시 발급 — 그 사람이 쓰던 로그인은 끊긴다. */
export async function resetMemberPassword(email: string, password: string): Promise<void> {
  await httpsCallable(xtoolFirebase().functions, 'xtoolResetPassword')({ email: normalizeEmail(email), password })
}

/** 첫 로그인 — 임시 비밀번호로 들어온 본인이 자기 비밀번호를 정한다. */
export async function setOwnPassword(password: string): Promise<void> {
  await httpsCallable(xtoolFirebase().functions, 'xtoolSetPassword')({ password })
}

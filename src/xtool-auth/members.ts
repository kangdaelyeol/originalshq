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
import { xtoolFirebase } from './firebase'

// ────────────────────────────────────────────────────────────────────────
// 등록된 구성원(xtoolMembers/{소문자 이메일}) — 관리자(/admin/xtool)가 등록한 사람만 팀 페이지에
// 로그인·가입할 수 있다. 팀이 늘면 TEAMS에 한 줄 더하면 된다(규칙은 팀 이름을 몰라도 된다).
// ────────────────────────────────────────────────────────────────────────

export type TeamKey = 'tech' | 'sales' | 'callback'

export const TEAMS: readonly { key: TeamKey; label: string; ready: boolean }[] = [
  { key: 'tech', label: '기술팀', ready: true },
  { key: 'sales', label: '영업팀', ready: false },
  { key: 'callback', label: '콜백팀', ready: false },
]

export type MemberStatus = 'active' | 'disabled'

export interface XtoolMember {
  email: string
  name: string
  isAdmin: boolean
  /** 팀 페이지별 접근 권한 */
  teams: Partial<Record<TeamKey, boolean>>
  status: MemberStatus
  createdAt?: Timestamp | null
  createdBy?: string
  updatedAt?: Timestamp | null
  /** 처음 로그인하면 본인이 남긴다 — 관리자 화면에서 "가입 전/로그인함"을 가른다. */
  uid?: string
  lastSignInAt?: Timestamp | null
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

/** 권한·상태 바꾸기(관리자) — 넘긴 값만 바뀐다. */
export async function updateMember(
  email: string,
  patch: Partial<Pick<XtoolMember, 'name' | 'isAdmin' | 'teams' | 'status'>>,
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

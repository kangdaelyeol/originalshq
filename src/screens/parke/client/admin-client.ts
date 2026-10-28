import {
  get,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
} from 'firebase/database'
import { adminKeyOf, parkeDb } from '../firebase'

// admin/{이메일의 "."를 ","로 바꾼 키}: { email, addedAt, addedBy }
// 보안 규칙이 이 목록에 있는 Google 계정만 관리자 기능(시리얼·삭제 기록·관리자
// 목록)을 허용한다.

export interface AdminEntry {
  key: string
  email: string
  addedAt: number | null
  addedBy: string | null
}

/** 이 계정이 관리자인지 — 관리자가 아니면 규칙상 읽기가 거부되므로 false. */
export const isAdmin = async (email: string) => {
  try {
    const snapshot = await get(ref(parkeDb, `admin/${adminKeyOf(email)}`))
    return snapshot.exists()
  } catch {
    return false
  }
}

export const subscribeAdmins = (
  onChange: (admins: AdminEntry[]) => void,
  onError: (error: Error) => void,
) =>
  onValue(
    ref(parkeDb, 'admin'),
    (snapshot) => {
      const admins: AdminEntry[] = []
      snapshot.forEach((child) => {
        const value = child.val() as Partial<AdminEntry>
        admins.push({
          key: child.key as string,
          email: value.email ?? (child.key as string).replace(/,/g, '.'),
          addedAt: typeof value.addedAt === 'number' ? value.addedAt : null,
          addedBy: value.addedBy ?? null,
        })
      })
      onChange(admins.sort((a, b) => a.email.localeCompare(b.email)))
    },
    onError,
  )

export const addAdmin = (email: string, addedBy: string) => {
  const normalized = email.trim().toLowerCase()
  return set(ref(parkeDb, `admin/${adminKeyOf(normalized)}`), {
    email: normalized,
    addedAt: serverTimestamp(),
    addedBy,
  })
}

export const removeAdmin = (email: string) =>
  remove(ref(parkeDb, `admin/${adminKeyOf(email)}`))

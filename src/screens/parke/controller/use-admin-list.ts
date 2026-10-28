import { useEffect, useState } from 'react'
import {
  addAdmin,
  removeAdmin,
  subscribeAdmins,
  type AdminEntry,
} from '../client/admin-client'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 관리자 목록 — 추가·제거. 자기 자신은 지울 수 없다(잠김 방지, 보안 규칙도
 * 같은 이유로 막는다). */
export const useAdminList = (myEmail: string) => {
  const [admins, setAdmins] = useState<AdminEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(
    () =>
      subscribeAdmins(
        (next) => {
          setAdmins(next)
          setStatus('ready')
        },
        () => setStatus('error'),
      ),
    [],
  )

  const add = async () => {
    const email = draft.trim().toLowerCase()
    if (!EMAIL.test(email)) {
      setMessage('이메일 형식이 아닙니다')
      return
    }
    if (admins.some((each) => each.email === email)) {
      setMessage('이미 관리자입니다')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      await addAdmin(email, myEmail)
      setDraft('')
      setMessage(`${email}을(를) 추가했습니다`)
    } catch (error) {
      setMessage(
        `추가하지 못했습니다: ${error instanceof Error ? error.message : error}`,
      )
    } finally {
      setBusy(false)
    }
  }

  const remove = async (email: string) => {
    if (email === myEmail.toLowerCase()) return
    setBusy(true)
    setMessage(null)
    try {
      await removeAdmin(email)
      setMessage(`${email}을(를) 제거했습니다`)
    } catch (error) {
      setMessage(
        `제거하지 못했습니다: ${error instanceof Error ? error.message : error}`,
      )
    } finally {
      setBusy(false)
    }
  }

  return { admins, status, draft, setDraft, busy, message, add, remove }
}

import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { xtoolFirebase } from './firebase'
import { normalizeEmail } from './members'

// 수정 기록(techEditLogs) — tech 화면에서 누가 무엇을 바꿨는지. 함수가 쓰고 기술팀 모두 읽는다(firestore.rules).
// 팀원 화면의 "로그"가 한 사람 것만 걸러 보여 준다 — 최근 기록에서 거른다(사람별 색인을 따로 두지 않으려고).

/** 최근 몇 건에서 거를지 */
const RECENT = 500

export interface TechEditLog {
  id: string
  at: number
  action: 'update' | 'create' | 'delete'
  boardKey: string
  boardName: string
  itemId: string | null
  itemName: string
  by: { email: string; name: string }
  changes: { field: string; title: string; before: string | null; after: string | null }[]
  ok: boolean
  error?: string
}

/** 한 사람의 수정 기록(최근 것부터) — email이 null이면 읽지 않는다. 못 읽으면(규칙 배포 전 등) error. */
export function useMemberEditLogs(email: string | null): { logs: TechEditLog[] | null; error: string | null } {
  const [state, setState] = useState<{ email: string | null; logs: TechEditLog[] | null; error: string | null }>({
    email: null,
    logs: null,
    error: null,
  })
  useEffect(() => {
    if (!email) return
    const who = normalizeEmail(email)
    return onSnapshot(
      query(collection(xtoolFirebase().db, 'techEditLogs'), orderBy('at', 'desc'), limit(RECENT)),
      (snap) =>
        setState({
          email,
          error: null,
          logs: snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<TechEditLog, 'id'>) }))
            .filter((log) => normalizeEmail(log.by?.email ?? '') === who),
        }),
      (e) => setState({ email, logs: null, error: e.message }),
    )
  }, [email])
  // 다른 사람으로 바뀐 직후에는 이전 사람 기록을 보여 주지 않는다
  return state.email === email ? { logs: state.logs, error: state.error } : { logs: null, error: null }
}

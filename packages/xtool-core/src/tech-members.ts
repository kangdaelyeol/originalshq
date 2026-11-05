import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useSyncExternalStore } from 'react'
import { xtoolFirebase } from './firebase'
import type { XtoolMember } from './members'

// 기술팀 명단 — /admin/xtool에서 기술팀(teams.tech)으로 등록한 활성 구성원. 내 업무의 직원 목록이
// 이 명단을 따른다. 규칙이 기술팀원에게 "기술팀으로 등록된 사람" 문서만 읽게 해서 같은 조건으로 묻는다.
// null이면 아직 모르거나(불러오는 중) 못 읽은 것(규칙 배포 전 등) — 쓰는 쪽이 예전 방식으로 대신한다.

let members: XtoolMember[] | null = null
let unsubscribe: (() => void) | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function ensureMembers() {
  if (unsubscribe) return
  unsubscribe = onSnapshot(
    query(collection(xtoolFirebase().db, 'xtoolMembers'), where('teams.tech', '==', true)),
    (snap) => {
      members = snap.docs.map((d) => d.data() as XtoolMember).filter((m) => m.status === 'active')
      emit()
    },
    () => {
      unsubscribe?.()
      unsubscribe = null
      members = null
      emit()
    },
  )
}

/** 기술팀으로 등록된 활성 구성원 — 실시간 */
export function useTechMembers(): XtoolMember[] | null {
  useEffect(() => ensureMembers(), [])
  return useSyncExternalStore(subscribe, () => members)
}

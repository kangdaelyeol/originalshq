import { doc, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { xtoolFirebase } from '@/xtool-auth/firebase'
import type { TechBoardKey } from './tech-boards'

// item 업데이트(Monday 댓글) — Monday 표 말풍선 패널이 읽고 쓴다. 서버: functions-xtool
// tech-boards/updates.ts. 읽은 목록은 서버가 techItemUpdates/{itemId}에 캐시해 둬서 패널은
// 그걸 바로 보여 주고(실시간), 열 때마다 Monday에서 다시 읽어 맞춘다. 우리 화면에서 쓴 글은 API
// 키 주인 계정으로 올라가서 본문 끝에 서명("— 이름 · xtool tech")이 붙는다 — 읽을 때 떼어
// 작성자로 보여 준다.

export interface TechUpdate {
  id: string
  text: string
  createdAt: string | null
  creator: { name: string; photo: string | null } | null
  replies: TechUpdate[]
}

const SIGNATURE = /\s*— (.+?) · xtool tech\s*$/

/** 본문과 작성자 — 우리 화면에서 쓴 글이면 서명의 이름, 아니면 Monday 작성자 */
export function authorOf(update: TechUpdate): { text: string; author: string; viaApp: boolean } {
  const match = SIGNATURE.exec(update.text)
  if (match) return { text: update.text.slice(0, match.index).trim(), author: match[1], viaApp: true }
  return { text: update.text.trim(), author: update.creator?.name ?? '알 수 없음', viaApp: false }
}

/**
 * 캐시된 업데이트 — 처음 응답이 곧바로 오고, 글이 올라오거나 Monday에서 바뀌면(webhook) 따라온다.
 * 캐시가 없으면 null. 못 읽으면(규칙 배포 전 등) onError — 패널은 함수로 읽은 것만 쓴다.
 */
export function watchCachedUpdates(
  itemId: string,
  onData: (updates: TechUpdate[] | null) => void,
  onError: () => void,
): () => void {
  return onSnapshot(
    doc(xtoolFirebase().db, 'techItemUpdates', itemId),
    (snap) => onData(snap.exists() ? ((snap.data().updates ?? []) as TechUpdate[]) : null),
    onError,
  )
}

// 같은 항목을 읽는 중이면 그 요청을 같이 쓴다(패널을 금방 다시 열거나 개발 모드가 두 번 부를 때
// Monday를 두 번 부르지 않게).
const reading = new Map<string, Promise<TechUpdate[]>>()

/** Monday에서 다시 읽기(서버가 캐시와 말풍선 개수도 새로 쓴다) */
export function fetchUpdates(boardKey: TechBoardKey, itemId: string): Promise<TechUpdate[]> {
  const key = `${boardKey}:${itemId}`
  const pending = reading.get(key)
  if (pending) return pending
  const request = httpsCallable<{ boardKey: string; itemId: string }, { updates: TechUpdate[] }>(
    xtoolFirebase().functions,
    'techItemUpdates',
  )({ boardKey, itemId })
    .then(({ data }) => data.updates)
    .finally(() => reading.delete(key))
  reading.set(key, request)
  return request
}

/** 업데이트(parentId면 그 답글) 쓰기 — 새 업데이트 id */
export async function postUpdate(boardKey: TechBoardKey, itemId: string, text: string, parentId?: string): Promise<string> {
  const { data } = await httpsCallable<
    { boardKey: string; itemId: string; text: string; parentId: string | null },
    { id: string }
  >(xtoolFirebase().functions, 'techCreateUpdate')({ boardKey, itemId, text, parentId: parentId ?? null })
  return data.id
}

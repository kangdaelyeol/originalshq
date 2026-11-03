import { httpsCallable } from 'firebase/functions'
import { xtoolFirebase } from '@/xtool-auth/firebase'
import type { TechBoardKey } from './tech-boards'

// item 업데이트(Monday 댓글) — Monday 표 말풍선 패널이 그때그때 읽고 쓴다. 서버:
// functions-xtool tech-boards/updates.ts. 우리 화면에서 쓴 글은 API 키 주인 계정으로 올라가서
// 본문 끝에 서명("— 이름 · xtool tech")이 붙는다 — 읽을 때 떼어 작성자로 보여 준다.

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

export async function fetchUpdates(boardKey: TechBoardKey, itemId: string): Promise<TechUpdate[]> {
  const { data } = await httpsCallable<{ boardKey: string; itemId: string }, { updates: TechUpdate[] }>(
    xtoolFirebase().functions,
    'techItemUpdates',
  )({ boardKey, itemId })
  return data.updates
}

/** 업데이트(parentId면 그 답글) 쓰기 */
export async function postUpdate(boardKey: TechBoardKey, itemId: string, text: string, parentId?: string): Promise<void> {
  await httpsCallable(xtoolFirebase().functions, 'techCreateUpdate')({ boardKey, itemId, text, parentId: parentId ?? null })
}

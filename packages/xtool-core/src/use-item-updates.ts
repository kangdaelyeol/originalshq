import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCurrentMember } from './member-context'
import { errorText } from './error-text'
import type { TechBoardKey } from './tech-boards'
import { dismissToast, pushToast } from './tech-save-queue'
import { fetchUpdates, postUpdate, watchCachedUpdates, type TechUpdate } from './tech-updates'

// 항목 업데이트(Monday 댓글) 읽기·쓰기 — 세 레이아웃이 같이 쓴다(Monday 표 말풍선 패널, 대시보드·물 상세
// 서랍의 "업데이트" 탭). 모양만 레이아웃마다 다르고 동작은 여기 하나다.

/** 업데이트를 세는(말풍선이 있는) 보드 — 출장업무·아톡문의 */
export const UPDATE_BOARDS: ReadonlySet<TechBoardKey> = new Set(['fieldService', 'techInquiry'])

// 함수가 문구 없이 실패하면 코드(internal)만 온다 — 그때는 이 문장으로.
export const updatesErrorText = (error: unknown) =>
  errorText(error, { fallback: 'Monday와 연결하지 못했어요. 잠시 후 다시 해 주세요.' })

/** 2026-09-02T05:30:00Z → "9월 2일 14:30" (한국 시각) */
export function updateWhenText(iso: string | null): string {
  if (!iso) return ''
  const k = new Date(Date.parse(iso) + 9 * 3600_000).toISOString()
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const year = k.slice(0, 4) === today.slice(0, 4) ? '' : `${k.slice(0, 4)}년 `
  return `${year}${Number(k.slice(5, 7))}월 ${Number(k.slice(8, 10))}일 ${k.slice(11, 16)}`
}

/** 올리는 중인 글(아직 서버에 없다) */
export const isPendingUpdate = (update: TechUpdate) => update.id.startsWith('temp-')

/** 올린(올리는 중인) 글 — 서버 목록에 그 id가 들어오면 서버 것을 보여 준다. */
interface Post {
  update: TechUpdate
  parentId?: string
  /** 올라간 뒤의 업데이트 id */
  realId?: string
}

/** 서버 목록 + 아직 목록에 없는 내 글(새 글은 맨 위, 답글은 그 글 아래) */
function mergePosts(server: TechUpdate[], posts: Post[]): TechUpdate[] {
  const known = new Set(server.flatMap((u) => [u.id, ...u.replies.map((r) => r.id)]))
  const open = posts
    .filter((p) => !(p.realId && known.has(p.realId)))
    .map((p) => ({ ...p, update: p.realId ? { ...p.update, id: p.realId } : p.update }))
  if (open.length === 0) return server
  const top = open.filter((p) => !p.parentId).reverse().map((p) => p.update)
  return [
    ...top,
    ...server.map((u) => {
      const replies = open.filter((p) => p.parentId === u.id).map((p) => p.update)
      return replies.length ? { ...u, replies: [...u.replies, ...replies] } : u
    }),
  ]
}

export interface ItemUpdatesState {
  /** 보여 줄 목록 — 아직 아무것도 못 받았으면 null */
  updates: TechUpdate[] | null
  /** 서버(캐시·Monday) 목록을 받았는지 — 다시 읽기에 실패해도 받아 둔 목록이 있으면 그걸 보여 준다 */
  loaded: boolean
  error: string | null
  /** 늦어질 때만 "불러오는 중"(캐시는 보통 바로 와서 깜빡이지 않게) */
  slow: boolean
  /** 내 이름 — 글 끝 서명·"… 이름으로 올라가요" */
  me: string
  /** Monday에서 다시 읽기 */
  load: () => void
  /** 올리기(parentId면 답글) — 빈 글이면 false */
  send: (text: string, parentId?: string) => boolean
}

/**
 * 항목 업데이트 — 캐시(techItemUpdates)를 바로 보여 주고(실시간) 열 때 Monday에서 다시 읽어 맞춘다.
 * 올리면 목록에 바로 넣어 보여 주고(흐리게, "올리는 중") 요청은 뒤에서 — 올라가면 서버 캐시에 그 글이
 * 들어오고, 실패하면 뺀 뒤 토스트에 "다시 시도"를 붙인다.
 */
export function useItemUpdates(boardKey: TechBoardKey, itemId: string): ItemUpdatesState {
  const member = useCurrentMember()
  // 서버 목록(캐시 또는 함수로 읽은 것) — 내 글은 posts에 따로 두고 합쳐 보여 준다.
  const [server, setServer] = useState<TechUpdate[] | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [error, setError] = useState<string | null>(null)
  // 캐시를 구독하고 있는지 — 못 읽으면(규칙 배포 전) 글을 올린 뒤 함수로 다시 읽는다.
  const live = useRef(false)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 400)
    return () => clearTimeout(timer)
  }, [])
  // 올리는 중인 글의 임시 id
  const tempId = useRef(0)

  // 닫힌 뒤 늦게 온 응답은 버린다.
  const alive = useRef(true)
  useEffect(() => {
    // 개발 모드(StrictMode)는 effect를 정리했다 다시 돌린다 — 다시 돌 때 되살린다.
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const load = useCallback(() => {
    fetchUpdates(boardKey, itemId)
      .then((list) => {
        if (!alive.current) return
        setError(null)
        setServer(list)
      })
      .catch((e: unknown) => alive.current && setError(updatesErrorText(e)))
  }, [boardKey, itemId])

  useEffect(
    () =>
      watchCachedUpdates(
        itemId,
        (list) => {
          live.current = true
          if (list) setServer(list)
        },
        () => {
          live.current = false
        },
      ),
    [itemId],
  )

  // 캐시는 바로 보이고, Monday에서 다시 읽어 맞춘다(그사이 webhook을 놓쳤어도).
  useEffect(() => {
    load()
  }, [load])

  const updates = useMemo(
    () => (server ? mergePosts(server, posts) : posts.length ? mergePosts([], posts) : null),
    [server, posts],
  )

  const me = member?.name || member?.email || ''

  const send = (text: string, parentId?: string): boolean => {
    const body = text.trim()
    if (!body) return false
    const temp: TechUpdate = {
      id: `temp-${++tempId.current}`,
      // 서명을 붙여 두면 작성자(나)로 보인다(authorOf).
      text: `${body}\n\n— ${me || '나'} · xtool tech`,
      createdAt: new Date().toISOString(),
      creator: null,
      replies: [],
    }
    setPosts((list) => [...list, { update: temp, parentId }])
    postUpdate(boardKey, itemId, body, parentId)
      .then((id) => {
        if (!alive.current) return
        setPosts((list) => list.map((p) => (p.update.id === temp.id ? { ...p, realId: id } : p)))
        // 캐시를 못 읽으면 함수로 다시 읽어 맞춘다.
        if (!live.current) load()
      })
      .catch((e: unknown) => {
        if (alive.current) setPosts((list) => list.filter((p) => p.update.id !== temp.id))
        const toastId: number = pushToast({
          tone: 'error',
          title: '업데이트를 올리지 못했어요',
          message: updatesErrorText(e),
          action: {
            label: '다시 시도',
            run: () => {
              dismissToast(toastId)
              send(body, parentId)
            },
          },
        })
      })
    return true
  }

  return { updates, loaded: server !== null, error, slow, me, load, send }
}

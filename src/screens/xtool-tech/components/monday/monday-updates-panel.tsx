import { CornerDownRight, LoaderCircle, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCurrentMember } from '../../context/member-context'
import type { TechBoardKey } from '../../data/tech-boards'
import { usePhotoOf } from '../../data/tech-profiles'
import { dismissToast, pushToast } from '../../data/tech-save-queue'
import { authorOf, fetchUpdates, postUpdate, watchCachedUpdates, type TechUpdate } from '../../data/tech-updates'
import { isComposing } from '../../lib/ime'
import { cx } from '../../lib/cx'
import { usePortalRoot } from '../../lib/portal-root'
import { PersonAvatar } from './monday-cells'

const errorText = (error: unknown) => {
  const message = (error instanceof Error ? error.message : String(error)).replace(/\s*\[\d+\]$/, '')
  // 함수가 문구 없이 실패하면 코드(internal)만 온다.
  return message && !/^internal$/i.test(message) ? message : 'Monday와 연결하지 못했어요. 잠시 후 다시 해 주세요.'
}

/** 2026-09-02T05:30:00Z → "9월 2일 14:30" (한국 시각) */
function whenText(iso: string | null): string {
  if (!iso) return ''
  const k = new Date(Date.parse(iso) + 9 * 3600_000).toISOString()
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const year = k.slice(0, 4) === today.slice(0, 4) ? '' : `${k.slice(0, 4)}년 `
  return `${year}${Number(k.slice(5, 7))}월 ${Number(k.slice(8, 10))}일 ${k.slice(11, 16)}`
}

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

interface UpdatesPanelProps {
  boardKey: TechBoardKey
  itemId: string
  /** 패널 제목 — 항목 이름 */
  title: string
  onClose: () => void
}

/**
 * 업데이트 패널(Monday 항목 패널의 "업데이트" 탭) — 오른쪽에 붙어 열린다. 위에 쓰기 칸, 아래로
 * 최근 업데이트와 답글. Monday 패널의 서식 도구·파일·활동 로그·좋아요·조회 수는 우리에게 없어서
 * 뺐다. 글은 우리 API 계정으로 올라가고 끝에 쓴 사람 서명이 붙는다(tech-updates.ts). 목록은 캐시를
 * 바로 보여 주고(실시간) 열 때 Monday에서 다시 읽어 맞춘다 — 기다리는 건 처음 여는 항목뿐.
 */
export function UpdatesPanel({ boardKey, itemId, title, onClose }: UpdatesPanelProps) {
  const root = usePortalRoot()
  const member = useCurrentMember()
  const photoOf = usePhotoOf()
  // 서버 목록(캐시 또는 함수로 읽은 것) — 내 글은 posts에 따로 두고 합쳐 보여 준다.
  const [server, setServer] = useState<TechUpdate[] | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [error, setError] = useState<string | null>(null)
  // 캐시를 구독하고 있는지 — 못 읽으면(규칙 배포 전) 글을 올린 뒤 함수로 다시 읽는다.
  const live = useRef(false)
  // "불러오는 중"은 늦어질 때만 — 캐시는 보통 바로 와서 깜빡이지 않게.
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 400)
    return () => clearTimeout(timer)
  }, [])
  const [draft, setDraft] = useState('')
  // 올리는 중인 글의 임시 id
  const tempId = useRef(0)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)

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
      .catch((e: unknown) => alive.current && setError(errorText(e)))
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

  const updates = useMemo(() => (server ? mergePosts(server, posts) : posts.length ? mergePosts([], posts) : null), [server, posts])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // 위에 뜬 것(칸 팝오버·파일 모달·확인 모달)이 먼저 닫힌다. 표의 입력 칸(추가 줄·검색)에서
      // 누른 Esc는 그 칸 취소라 패널을 닫지 않는다.
      if (document.querySelector('.mon-popover, .mon-modal, .confirm, .image-viewer')) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea') && !panelRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    panelRef.current?.querySelector<HTMLTextAreaElement>('.mon-composer textarea')?.focus()
  }, [itemId])

  const me = member?.name || member?.email || ''

  /**
   * 올리기 — 목록에 바로 넣어 보여 주고(흐리게, "올리는 중") 요청은 뒤에서. 올라가면 서버가 캐시를
   * 새로 써서 그 글이 목록에 들어오고, 실패하면 뺀 뒤 토스트에 "다시 시도"를 붙인다.
   */
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
          message: errorText(e),
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

  return createPortal(
    <aside ref={panelRef} className="mon-panel" role="dialog" aria-label={`${title} 업데이트`}>
      <header className="mon-panel__head">
        <button type="button" className="mon-panel__close" aria-label="닫기" onClick={onClose}>
          <X size={20} aria-hidden />
        </button>
        <h2 className="mon-panel__title" title={title}>
          {title}
        </h2>
      </header>
      <nav className="mon-panel__tabs" aria-label="항목 패널">
        <span className="mon-panel__tab is-on">업데이트{updates ? ` / ${updates.length}` : ''}</span>
      </nav>

      <div className="mon-panel__body">
        <form
          className="mon-composer"
          onSubmit={(e) => {
            e.preventDefault()
            if (send(draft)) setDraft('')
          }}
        >
          <textarea
            value={draft}
            placeholder="업데이트를 적어 주세요 — 팀이 Monday에서도 같이 봐요"
            aria-label="업데이트 쓰기"
            rows={4}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // ⌘/Ctrl+엔터로 올리기(엔터는 줄바꿈)
              if (e.key === 'Enter' && !isComposing(e) && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                if (send(draft)) setDraft('')
              }
            }}
          />
          <div className="mon-composer__foot">
            <span>{me ? `${me} 이름으로 올라가요` : ''}</span>
            <button type="submit" className="mon-composer__send" disabled={!draft.trim()}>
              업데이트
            </button>
          </div>
        </form>

        {error && (
          <p className="mon-panel__note mon-panel__note--error" role="alert">
            {/* 캐시가 있으면 그걸 보여 주고 있다 — 최신이 아닐 수 있다는 것만 알린다. */}
            {server ? 'Monday에서 다시 읽지 못해 저장된 목록을 보여 주고 있어요.' : error}
            <button type="button" onClick={load}>
              다시 불러오기
            </button>
          </p>
        )}
        {!updates && !error && slow && (
          <p className="mon-panel__note">
            <LoaderCircle size={14} className="is-spinning" aria-hidden /> 불러오는 중…
          </p>
        )}
        {updates?.length === 0 && <p className="mon-panel__note">아직 업데이트가 없어요.</p>}

        {updates?.map((update) => (
          <UpdateCard
            key={update.id}
            update={update}
            photoOf={photoOf}
            me={me}
            replying={replyTo === update.id}
            onReply={() => setReplyTo((id) => (id === update.id ? null : update.id))}
            onSendReply={(text) => {
              const ok = send(text, update.id)
              if (ok) setReplyTo(null)
              return ok
            }}
          />
        ))}
      </div>
    </aside>,
    root ?? document.body,
  )
}

/** 올리는 중인 글(아직 서버에 없다) */
const isPending = (update: TechUpdate) => update.id.startsWith('temp-')

function Author({ update, photoOf, small }: { update: TechUpdate; photoOf: (name: string) => string | undefined; small?: boolean }) {
  const { author, viaApp } = authorOf(update)
  const photo = photoOf(author) ?? (viaApp ? undefined : (update.creator?.photo ?? undefined))
  return (
    <div className={small ? 'mon-update__author is-small' : 'mon-update__author'}>
      <PersonAvatar name={author} photo={photo} />
      <strong>{author}</strong>
      {isPending(update) ? (
        <span className="mon-update__pending">
          <LoaderCircle size={12} className="is-spinning" aria-hidden />
          올리는 중
        </span>
      ) : (
        <time dateTime={update.createdAt ?? undefined}>{whenText(update.createdAt)}</time>
      )}
    </div>
  )
}

function UpdateCard({
  update,
  photoOf,
  me,
  replying,
  onReply,
  onSendReply,
}: {
  update: TechUpdate
  photoOf: (name: string) => string | undefined
  me: string
  replying: boolean
  onReply: () => void
  onSendReply: (text: string) => boolean
}) {
  const [reply, setReply] = useState('')
  return (
    <article className={cx('mon-update', isPending(update) && 'is-pending')}>
      <Author update={update} photoOf={photoOf} />
      <p className="mon-update__text">{authorOf(update).text}</p>

      {update.replies.length > 0 && (
        <ul className="mon-update__replies">
          {update.replies.map((r) => (
            <li key={r.id} className={cx(isPending(r) && 'is-pending')}>
              <Author update={r} photoOf={photoOf} small />
              <p className="mon-update__text">{authorOf(r).text}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mon-update__actions">
        <button type="button" onClick={onReply} aria-expanded={replying}>
          <CornerDownRight size={14} aria-hidden />
          답변
        </button>
      </div>

      {replying && (
        <form
          className="mon-update__reply"
          onSubmit={(e) => {
            e.preventDefault()
            if (onSendReply(reply)) setReply('')
          }}
        >
          <PersonAvatar name={me || '나'} photo={me ? photoOf(me) : undefined} />
          <input
            autoFocus
            value={reply}
            placeholder="답글을 적어 주세요"
            aria-label="답글 쓰기"
            onChange={(e) => setReply(e.target.value)}
          />
          <button type="submit" disabled={!reply.trim()}>
            답글
          </button>
        </form>
      )}
    </article>
  )
}

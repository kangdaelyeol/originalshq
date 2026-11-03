import { CornerDownRight, LoaderCircle, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCurrentMember } from '../../context/member-context'
import type { TechBoardKey } from '../../data/tech-boards'
import { usePhotoOf } from '../../data/tech-profiles'
import { pushToast } from '../../data/tech-save-queue'
import { authorOf, fetchUpdates, postUpdate, type TechUpdate } from '../../data/tech-updates'
import { usePortalRoot } from '../../lib/portal-root'
import { PersonAvatar } from './monday-cells'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).replace(/\s*\[\d+\]$/, '')

/** 2026-09-02T05:30:00Z → "9월 2일 14:30" (한국 시각) */
function whenText(iso: string | null): string {
  if (!iso) return ''
  const k = new Date(Date.parse(iso) + 9 * 3600_000).toISOString()
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const year = k.slice(0, 4) === today.slice(0, 4) ? '' : `${k.slice(0, 4)}년 `
  return `${year}${Number(k.slice(5, 7))}월 ${Number(k.slice(8, 10))}일 ${k.slice(11, 16)}`
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
 * 뺐다. 글은 우리 API 계정으로 올라가고 끝에 쓴 사람 서명이 붙는다(tech-updates.ts).
 */
export function UpdatesPanel({ boardKey, itemId, title, onClose }: UpdatesPanelProps) {
  const root = usePortalRoot()
  const member = useCurrentMember()
  const photoOf = usePhotoOf()
  const [updates, setUpdates] = useState<TechUpdate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  // 닫힌 뒤 늦게 온 응답은 버린다.
  const alive = useRef(true)
  useEffect(
    () => () => {
      alive.current = false
    },
    [],
  )
  const load = useCallback(() => {
    setError(null)
    fetchUpdates(boardKey, itemId)
      .then((list) => alive.current && setUpdates(list))
      .catch((e: unknown) => alive.current && setError(errorText(e)))
  }, [boardKey, itemId])

  useEffect(() => {
    load()
  }, [load])

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

  const send = async (text: string, parentId?: string) => {
    if (!text.trim() || posting) return false
    setPosting(true)
    try {
      await postUpdate(boardKey, itemId, text, parentId)
      load()
      return true
    } catch (e) {
      pushToast({ tone: 'error', title: '업데이트를 올리지 못했어요', message: errorText(e) })
      return false
    } finally {
      setPosting(false)
    }
  }

  const me = member?.name || member?.email || ''

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
            void send(draft).then((ok) => ok && setDraft(''))
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
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void send(draft).then((ok) => ok && setDraft(''))
              }
            }}
          />
          <div className="mon-composer__foot">
            <span>{me ? `${me} 이름으로 올라가요` : ''}</span>
            <button type="submit" className="mon-composer__send" disabled={!draft.trim() || posting}>
              {posting && !replyTo ? <LoaderCircle size={14} className="is-spinning" aria-hidden /> : null}
              업데이트
            </button>
          </div>
        </form>

        {error && (
          <p className="mon-panel__note mon-panel__note--error" role="alert">
            {error}
            <button type="button" onClick={load}>
              다시 불러오기
            </button>
          </p>
        )}
        {!updates && !error && (
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
            posting={posting}
            onReply={() => setReplyTo((id) => (id === update.id ? null : update.id))}
            onSendReply={(text) =>
              send(text, update.id).then((ok) => {
                if (ok) setReplyTo(null)
                return ok
              })
            }
          />
        ))}
      </div>
    </aside>,
    root ?? document.body,
  )
}

function Author({ update, photoOf, small }: { update: TechUpdate; photoOf: (name: string) => string | undefined; small?: boolean }) {
  const { author, viaApp } = authorOf(update)
  const photo = photoOf(author) ?? (viaApp ? undefined : (update.creator?.photo ?? undefined))
  return (
    <div className={small ? 'mon-update__author is-small' : 'mon-update__author'}>
      <PersonAvatar name={author} photo={photo} />
      <strong>{author}</strong>
      <time dateTime={update.createdAt ?? undefined}>{whenText(update.createdAt)}</time>
    </div>
  )
}

function UpdateCard({
  update,
  photoOf,
  me,
  replying,
  posting,
  onReply,
  onSendReply,
}: {
  update: TechUpdate
  photoOf: (name: string) => string | undefined
  me: string
  replying: boolean
  posting: boolean
  onReply: () => void
  onSendReply: (text: string) => Promise<boolean>
}) {
  const [reply, setReply] = useState('')
  return (
    <article className="mon-update">
      <Author update={update} photoOf={photoOf} />
      <p className="mon-update__text">{authorOf(update).text}</p>

      {update.replies.length > 0 && (
        <ul className="mon-update__replies">
          {update.replies.map((r) => (
            <li key={r.id}>
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
            void onSendReply(reply).then((ok) => ok && setReply(''))
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
          <button type="submit" disabled={!reply.trim() || posting}>
            {posting ? <LoaderCircle size={14} className="is-spinning" aria-hidden /> : '답글'}
          </button>
        </form>
      )}
    </article>
  )
}

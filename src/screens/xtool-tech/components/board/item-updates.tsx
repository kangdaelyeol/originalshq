import { CornerDownRight, LoaderCircle, Send } from 'lucide-react'
import { useState } from 'react'
import { initialsOf } from '@/xtool-auth/use-xtool-session'
import { Avatar } from '@/ohq-ui/components/avatar'
import { Button } from '@/ohq-ui/components/button'
import { cx } from '@/ohq-ui/lib/cx'
import type { TechBoardKey } from '@xtool-core/tech-boards'
import { usePhotoOf } from '../../data/tech-profiles'
import { authorOf, type TechUpdate } from '@xtool-core/tech-updates'
import { isPendingUpdate, updateWhenText, useItemUpdates } from '@xtool-core/use-item-updates'
import { isComposing } from '../../lib/ime'
import { personColor } from '../../lib/person-color'

/**
 * 상세 서랍의 "업데이트" 탭(대시보드) — 위에 쓰기 칸, 아래로 업데이트와 답글. 읽기·쓰기는 Monday 표 말풍선
 * 패널과 같은 훅(useItemUpdates)이라 캐시를 바로 보여 주고 Monday에서 다시 읽어 맞추며, 올린 글은 바로
 * 보이고 실패하면 토스트에 "다시 시도"가 붙는다.
 */
export function ItemUpdates({ boardKey, itemId }: { boardKey: TechBoardKey; itemId: string }) {
  const photoOf = usePhotoOf()
  const { updates, loaded, error, slow, me, load, send } = useItemUpdates(boardKey, itemId)
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const submit = () => {
    if (send(draft)) setDraft('')
  }

  return (
    <section className="item-updates" aria-label="업데이트">
      <form
        className="item-updates__composer"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <textarea
          className="field__input field__textarea"
          value={draft}
          rows={3}
          placeholder="업데이트를 적어 주세요 — 팀이 Monday에서도 같이 봐요"
          aria-label="업데이트 쓰기"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // ⌘/Ctrl+엔터로 올리기(엔터는 줄바꿈)
            if (e.key === 'Enter' && !isComposing(e) && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <div className="item-updates__foot">
          <span>{me ? `${me} 이름으로 올라가요` : ''}</span>
          <Button type="submit" size="sm" icon={Send} disabled={!draft.trim()}>
            올리기
          </Button>
        </div>
      </form>

      {error && (
        <p className="item-updates__note is-error" role="alert">
          {/* 받아 둔 목록이 있으면 그걸 보여 주고 있다 — 최신이 아닐 수 있다는 것만 알린다. */}
          {loaded ? 'Monday에서 다시 읽지 못해 저장된 목록을 보여 주고 있어요.' : error}
          <button type="button" className="text-link" onClick={load}>
            다시 불러오기
          </button>
        </p>
      )}
      {!updates && !error && slow && (
        <p className="item-updates__note">
          <LoaderCircle size={14} className="is-spinning" aria-hidden /> 불러오는 중…
        </p>
      )}
      {updates?.length === 0 && <p className="item-updates__note">아직 업데이트가 없어요.</p>}

      {updates && updates.length > 0 && (
        <ol className="item-updates__list">
          {updates.map((update) => (
            <UpdateItem
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
        </ol>
      )}
    </section>
  )
}

function Author({ update, photoOf }: { update: TechUpdate; photoOf: (name: string) => string | undefined }) {
  const { author, viaApp } = authorOf(update)
  const photo = photoOf(author) ?? (viaApp ? undefined : (update.creator?.photo ?? undefined))
  return (
    <div className="item-update__author">
      <Avatar initials={initialsOf(author, '')} color={personColor(author)} size="xs" photo={photo} />
      <strong>{author}</strong>
      {isPendingUpdate(update) ? (
        <span className="item-update__pending">
          <LoaderCircle size={12} className="is-spinning" aria-hidden />
          올리는 중
        </span>
      ) : (
        <time dateTime={update.createdAt ?? undefined}>{updateWhenText(update.createdAt)}</time>
      )}
    </div>
  )
}

function UpdateItem({
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
    <li className={cx('item-update', isPendingUpdate(update) && 'is-pending')}>
      <Author update={update} photoOf={photoOf} />
      <p className="item-update__text">{authorOf(update).text}</p>

      {update.replies.length > 0 && (
        <ul className="item-update__replies">
          {update.replies.map((r) => (
            <li key={r.id} className={cx(isPendingUpdate(r) && 'is-pending')}>
              <Author update={r} photoOf={photoOf} />
              <p className="item-update__text">{authorOf(r).text}</p>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="item-update__reply-toggle" onClick={onReply} aria-expanded={replying}>
        <CornerDownRight size={13} aria-hidden />
        답변
      </button>

      {replying && (
        <form
          className="item-update__reply"
          onSubmit={(e) => {
            e.preventDefault()
            if (onSendReply(reply)) setReply('')
          }}
        >
          <input
            className="field__input"
            autoFocus
            value={reply}
            placeholder={me ? `${me} 이름으로 답글을 적어 주세요` : '답글을 적어 주세요'}
            aria-label="답글 쓰기"
            onChange={(e) => setReply(e.target.value)}
          />
          <Button type="submit" size="sm" variant="ghost" disabled={!reply.trim()}>
            답글
          </Button>
        </form>
      )}
    </li>
  )
}

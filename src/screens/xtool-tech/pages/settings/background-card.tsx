import { Check, ImagePlus, LoaderCircle, RotateCcw, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { BackgroundArt } from '@/ohq-ui/backgrounds/background-art'
import { ConfirmDialog } from '@/ohq-ui/components/confirm-dialog'
import { Button, GlassCard } from '../../components/layout-parts'
import { useCurrentMember } from '../../context/member-context'
import {
  BACKGROUND_ACCEPT,
  deleteSharedBackground,
  type SharedBackground,
  type useSharedBackgrounds,
} from '../../data/tech-backgrounds'
import { pushToast } from '../../data/tech-save-queue'
import { errorText } from '../../lib/error-text'
import { cx } from '@/ohq-ui/lib/cx'
import { DEFAULT_ACCENT } from '@/ohq-ui/theme/accent'
import { BACKGROUND_OPTIONS, useAppearance } from '@/ohq-ui/appearance/appearance'

const KIND_LABEL = { default: '기본', texture: '텍스처', photo: '사진' } as const

/** 직원이 공유한 사진 한 장 — 누르면 배경으로. 올린 사람에게만 지우기 버튼이 보인다. */
function SharedTile({
  item,
  selected,
  mine,
  onSelect,
  onDeleted,
}: {
  item: SharedBackground
  selected: boolean
  mine: boolean
  onSelect: () => void
  onDeleted: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 확인 모달에서 "지우기"를 누르면
  const remove = () => {
    setConfirming(false)
    setDeleting(true)
    deleteSharedBackground(item.id)
      .then(() => {
        pushToast({ tone: 'success', title: `${item.name} 배경을 지웠어요` })
        onDeleted()
      })
      .catch((error: unknown) => {
        setDeleting(false)
        pushToast({ tone: 'error', title: '배경을 지우지 못했어요', message: errorText(error) })
      })
  }

  return (
    <div className="bg-tile-wrap">
      <button
        type="button"
        className={cx('bg-tile', selected && 'is-selected', deleting && 'is-busy')}
        aria-pressed={selected}
        disabled={deleting}
        onClick={onSelect}
      >
        <span className="bg-tile__art">
          <BackgroundArt kind="shared" accent={DEFAULT_ACCENT} photoUrl={item.thumbUrl} />
          {selected && (
            <span className="bg-tile__check" aria-hidden>
              <Check size={14} strokeWidth={3} />
            </span>
          )}
        </span>
        <span className="bg-tile__meta">
          <span className="bg-tile__name">
            <span className="bg-tile__title">{item.name}</span>
            <span className="bg-tile__kind">공유</span>
          </span>
          <span className="bg-tile__desc">{item.uploaderName || item.uploaderEmail}님이 공유함</span>
        </span>
      </button>
      {mine && (
        <button
          type="button"
          className="bg-tile__delete"
          onClick={() => setConfirming(true)}
          disabled={deleting}
          aria-label={`${item.name} 지우기`}
          title="팀 모두의 목록에서 지워져요"
        >
          {deleting ? <LoaderCircle size={13} className="is-spinning" aria-hidden /> : <Trash2 size={13} aria-hidden />}
        </button>
      )}
      <ConfirmDialog
        open={confirming}
        title={`'${item.name}' 배경을 지울까요?`}
        message="팀 모두의 배경 목록에서 지워지고 되돌릴 수 없어요. 이 배경을 쓰던 사람은 기본 배경으로 바뀌어요."
        confirmLabel="지우기"
        onCancel={() => setConfirming(false)}
        onConfirm={remove}
      />
    </div>
  )
}

interface BackgroundCardProps {
  /** 팀이 공유한 사진 목록 — 설정 화면이 받아 넘긴다(useSharedBackgrounds) */
  shared: ReturnType<typeof useSharedBackgrounds>
  /** 내 사진을 올리는 중 */
  uploading: boolean
  /** 고른 사진 올리기 — 설정 화면이 한다 */
  onUpload: (file: File) => void
}

/** 배경 — 기본·텍스처·사진 배경과 팀이 공유한 사진. 내 사진을 올려 팀과 나눌 수 있다. */
export function BackgroundCard({ shared, uploading, onUpload }: BackgroundCardProps) {
  const { background, sharedBackgroundId, accent, setBackground, setSharedBackground, reset } = useAppearance()
  const member = useCurrentMember()
  const fileInput = useRef<HTMLInputElement>(null)

  // 고른 사진 — 같은 사진을 다시 골라도 알 수 있게 파일 칸은 비운다
  const pick = (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = ''
    if (file) onUpload(file)
  }

  return (
    <GlassCard
      title="배경"
      actions={
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={reset}>
          기본값으로
        </Button>
      }
    >
      <div className="bg-options">
        {BACKGROUND_OPTIONS.map((option) => {
          const selected = option.value === background
          return (
            <button
              key={option.value}
              type="button"
              className={cx('bg-tile', selected && 'is-selected')}
              aria-pressed={selected}
              onClick={() => setBackground(option.value)}
            >
              <span className="bg-tile__art">
                <BackgroundArt kind={option.value} accent={option.kind === 'photo' ? DEFAULT_ACCENT : accent} />
                {selected && (
                  <span className="bg-tile__check" aria-hidden>
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="bg-tile__meta">
                <span className="bg-tile__name">
                  {option.label}
                  <span className="bg-tile__kind">{KIND_LABEL[option.kind]}</span>
                </span>
                <span className="bg-tile__desc">{option.description}</span>
              </span>
            </button>
          )
        })}
      </div>

      <h3 className="bg-section-label">
        팀이 공유한 사진 {shared.items && shared.items.length > 0 && <span>{shared.items.length}장</span>}
      </h3>
      <div className="bg-options">
        <button
          type="button"
          className={cx('bg-tile', 'bg-tile--upload', uploading && 'is-busy')}
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <span className="bg-tile__art bg-tile__upload">
            {uploading ? <LoaderCircle size={22} className="is-spinning" aria-hidden /> : <ImagePlus size={22} aria-hidden />}
            {uploading ? '줄여서 올리는 중…' : '사진 올리기'}
          </span>
          <span className="bg-tile__meta">
            <span className="bg-tile__name">내 사진 공유</span>
            <span className="bg-tile__desc">JPG·PNG·WEBP — 팀 모두가 배경으로 쓸 수 있어요</span>
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={BACKGROUND_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {(shared.items ?? []).map((item) => {
          const selected = background === 'shared' && sharedBackgroundId === item.id
          return (
            <SharedTile
              key={item.id}
              item={item}
              selected={selected}
              mine={item.uploaderEmail === member?.email}
              onSelect={() => setSharedBackground(item.id)}
              onDeleted={() => {
                if (selected) setBackground('shards')
              }}
            />
          )
        })}
      </div>
      {shared.error && <p className="bg-section-note">{shared.error}</p>}
    </GlassCard>
  )
}

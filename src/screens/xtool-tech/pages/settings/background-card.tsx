import { Check, RotateCcw } from 'lucide-react'
import { BackgroundArt } from '@/ohq-ui/backgrounds/background-art'
import { Button, GlassCard } from '../../components/layout-parts'
import type { useSharedBackgrounds } from '../../data/tech-backgrounds'
import { cx } from '@/ohq-ui/lib/cx'
import { SharedPhotoPicker } from './shared-photo-picker'
import { DEFAULT_ACCENT } from '@/ohq-ui/theme/accent'
import { BACKGROUND_OPTIONS, useAppearance } from '@/ohq-ui/appearance/appearance'

const KIND_LABEL = { default: '기본', texture: '텍스처', photo: '사진' } as const

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

      <SharedPhotoPicker
        shared={shared}
        uploading={uploading}
        onUpload={onUpload}
        selectedId={background === 'shared' ? sharedBackgroundId : null}
        onSelect={setSharedBackground}
        onCleared={() => setBackground('shards')}
      />
    </GlassCard>
  )
}

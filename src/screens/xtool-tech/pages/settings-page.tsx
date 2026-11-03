import { Camera, Check, ImagePlus, Info, LoaderCircle, Pipette, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useRef, useState, type CSSProperties } from 'react'
import { BackgroundArt } from '../components/backgrounds/background-art'
import { initialsOf } from '@/xtool-auth/use-xtool-session'
import { BrandMark } from '../components/brand/brand-mark'
import { Avatar } from '../components/ui/avatar'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { GlassCard } from '../components/ui/glass-card'
import { RangeField } from '../components/ui/range-field'
import { StatusPill } from '../components/ui/status-pill'
import { useCurrentMember } from '../context/member-context'
import {
  BACKGROUND_ACCEPT,
  deleteSharedBackground,
  uploadSharedBackground,
  useSharedBackgrounds,
  useSharedBackgroundUrl,
  type SharedBackground,
} from '../data/tech-backgrounds'
import { deleteProfilePhoto, PROFILE_ACCEPT, uploadProfilePhoto, useProfilePhoto } from '../data/tech-profiles'
import { pushToast } from '../data/tech-save-queue'
import { cx } from '../lib/cx'
import { ACCENT_PRESETS, DEFAULT_ACCENT } from '../settings/accent'
import { GLASS_LIMITS, GLASS_PRESETS, glassVars, matchGlassPreset } from '../settings/glass'
import { BACKGROUND_OPTIONS, isPhotoBackground, LAYOUT_OPTIONS, useSettings, type BoardLayout } from '../settings/settings'

const KIND_LABEL = { default: '기본', texture: '텍스처', photo: '사진' } as const
// 직접 고르기 — 색 고르는 창을 끄는 동안 매번 배경을 다시 그리면 버벅여서, 손을 멈춘 뒤 반영한다.
const CUSTOM_COMMIT_MS = 120

/** 레이아웃 견본 — 대시보드는 숫자 카드·차트, Monday 표는 색 막대가 붙은 그룹 표. */
function LayoutArt({ layout }: { layout: BoardLayout }) {
  if (layout === 'dashboard') {
    return (
      <span className="layout-art layout-art--dashboard" aria-hidden>
        <span className="layout-art__kpis">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="layout-art__card">
          <i />
          <i />
          <i />
        </span>
      </span>
    )
  }
  return (
    <span className="layout-art layout-art--monday" aria-hidden>
      {['#579bfc', '#a25ddc'].map((group) => (
        <span key={group} className="layout-art__group" style={{ '--group': group } as CSSProperties}>
          {[0, 1, 2].map((row) => (
            <span key={row} className="layout-art__row">
              <i />
              <i style={{ background: ['#6e7287', '#fdab3d', '#00c875'][(row + (group === '#579bfc' ? 0 : 1)) % 3] }} />
              <i />
            </span>
          ))}
        </span>
      ))}
    </span>
  )
}

/** 내 프로필 사진 — 올리면 담당자 동그라미·팀 현황·사이드바에 이 사진이 보인다. */
function ProfilePhotoCard() {
  const member = useCurrentMember()
  const photo = useProfilePhoto(member?.email)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  if (!member) return null

  const run = (task: Promise<void>, done: string, failed: string) => {
    setBusy(true)
    task
      .then(() => pushToast({ tone: 'success', title: done }))
      .catch((error: unknown) => pushToast({ tone: 'error', title: failed, message: errorText(error) }))
      .finally(() => setBusy(false))
  }

  const upload = (file: File | undefined) => {
    if (input.current) input.current.value = ''
    if (file) run(uploadProfilePhoto(file, member), '프로필 사진을 바꿨어요', '사진을 올리지 못했어요')
  }

  return (
    <GlassCard title="프로필 사진" subtitle="담당자 칸·팀 현황·사이드바에 이름 대신 보이는 사진이에요. 팀 모두가 봐요.">
      <div className="profile-photo">
        <Avatar
          initials={initialsOf(member.name, member.email)}
          color="var(--accent)"
          ink="var(--accent-ink)"
          photo={photo}
          className="profile-photo__avatar"
        />
        <div className="profile-photo__meta">
          <strong>{member.name || member.email}</strong>
          <span>{member.email}</span>
        </div>
        <div className="profile-photo__actions">
          <Button icon={busy ? LoaderCircle : Camera} disabled={busy} onClick={() => input.current?.click()}>
            {photo ? '사진 바꾸기' : '사진 올리기'}
          </Button>
          {photo && (
            <Button
              variant="ghost"
              icon={Trash2}
              disabled={busy}
              onClick={() => run(deleteProfilePhoto(member.email), '프로필 사진을 지웠어요', '사진을 지우지 못했어요')}
            >
              지우기
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept={PROFILE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => upload(e.target.files?.[0])}
        />
      </div>
    </GlassCard>
  )
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).replace(/\s*\[\d+\]$/, '')

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

export function SettingsPage() {
  const {
    layout,
    setLayout,
    background,
    sharedBackgroundId,
    accent,
    accentInUse,
    glass,
    setBackground,
    setSharedBackground,
    setAccent,
    setGlass,
    reset,
  } = useSettings()
  const member = useCurrentMember()
  const shared = useSharedBackgrounds()
  const sharedUrl = useSharedBackgroundUrl(background === 'shared' ? sharedBackgroundId : null)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const glassPreset = matchGlassPreset(glass)
  const locked = isPhotoBackground(background)
  const isPreset = ACCENT_PRESETS.some((p) => p.value === accent)
  const commitTimer = useRef<number | undefined>(undefined)

  const onCustomColor = (value: string) => {
    window.clearTimeout(commitTimer.current)
    commitTimer.current = window.setTimeout(() => setAccent(value), CUSTOM_COMMIT_MS)
  }

  const upload = (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = ''
    if (!file) return
    setUploading(true)
    uploadSharedBackground(file)
      .then((id) => {
        setSharedBackground(id)
        pushToast({ tone: 'success', title: '배경 사진을 공유했어요' })
      })
      .catch((error: unknown) => pushToast({ tone: 'error', title: '사진을 올리지 못했어요', message: errorText(error) }))
      .finally(() => setUploading(false))
  }

  const monday = layout === 'monday'
  return (
    <>
      <ProfilePhotoCard />

      <GlassCard title="레이아웃" subtitle="보드 화면(출장업무·AS 등)의 모양이에요. 고른 모양은 이 브라우저에 저장돼요.">
        <div className="layout-options" role="radiogroup" aria-label="레이아웃">
          {LAYOUT_OPTIONS.map((option) => {
            const selected = option.value === layout
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={cx('glass-preset', 'layout-tile', selected && 'is-selected')}
                onClick={() => setLayout(option.value)}
              >
                <LayoutArt layout={option.value} />
                <span className="glass-preset__label">
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </span>
              </button>
            )
          })}
        </div>
        {monday && (
          <p className="accent-picker__note">
            <Info size={14} aria-hidden />
            Monday 표에서는 화면 전체가 Monday 모양이라 배경·강조색·유리 효과를 쓰지 않아요. 대시보드로 바꾸면 다시 고를
            수 있어요.
          </p>
        )}
      </GlassCard>

      {!monday && (
        <>
          <GlassCard
            title="배경"
            subtitle="대시보드와 로그인 화면 뒤에 깔리는 배경이에요. 고른 배경은 이 브라우저에 저장되고, 올린 사진은 팀 모두가 골라 쓸 수 있어요."
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
                onChange={(e) => upload(e.target.files?.[0])}
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

          <GlassCard
            title="강조색"
            subtitle="버튼·활성 메뉴·로고 판, 그리고 텍스처 배경의 빛에 쓰는 색이에요."
            actions={locked ? <StatusPill tone="neutral">사진 배경 — 기본색 고정</StatusPill> : null}
          >
            <div className={cx('accent-picker', locked && 'is-locked')}>
              <ul className="swatches" aria-label="강조색">
                {ACCENT_PRESETS.map((preset) => (
                  <li key={preset.value}>
                    <button
                      type="button"
                      className={cx('swatch', !locked && preset.value === accent && 'is-selected')}
                      style={{ '--swatch': preset.value } as CSSProperties}
                      aria-label={preset.label}
                      aria-pressed={preset.value === accent}
                      title={preset.label}
                      disabled={locked}
                      onClick={() => setAccent(preset.value)}
                    />
                  </li>
                ))}
                <li>
                  <label
                    className={cx('swatch', 'swatch--custom', !locked && !isPreset && 'is-selected')}
                    style={isPreset ? undefined : ({ '--swatch': accent } as CSSProperties)}
                    title="직접 고르기"
                  >
                    <input
                      type="color"
                      defaultValue={accent}
                      disabled={locked}
                      aria-label="강조색 직접 고르기"
                      onChange={(e) => onCustomColor(e.target.value)}
                    />
                    <Pipette size={14} aria-hidden />
                  </label>
                </li>
              </ul>

              {/* 지금 칠해진 강조색 미리보기 — 실제 컴포넌트와 같은 클래스(누를 수는 없게 span). */}
              <div className="accent-preview" aria-hidden>
                <BrandMark />
                <span className="button button--primary button--md">
                  <Plus size={15} strokeWidth={2.4} />
                  주요 버튼
                </span>
                <span className="accent-preview__chip">강조 배지</span>
                <code className="accent-preview__hex">{accentInUse.toUpperCase()}</code>
              </div>

              {locked && (
                <p className="accent-picker__note">
                  <Info size={14} aria-hidden />
                  사진 배경에서는 사진 색을 해치지 않게 기본 강조색(xTool 그린)을 써요. 다른 배경으로 바꾸면 고른 색이
                  다시 적용돼요.
                </p>
              )}
            </div>
          </GlassCard>

          <GlassCard
            title="유리 효과"
            subtitle="카드·사이드바·상단바·알림·로그인 카드의 유리 판이에요. 바꾸는 즉시 이 화면에도 적용돼요."
            actions={glassPreset === null ? <StatusPill tone="neutral">사용자 지정</StatusPill> : null}
          >
            <div className="glass-settings">
              <div>
                <div className="glass-presets" role="group" aria-label="유리 프리셋">
                  {GLASS_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={cx('glass-preset', glassPreset === preset.value && 'is-selected')}
                      aria-pressed={glassPreset === preset.value}
                      onClick={() => setGlass(preset.glass)}
                    >
                      {/* 줄무늬 위에 그 프리셋 값으로 칠한 유리 칩 — 흐림·농도 차이가 한눈에 보인다. */}
                      <span className="glass-preset__sample" aria-hidden>
                        <span className="glass glass-preset__chip" style={glassVars(preset.glass) as CSSProperties} />
                      </span>
                      <span className="glass-preset__label">
                        <strong>{preset.label}</strong>
                        <span>{preset.description}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="glass-sliders">
                  <RangeField
                    label="흐림"
                    hint="뒤 배경을 얼마나 뿌옇게 흐릴지"
                    value={glass.blur}
                    {...GLASS_LIMITS.blur}
                    format={(v) => `${v}px`}
                    onChange={(blur) => setGlass({ blur })}
                  />
                  <RangeField
                    label="유리 농도"
                    hint="낮을수록 투명하고, 높을수록 글이 또렷해요"
                    value={Math.round(glass.opacity * 100)}
                    min={GLASS_LIMITS.opacity.min * 100}
                    max={GLASS_LIMITS.opacity.max * 100}
                    step={1}
                    format={(v) => `${v}%`}
                    onChange={(v) => setGlass({ opacity: v / 100 })}
                  />
                  <RangeField
                    label="채도"
                    hint="비쳐 보이는 배경 색을 얼마나 진하게"
                    value={glass.saturate}
                    {...GLASS_LIMITS.saturate}
                    format={(v) => `${v}%`}
                    onChange={(saturate) => setGlass({ saturate })}
                  />
                  <RangeField
                    label="테두리 빛"
                    hint="유리 가장자리의 얇은 빛 테두리"
                    value={Math.round(glass.rim * 100)}
                    min={GLASS_LIMITS.rim.min * 100}
                    max={GLASS_LIMITS.rim.max * 100}
                    step={10}
                    format={(v) => `${v}%`}
                    onChange={(v) => setGlass({ rim: v / 100 })}
                  />
                </div>
              </div>

              {/* 지금 배경 위에 지금 유리 값으로 칠한 견본 */}
              <div className="glass-preview" aria-hidden>
                <BackgroundArt kind={background} accent={accentInUse} photoUrl={sharedUrl} />
                <div className="glass glass-preview__card">
                  <strong>미리보기</strong>
                  <p>지금 고른 배경 위에서 유리 판은 이렇게 보여요.</p>
                  <span className="button button--primary button--sm">버튼</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </>
      )}
    </>
  )
}

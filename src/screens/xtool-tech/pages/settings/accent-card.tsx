import { Info, Pipette, Plus } from 'lucide-react'
import { useRef, type CSSProperties } from 'react'
import { BrandMark } from '@/ohq-ui/brand/brand-mark'
import { StatusPill } from '@/ohq-ui/components/status-pill'
import { GlassCard } from '../../components/basic-parts'
import { cx } from '@/ohq-ui/lib/cx'
import { ACCENT_PRESETS } from '@/ohq-ui/theme/accent'
import { isPhotoBackground, useAppearance } from '@/ohq-ui/appearance/appearance'

// 직접 고르기 — 색 고르는 창을 끄는 동안 매번 배경을 다시 그리면 버벅여서, 손을 멈춘 뒤 반영한다.
const CUSTOM_COMMIT_MS = 120

/** 강조색 — 버튼·활성 메뉴·로고 판, 텍스처 배경의 빛. 사진 배경이면 기본색으로 고정된다. */
export function AccentCard() {
  const { background, accent, accentInUse, setAccent } = useAppearance()
  const locked = isPhotoBackground(background)
  const isPreset = ACCENT_PRESETS.some((p) => p.value === accent)
  const commitTimer = useRef<number | undefined>(undefined)

  const onCustomColor = (value: string) => {
    window.clearTimeout(commitTimer.current)
    commitTimer.current = window.setTimeout(() => setAccent(value), CUSTOM_COMMIT_MS)
  }

  return (
    <GlassCard
      title="강조색"
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
  )
}

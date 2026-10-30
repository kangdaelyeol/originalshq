import { Check, Info, Pipette, Plus, RotateCcw } from 'lucide-react'
import { useRef, type CSSProperties } from 'react'
import { BackgroundArt } from '../components/backgrounds/background-art'
import { BrandMark } from '../components/brand/brand-mark'
import { Button } from '../components/ui/button'
import { GlassCard } from '../components/ui/glass-card'
import { RangeField } from '../components/ui/range-field'
import { StatusPill } from '../components/ui/status-pill'
import { cx } from '../lib/cx'
import { ACCENT_PRESETS, DEFAULT_ACCENT } from '../settings/accent'
import { GLASS_LIMITS, GLASS_PRESETS, glassVars, matchGlassPreset } from '../settings/glass'
import { BACKGROUND_OPTIONS, useSettings } from '../settings/settings'

const KIND_LABEL = { default: '기본', texture: '텍스처', photo: '사진' } as const
// 직접 고르기 — 색 고르는 창을 끄는 동안 매번 배경을 다시 그리면 버벅여서, 손을 멈춘 뒤 반영한다.
const CUSTOM_COMMIT_MS = 120

export function SettingsPage() {
  const { background, accent, accentInUse, glass, setBackground, setAccent, setGlass, reset } = useSettings()
  const glassPreset = matchGlassPreset(glass)
  const locked = background === 'photo'
  const isPreset = ACCENT_PRESETS.some((p) => p.value === accent)
  const commitTimer = useRef<number | undefined>(undefined)

  const onCustomColor = (value: string) => {
    window.clearTimeout(commitTimer.current)
    commitTimer.current = window.setTimeout(() => setAccent(value), CUSTOM_COMMIT_MS)
  }

  return (
    <>
      <GlassCard
        title="배경"
        subtitle="대시보드와 로그인 화면 뒤에 깔리는 배경이에요. 이 브라우저에 저장돼요."
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
            <BackgroundArt kind={background} accent={accentInUse} />
            <div className="glass glass-preview__card">
              <strong>미리보기</strong>
              <p>지금 고른 배경 위에서 유리 판은 이렇게 보여요.</p>
              <span className="button button--primary button--sm">버튼</span>
            </div>
          </div>
        </div>
      </GlassCard>
    </>
  )
}

import type { CSSProperties } from 'react'
import { BackgroundArt } from '@/ohq-ui/backgrounds/background-art'
import { RangeField } from '@/ohq-ui/components/range-field'
import { StatusPill } from '@/ohq-ui/components/status-pill'
import { GlassCard } from '../../components/layout-parts'
import { cx } from '@/ohq-ui/lib/cx'
import { GLASS_LIMITS, GLASS_PRESETS, glassVars, matchGlassPreset } from '@/ohq-ui/theme/glass'
import { useAppearance } from '@/ohq-ui/appearance/appearance'

/**
 * 유리 효과 — 카드·사이드바·상단바 등 유리 판의 흐림·농도·채도·테두리 빛. 미리보기는 지금 배경 위에 지금 유리 값으로
 * 칠한다(공유 사진 배경이면 그 사진 주소 photoUrl — 설정 화면이 넘긴다).
 */
export function GlassEffectCard({ photoUrl }: { photoUrl: string | null }) {
  const { background, accentInUse, glass, setGlass } = useAppearance()
  const glassPreset = matchGlassPreset(glass)
  return (
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
          <BackgroundArt kind={background} accent={accentInUse} photoUrl={photoUrl} />
          <div className="glass glass-preview__card">
            <strong>미리보기</strong>
            <p>지금 고른 배경 위에서 유리 판은 이렇게 보여요.</p>
            <span className="button button--primary button--sm">버튼</span>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

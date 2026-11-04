import { Info } from 'lucide-react'
import type { CSSProperties } from 'react'
import { GlassCard } from '../../components/layout-parts'
import { cx } from '@/ohq-ui/lib/cx'
import { MONDAY_PALETTES } from '@/ohq-ui/theme/monday'
import { useAppearance } from '@/ohq-ui/appearance/appearance'
import type { ThemeName } from '@/ohq-ui/theme/theme-root'

/**
 * 보드 화면 모양 — 대시보드: 유리 판에 카드·차트(기본) · Monday 표: Monday 테마에 그룹별 표, 칸을 눌러 바로 고친다 ·
 * 물: 대시보드와 같은 배치를 D7 물 부품으로(water-layout).
 */
const LAYOUT_OPTIONS: readonly { value: ThemeName; label: string; description: string }[] = [
  { value: 'glass', label: '대시보드', description: '숫자 카드·차트와 목록 — 처음부터 쓰던 화면' },
  { value: 'monday', label: 'Monday 표', description: 'Monday처럼 그룹별 표 — 칸을 눌러 바로 고쳐요' },
  { value: 'water', label: '물', description: '밝은 유리 벽 위 물 부품 — 고르면 물처럼 미끄러져요' },
]

/** 레이아웃 견본 — 대시보드는 숫자 카드·차트, Monday 표는 색 막대가 붙은 그룹 표, 물은 유리 알약과 유리 판. */
function LayoutArt({ layout }: { layout: ThemeName }) {
  if (layout === 'water') {
    return (
      <span className="layout-art layout-art--water" aria-hidden>
        <span className="layout-art__pill">
          <i />
          <i />
          <i />
        </span>
        <span className="layout-art__glass">
          <i />
          <i />
          <i />
        </span>
      </span>
    )
  }
  if (layout === 'glass') {
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

/** 레이아웃 — 보드 화면 모양(대시보드·Monday 표·물). Monday 표면 Monday 색상도 여기서 고른다. */
export function LayoutCard() {
  const { theme, setTheme, mondayPalette, setMondayPalette } = useAppearance()
  const monday = theme === 'monday'
  const water = theme === 'water'
  return (
    <GlassCard title="레이아웃" subtitle="보드 화면(출장업무·AS 등)의 모양이에요. 고른 모양은 이 브라우저에 저장돼요.">
      <div className="layout-options" role="radiogroup" aria-label="레이아웃">
        {LAYOUT_OPTIONS.map((option) => {
          const selected = option.value === theme
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={cx('glass-preset', 'layout-tile', selected && 'is-selected')}
              onClick={() => setTheme(option.value)}
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
        <>
          <h3 className="bg-section-label">Monday 색상</h3>
          <div className="palette-options" role="radiogroup" aria-label="Monday 색상">
            {MONDAY_PALETTES.map((palette) => {
              const selected = palette.value === mondayPalette
              return (
                <button
                  key={palette.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={cx('glass-preset', 'palette-tile', selected && 'is-selected')}
                  onClick={() => setMondayPalette(palette.value)}
                >
                  {/* 견본 — 바탕 위에 칸 두 줄, 하나는 선택 색 */}
                  <span className="palette-tile__art" style={{ background: palette.swatch[0] }} aria-hidden>
                    <i style={{ background: palette.swatch[1] }} />
                    <i style={{ background: palette.swatch[2] }} />
                  </span>
                  <span className="glass-preset__label">
                    <strong>{palette.label}</strong>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
      {monday && (
        <p className="accent-picker__note">
          <Info size={14} aria-hidden />
          Monday 표에서는 화면 전체가 Monday 모양이라 배경·강조색·유리 효과를 쓰지 않아요. 대시보드로 바꾸면 다시 고를
          수 있어요.
        </p>
      )}
      {water && (
        <p className="accent-picker__note">
          <Info size={14} aria-hidden />
          물에서는 화면 전체가 밝은 유리 벽이라 배경·강조색·유리 효과를 쓰지 않아요. 대시보드로 바꾸면 다시 고를 수
          있어요.
        </p>
      )}
    </GlassCard>
  )
}

import { Info } from 'lucide-react'
import type { CSSProperties } from 'react'
import { GlassCard, SegmentedControl } from '../../components/basic-parts'
import { cx } from '@/ohq-ui/lib/cx'
import { MONDAY_PALETTES } from '@/ohq-ui/theme/monday'
import { useAppearance } from '@/ohq-ui/appearance/appearance'
import type { ThemeName } from '@/ohq-ui/theme/theme-root'
import { layoutKind, type LayoutStructure } from '../../lib/layout-kind'
import { setMondayOverviewShown, useMondayOverviewShown } from '../../lib/overview-pref'

// 레이아웃은 두 단계로 고른다(lib/layout-kind) — 구조(보드 화면의 짜임)를 고르고, 대시보드면 디자인(유리·물)을,
// Monday 표면 Monday 색상을 고른다. 저장 값은 그대로 하나(ThemeName)라 예전에 고른 값도 그대로 읽힌다.

/** 구조 — 고르면 그 구조의 첫 디자인으로(대시보드는 유리, 지금 대시보드면 디자인은 그대로). Monday 표가 기본이라 먼저. */
const STRUCTURE_OPTIONS: readonly { value: LayoutStructure; label: string; description: string }[] = [
  { value: 'table', label: 'Monday 표', description: 'Monday처럼 그룹별 표 — 칸을 눌러 바로 고쳐요' },
  { value: 'dashboard', label: '대시보드', description: '숫자 카드·차트와 목록 — 줄을 누르면 상세가 떠요' },
]

/** Monday 표의 개요 보드 — 처음엔 숨김(lib/overview-pref) */
const OVERVIEW_OPTIONS = [
  { value: 'hide', label: '숨기기' },
  { value: 'show', label: '보이기' },
] as const

/** 대시보드 디자인 — 구조는 같고 부품 모양만 다르다 */
const DESIGN_OPTIONS: readonly { value: ThemeName; label: string; description: string }[] = [
  { value: 'glass', label: '유리', description: '어두운 유리 판 — 배경·강조색·유리 효과를 고를 수 있어요' },
  { value: 'water', label: '물', description: '밝은 유리 벽 위 물 부품 — 벽 색조·강조색·깊이를 고를 수 있어요' },
]

/** 레이아웃 견본 — 유리 대시보드는 숫자 카드·차트, Monday 표는 색 막대가 붙은 그룹 표, 물은 유리 알약과 유리 판. */
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

/**
 * 레이아웃 — 구조(Monday 표·대시보드)를 고르고, 대시보드면 디자인(유리·물), Monday 표면 Monday 색상과 개요 보드를
 * 고른다. techOptions가 false면(관리 화면) tech 화면에만 쓰는 개요 보드 고르기를 뺀다.
 */
export function LayoutCard({ techOptions = true }: { techOptions?: boolean }) {
  const { theme, setTheme, mondayPalette, setMondayPalette } = useAppearance()
  const { structure, design } = layoutKind(theme)
  const monday = design === 'monday'
  const overviewShown = useMondayOverviewShown()
  const pickStructure = (next: LayoutStructure) => {
    if (next !== structure) setTheme(next === 'table' ? 'monday' : 'glass')
  }
  return (
    <GlassCard title="레이아웃">
      <h3 className="bg-section-label layout-section-label">구조</h3>
      <div className="layout-options" role="radiogroup" aria-label="구조">
        {STRUCTURE_OPTIONS.map((option) => {
          const selected = option.value === structure
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={cx('glass-preset', 'layout-tile', selected && 'is-selected')}
              onClick={() => pickStructure(option.value)}
            >
              {/* 대시보드 견본은 지금 고른 디자인 모양으로 */}
              <LayoutArt layout={option.value === 'table' ? 'monday' : monday ? 'glass' : design} />
              <span className="glass-preset__label">
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </span>
            </button>
          )
        })}
      </div>
      {!monday && (
        <>
          <h3 className="bg-section-label">디자인</h3>
          <div className="layout-options" role="radiogroup" aria-label="디자인">
            {DESIGN_OPTIONS.map((option) => {
              const selected = option.value === design
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
        </>
      )}
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
      {monday && techOptions && (
        <>
          <h3 className="bg-section-label">개요 보드</h3>
          <SegmentedControl
            ariaLabel="개요 보드"
            size="sm"
            options={OVERVIEW_OPTIONS}
            value={overviewShown ? 'show' : 'hide'}
            onChange={(next) => setMondayOverviewShown(next === 'show')}
          />
        </>
      )}
      {monday && (
        <p className="accent-picker__note">
          <Info size={14} aria-hidden />
          Monday 표에서는 화면 전체가 Monday 모양이라 배경·강조색·유리 효과를 쓰지 않아요. 대시보드의 유리 디자인으로
          바꾸면 다시 고를 수 있어요.
        </p>
      )}
    </GlassCard>
  )
}

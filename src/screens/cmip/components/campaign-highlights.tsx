import '../styles/campaign-highlights.scss'
import { useState, type CSSProperties } from 'react'
import { Info } from 'lucide-react'
import { Segmented } from '@/components/glass'
import type {
  CampaignHighlightGroup,
  CampaignHighlightLevel,
  CampaignHighlightMetric,
  CampaignHighlightRow,
  CampaignHighlights,
} from '../client'
import { SegmentedToggle } from './segmented-toggle'

const LEVEL_OPTIONS: { value: CampaignHighlightLevel; label: string }[] = [
  { value: 'campaign', label: '캠페인' },
  { value: 'adset', label: '광고셋' },
]

type Side = 'low' | 'high'

// 지표마다 타일 하나 — 양쪽 끝 중 한쪽 TOP 5를 골라 본다(처음엔 먼저 볼
// 쪽: 광고비는 많은 쪽, 단가는 싼 쪽).
const TILES: {
  key: CampaignHighlightMetric
  title: string
  desc: (level: string) => string
  sides: Record<Side, string>
  first: Side
}[] = [
  {
    key: 'spend',
    title: '광고비',
    desc: (level) => `광고비를 쓴 ${level} · 전체 대비 비중`,
    sides: { high: '많은 순', low: '적은 순' },
    first: 'high',
  },
  {
    key: 'cpa',
    title: '문의 단가',
    desc: (level) => `전환 목표가 문의인 Meta ${level} · 문의 3건 이상`,
    sides: { low: '낮은 순', high: '높은 순' },
    first: 'low',
  },
  {
    key: 'cpc',
    title: 'CPC',
    desc: () => '전체 매체 · 클릭 50회 이상',
    sides: { low: '낮은 순', high: '높은 순' },
    first: 'low',
  },
  {
    key: 'cpm',
    title: 'CPM',
    desc: () => '전체 매체 · 노출 1,000회 이상',
    sides: { low: '낮은 순', high: '높은 순' },
    first: 'low',
  },
]

const won = (v: number) => `${Math.round(v).toLocaleString()}원`

// 띠 위에서 포인터와 이만큼(px) 안의 가장 가까운 점·중앙값을 잡는다 — 점이
// 작고 겹쳐서 점마다 따로 마우스를 대기 어렵다.
const HIT_PX = 14

type StripHover =
  | { kind: 'dot'; index: number; x: number }
  | { kind: 'median'; x: number }
  | null

/**
 * 분포 띠 — 매긴 항목 전부를 점으로(로그 눈금: 광고비처럼 수십 배씩 벌어지는
 * 값도 한 줄에 퍼지게). 아래 TOP 5는 진하게, 중앙값은 세로 금. 점·금에 마우스를
 * 올리면 무엇인지 떠 있는 판으로 자세히(이름·값·순위·중앙값 대비), 점을 누르면
 * 아래 목록의 그 항목으로 간다.
 */
const Strip = ({
  group,
  shown,
  side,
  sideLabel,
  levelLabel,
  onFocus,
}: {
  group: CampaignHighlightGroup
  shown: readonly CampaignHighlightRow[]
  side: Side
  sideLabel: string
  levelLabel: string
  onFocus: (row: CampaignHighlightRow) => void
}) => {
  const [hover, setHover] = useState<StripHover>(null)
  const { all, values, median } = group
  const min = values[0]
  const max = values[values.length - 1]
  const lo = Math.log(Math.max(min, 1e-9))
  const span = Math.log(Math.max(max, 1e-9)) - lo
  const ratio = (v: number) =>
    span > 0 ? (Math.log(Math.max(v, 1e-9)) - lo) / span : 0.5
  const at = (v: number) => `${ratio(v) * 100}%`
  const shownKeys = new Set(shown.map((row) => row.selectKey))

  const pick = (clientX: number, rect: DOMRect): StripHover => {
    const x = clientX - rect.left
    let best = -1
    let bestGap = Infinity
    all.forEach((row, index) => {
      const gap = Math.abs(ratio(row.amount) * rect.width - x)
      if (gap < bestGap) {
        best = index
        bestGap = gap
      }
    })
    const medianGap = Math.abs(ratio(median) * rect.width - x)
    if (medianGap <= 4 && medianGap <= bestGap) {
      return { kind: 'median', x: ratio(median) * 100 }
    }
    return best >= 0 && bestGap <= HIT_PX
      ? { kind: 'dot', index: best, x: ratio(all[best].amount) * 100 }
      : null
  }

  const hovered = hover?.kind === 'dot' ? all[hover.index] : null
  // 순위 — 지금 고른 쪽(많은 순·낮은 순 등) 기준.
  const rankOf = (index: number) =>
    side === 'high' ? all.length - index : index + 1
  const vsMedian = (v: number) => {
    if (median <= 0) return '-'
    const diff = ((v - median) / median) * 100
    if (Math.abs(diff) < 0.5) return '중앙값과 같음'
    return `중앙값보다 ${Math.abs(diff).toFixed(0)}% ${diff > 0 ? '높음' : '낮음'}`
  }

  return (
    <div className="hl-strip">
      <div
        className={`hl-strip__plot${hover ? ' is-hover' : ''}`}
        role="img"
        aria-label={`${levelLabel} ${values.length}개의 분포 — 최소 ${won(min)}, 중앙 ${won(median)}, 최대 ${won(max)}`}
        onMouseMove={(event) =>
          setHover(
            pick(event.clientX, event.currentTarget.getBoundingClientRect()),
          )
        }
        onMouseLeave={() => setHover(null)}
        onClick={() => hovered && onFocus(hovered)}
      >
        {all.map((row, i) => (
          <i
            key={row.selectKey}
            className={`${shownKeys.has(row.selectKey) ? 'is-shown' : ''}${
              hover?.kind === 'dot' && hover.index === i ? ' is-hover' : ''
            }`}
            // 겹치지 않게 위아래로 조금씩(진한 점은 가운데).
            style={{
              left: at(row.amount),
              top: shownKeys.has(row.selectKey)
                ? '50%'
                : `${50 + ((i % 3) - 1) * 22}%`,
            }}
          />
        ))}
        <span
          className={`hl-strip__median${hover?.kind === 'median' ? ' is-hover' : ''}`}
          style={{ left: at(median) }}
        />
      </div>

      {hover && (
        <div
          className={`hl-pop${hover.x > 70 ? ' is-right' : hover.x < 30 ? ' is-left' : ''}`}
          style={{ left: `${hover.x}%` }}
          role="tooltip"
        >
          {hovered && hover.kind === 'dot' ? (
            <>
              <strong className="hl-pop__title">{hovered.name}</strong>
              <span className="hl-pop__sub">{hovered.sub}</span>
              <dl className="hl-pop__facts">
                <div>
                  <dt>값</dt>
                  <dd>{hovered.value}</dd>
                </div>
                <div>
                  <dt>순위</dt>
                  <dd>
                    {sideLabel} {rankOf(hover.index)}위 / {all.length}개
                  </dd>
                </div>
                <div>
                  <dt>비교</dt>
                  <dd>{vsMedian(hovered.amount)}</dd>
                </div>
                {hovered.note && (
                  <div>
                    <dt>참고</dt>
                    <dd>{hovered.note}</dd>
                  </div>
                )}
              </dl>
              <span className="hl-pop__hint">
                {shownKeys.has(hovered.selectKey) ? '아래 TOP 5에 있음 · ' : ''}
                누르면 아래 목록에서 보기
              </span>
            </>
          ) : (
            <>
              <strong className="hl-pop__title">중앙값 {won(median)}</strong>
              <span className="hl-pop__sub">
                {levelLabel} {values.length}개를 값 순으로 세웠을 때 가운데 값
              </span>
              <span className="hl-pop__hint">
                왼쪽 점은 이보다 낮고, 오른쪽 점은 이보다 높습니다
              </span>
            </>
          )}
        </div>
      )}

      <div className="hl-strip__scale">
        <span>{won(min)}</span>
        <span className="hl-strip__center">
          중앙 <b>{won(median)}</b> · {values.length}개
          <span className="hl-strip__help" tabIndex={0} aria-label="띠 읽는 법">
            <Info strokeWidth={2} aria-hidden="true" />
            <span className="hl-strip__help-text" role="tooltip">
              점 하나가 {levelLabel} 하나입니다. 오른쪽일수록 값이 크고(로그
              눈금 — 몇 배씩 차이 나는 값도 한 줄에 보이게), 진한 점은 아래 TOP
              5, 세로 금은 중앙값입니다. 점에 마우스를 올리면 자세히, 누르면
              아래 목록에서 봅니다.
            </span>
          </span>
        </span>
        <span>{won(max)}</span>
      </div>
    </div>
  )
}

const Tile = ({
  tile,
  group,
  levelLabel,
  onFocus,
  order,
}: {
  tile: (typeof TILES)[number]
  group: CampaignHighlightGroup
  levelLabel: string
  onFocus: (row: CampaignHighlightRow) => void
  order: number
}) => {
  const [side, setSide] = useState<Side>(tile.first)
  const rows = group[side]
  const top = Math.max(0, ...rows.map((row) => row.amount))

  return (
    <article
      className="hl-tile"
      style={{ '--glass-i': order } as CSSProperties}
    >
      <header className="hl-tile__head">
        <div className="hl-tile__titles">
          <h4>{tile.title}</h4>
          <span>{tile.desc(levelLabel)}</span>
        </div>
        <Segmented
          options={tile.sides}
          value={side}
          onChange={setSide}
          label={`${tile.title} 순서`}
          role="buttons"
        />
      </header>

      {group.values.length === 0 ? (
        <p className="hl-tile__empty">해당하는 항목이 없습니다.</p>
      ) : (
        <>
          <Strip
            group={group}
            shown={rows}
            side={side}
            sideLabel={tile.sides[side]}
            levelLabel={levelLabel}
            onFocus={onFocus}
          />
          <ol className="hl-tile__list">
            {rows.map((row, index) => (
              <li key={row.selectKey}>
                <button
                  type="button"
                  className="hl-row"
                  title={`${row.name}\n${row.sub}`}
                  onClick={() => onFocus(row)}
                  style={{ '--glass-i': index } as CSSProperties}
                >
                  <span className="hl-row__name">{row.name}</span>
                  <span className="hl-row__track">
                    <i
                      style={{
                        width: `${top > 0 ? (row.amount / top) * 100 : 0}%`,
                      }}
                    />
                  </span>
                  <span className="hl-row__value">{row.value}</span>
                  <span className="hl-row__note">{row.note}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </article>
  )
}

/**
 * 캠페인·광고셋 탭 맨 위의 요약 — 캠페인/광고셋 단위를 골라, 지표 네 개
 * (광고비·문의 단가·CPC·CPM)마다 타일 하나: 전체 분포 띠와, 한쪽 끝 TOP 5를
 * 막대로. 항목을 누르면 아래 목록에서 그 줄을 체크하고(광고셋이면 캠페인을
 * 펼치고) 그 줄로 스크롤한다 — 줄은 잠깐 반짝이고, 비교 표에도 바로 들어간다.
 */
export function CampaignHighlightCards({
  highlights,
  level,
  onLevelChange,
  onFocus,
}: {
  highlights: CampaignHighlights
  level: CampaignHighlightLevel
  onLevelChange: (level: CampaignHighlightLevel) => void
  onFocus: (row: CampaignHighlightRow) => void
}) {
  const levelLabel = level === 'campaign' ? '캠페인' : '광고셋'
  const focus = (row: CampaignHighlightRow) => {
    onFocus(row)
    // 펼친 줄이 그려진 다음에 찾는다.
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-select-key="${CSS.escape(row.selectKey)}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }

  return (
    <section className="channel-insight__section campaign-highlights">
      <div className="channel-insight__section-head">
        <h3 className="channel-insight__section-title">요약</h3>
        <SegmentedToggle<CampaignHighlightLevel>
          label="단위"
          options={LEVEL_OPTIONS}
          value={level}
          onChange={onLevelChange}
        />
      </div>
      <div className="campaign-highlights__tiles">
        {TILES.map((tile, index) => (
          <Tile
            key={tile.key}
            tile={tile}
            group={highlights[tile.key]}
            levelLabel={levelLabel}
            onFocus={focus}
            order={index}
          />
        ))}
      </div>
    </section>
  )
}

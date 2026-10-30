import '../styles/campaign-highlights.scss'
import { useState, type CSSProperties } from 'react'
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

/**
 * 분포 띠 — 매긴 값 전부를 점으로(로그 눈금: 광고비처럼 수십 배씩 벌어지는
 * 값도 한 줄에 퍼지게). 아래 TOP 5는 진하게, 중앙값은 세로 금.
 */
const Strip = ({
  group,
  shown,
}: {
  group: CampaignHighlightGroup
  shown: readonly CampaignHighlightRow[]
}) => {
  const { values, median } = group
  const min = values[0]
  const max = values[values.length - 1]
  const lo = Math.log(Math.max(min, 1e-9))
  const span = Math.log(Math.max(max, 1e-9)) - lo
  const at = (v: number) =>
    `${span > 0 ? ((Math.log(Math.max(v, 1e-9)) - lo) / span) * 100 : 50}%`

  return (
    <div className="hl-strip">
      <div className="hl-strip__plot" aria-hidden="true">
        {values.map((v, i) => (
          <i
            key={i}
            // 겹치지 않게 위아래로 조금씩.
            style={{ left: at(v), top: `${50 + ((i % 3) - 1) * 22}%` }}
          />
        ))}
        <span className="hl-strip__median" style={{ left: at(median) }} />
        {shown.map((row) => (
          <i
            key={row.selectKey}
            className="is-shown"
            style={{ left: at(row.amount) }}
          />
        ))}
      </div>
      <div className="hl-strip__scale">
        <span>{won(min)}</span>
        <span>
          중앙 <b>{won(median)}</b> · {values.length}개
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
          <Strip group={group} shown={rows} />
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

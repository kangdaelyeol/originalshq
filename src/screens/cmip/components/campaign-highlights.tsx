import type {
  CampaignHighlightKey,
  CampaignHighlightLevel,
  CampaignHighlightRow,
  CampaignHighlights,
} from '../client'
import { SegmentedToggle } from './segmented-toggle'

const LEVEL_OPTIONS: { value: CampaignHighlightLevel; label: string }[] = [
  { value: 'campaign', label: '캠페인' },
  { value: 'adset', label: '광고셋' },
]

// 지표마다 양쪽 끝 두 카드를 한 묶음으로 — 묶음 이름을 위에 붙인다.
const GROUPS: {
  title: string
  desc: (level: string) => string
  cards: { key: CampaignHighlightKey; title: string }[]
}[] = [
  {
    title: '광고비 요약',
    desc: (level) => `광고비를 쓴 ${level} · 전체 대비 비중`,
    cards: [
      { key: 'spendHigh', title: '많은 TOP 5' },
      { key: 'spendLow', title: '적은 TOP 5' },
    ],
  },
  {
    title: '문의 단가',
    desc: (level) => `전환 목표가 문의인 Meta ${level} · 문의 3건 이상`,
    cards: [
      { key: 'cpaLow', title: '낮은 TOP 5' },
      { key: 'cpaHigh', title: '높은 TOP 5' },
    ],
  },
  {
    title: 'CPC',
    desc: () => '전체 매체 · 클릭 50회 이상',
    cards: [
      { key: 'cpcLow', title: '낮은 TOP 5' },
      { key: 'cpcHigh', title: '높은 TOP 5' },
    ],
  },
  {
    title: 'CPM',
    desc: () => '전체 매체 · 노출 1,000회 이상',
    cards: [
      { key: 'cpmLow', title: '낮은 TOP 5' },
      { key: 'cpmHigh', title: '높은 TOP 5' },
    ],
  },
]

const HighlightList = ({
  rows,
  onFocus,
}: {
  rows: CampaignHighlightRow[]
  onFocus: (row: CampaignHighlightRow) => void
}) =>
  rows.length === 0 ? (
    <p className="campaign-highlights__empty">해당하는 항목이 없습니다.</p>
  ) : (
    <ol className="campaign-highlights__list">
      {rows.map((row, index) => (
        <li key={row.selectKey}>
          <span className="campaign-highlights__rank">{index + 1}</span>
          <button
            type="button"
            className="campaign-highlights__who"
            title={`${row.name}\n${row.sub}`}
            onClick={() => onFocus(row)}
          >
            <span className="campaign-highlights__name">{row.name}</span>
            <span className="campaign-highlights__note">{row.sub}</span>
          </button>
          <span className="campaign-highlights__value">
            {row.value}
            <span className="campaign-highlights__note">{row.note}</span>
          </span>
        </li>
      ))}
    </ol>
  )

/**
 * 캠페인·광고셋 탭 맨 위의 요약 — 캠페인/광고셋 단위를 골라, 지표 네 묶음
 * (광고비·문의 단가·클릭 단가·CPM)마다 양쪽 끝 TOP 5를 보여 준다. 항목을
 * 누르면 아래 목록에서 그 줄을 체크하고(광고셋이면 캠페인을 펼치고) 그 줄로
 * 스크롤한다 — 줄은 잠깐 반짝이고, 비교 표에도 바로 들어간다.
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
      <div className="campaign-highlights__groups">
        {GROUPS.map((group) => (
          <div key={group.title} className="campaign-highlights__group">
            <div className="campaign-highlights__group-head">
              <h4 className="campaign-highlights__group-title">
                {group.title}
              </h4>
              <span className="campaign-highlights__desc">
                {group.desc(levelLabel)}
              </span>
            </div>
            <div className="campaign-highlights__cards">
              {group.cards.map((card) => (
                <div key={card.key} className="campaign-highlights__card">
                  <h5 className="campaign-highlights__title">{card.title}</h5>
                  <HighlightList rows={highlights[card.key]} onFocus={focus} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

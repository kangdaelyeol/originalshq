import type {
  CampaignHighlightKey,
  CampaignHighlightRow,
  CampaignHighlights,
} from '../client'

const INQUIRY = '전환 목표가 문의인 Meta 광고셋 · 문의 3건 이상'
const CLICKS = '전체 매체 · 클릭 50회 이상'
const IMPRESSIONS = '전체 매체 · 노출 1,000회 이상'

// 짝(많은/적은, 낮은/높은)끼리 나란히 — 한 줄에 네 개씩 두 줄.
const CARDS: {
  key: CampaignHighlightKey
  title: string
  desc: string
}[] = [
  {
    key: 'spendHigh',
    title: '광고비 많은 TOP 5',
    desc: '광고비 · 전체 대비 비중',
  },
  {
    key: 'spendLow',
    title: '광고비 적은 TOP 5',
    desc: '광고비를 쓴 광고셋 중',
  },
  { key: 'cpaLow', title: '문의 단가 낮은 TOP 5', desc: INQUIRY },
  { key: 'cpaHigh', title: '문의 단가 높은 TOP 5', desc: INQUIRY },
  { key: 'cpcLow', title: '클릭 단가 낮은 TOP 5', desc: CLICKS },
  { key: 'cpcHigh', title: '클릭 단가 높은 TOP 5', desc: CLICKS },
  { key: 'cpmLow', title: 'CPM 낮은 TOP 5', desc: IMPRESSIONS },
  { key: 'cpmHigh', title: 'CPM 높은 TOP 5', desc: IMPRESSIONS },
]

/**
 * 캠페인·광고셋 탭 맨 위의 요약 카드 여덟 개(광고셋 단위). 광고셋을 누르면 아래
 * 목록에서 그 캠페인을 펼치고 광고셋을 체크한 뒤 그 줄로 스크롤한다 — 비교
 * 표에도 바로 들어간다.
 */
export function CampaignHighlightCards({
  highlights,
  onFocus,
}: {
  highlights: CampaignHighlights
  onFocus: (campaignName: string, adsetName: string) => void
}) {
  const focus = (row: CampaignHighlightRow) => {
    onFocus(row.campaignName, row.adsetName)
    // 펼친 줄이 그려진 다음에 찾는다.
    requestAnimationFrame(() => {
      const key = `a:${row.campaignName}::${row.adsetName}`
      document
        .querySelector(`[data-select-key="${CSS.escape(key)}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }

  return (
    <div className="campaign-highlights">
      {CARDS.map((card) => {
        const rows = highlights[card.key]
        return (
          <section key={card.key} className="campaign-highlights__card">
            <h3 className="campaign-highlights__title">{card.title}</h3>
            <p className="campaign-highlights__desc">{card.desc}</p>
            {rows.length === 0 ? (
              <p className="campaign-highlights__empty">
                해당하는 광고셋이 없습니다.
              </p>
            ) : (
              <ol className="campaign-highlights__list">
                {rows.map((row, index) => (
                  <li key={`${row.campaignName}::${row.adsetName}`}>
                    <span className="campaign-highlights__rank">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      className="campaign-highlights__who"
                      title={`${row.adsetName}\n${row.campaignName}`}
                      onClick={() => focus(row)}
                    >
                      <span className="campaign-highlights__name">
                        {row.adsetName}
                      </span>
                      <span className="campaign-highlights__note">
                        {row.campaignName}
                      </span>
                    </button>
                    <span className="campaign-highlights__value">
                      {row.value}
                      <span className="campaign-highlights__note">
                        {row.note}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )
      })}
    </div>
  )
}

import type { CampaignHighlightRow, CampaignHighlights } from '../client'

const CARDS: {
  key: keyof CampaignHighlights
  title: string
  desc: string
  empty: string
}[] = [
  {
    key: 'topSpend',
    title: '광고비 TOP 5',
    desc: '조회 기간 광고비 · 전체 대비 비중',
    empty: '광고비를 쓴 광고셋이 없습니다.',
  },
  {
    key: 'lowestCpa',
    title: '문의 단가 낮은 TOP 5',
    desc: '전환 목표가 문의인 Meta 광고셋 · 문의 3건 이상',
    empty: '문의 3건 이상인 광고셋이 없습니다.',
  },
  {
    key: 'lowestCpc',
    title: '클릭 단가 낮은 TOP 5',
    desc: '전체 매체 · 클릭 50회 이상',
    empty: '클릭 50회 이상인 광고셋이 없습니다.',
  },
  {
    key: 'noInquirySpend',
    title: '문의 없이 광고비만 쓴 TOP 5',
    desc: '전환 목표가 문의인데 문의 0건',
    empty: '해당하는 광고셋이 없습니다.',
  },
]

/**
 * 캠페인·광고셋 탭 맨 위의 요약 카드 네 개(광고셋 단위). 광고셋을 누르면 아래
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
              <p className="campaign-highlights__empty">{card.empty}</p>
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

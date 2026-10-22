import type {
  MondayHighlightRow,
  MondayHighlights as MondayHighlightsData,
} from '@/screens/xtool-lead-manager/utils'

const CARDS: {
  key: keyof MondayHighlightsData
  title: string
  desc: string
  empty: string
}[] = [
  {
    key: 'topBuyers',
    title: '이번 달 구매왕',
    desc: '이번 달 결제한 구매 금액 합계',
    empty: '이번 달 구매가 아직 없습니다.',
  },
  {
    key: 'topBalances',
    title: '잔금 TOP',
    desc: '아직 받지 못한 잔금',
    empty: '남은 잔금이 없습니다.',
  },
  {
    key: 'fastestBuyers',
    title: '가장 빨리 산 고객',
    desc: '이번 달 첫 구매 · 첫 문의부터 걸린 날',
    empty: '이번 달 문의 후 첫 구매한 고객이 없습니다.',
  },
  {
    key: 'pondering',
    title: '오래 고민 중인 고객',
    desc: '구매 없이 상담 2회 이상 · 미전환 제외',
    empty: '해당하는 고객이 없습니다.',
  },
]

const HighlightList = ({
  rows,
  empty,
  onOpen,
}: {
  rows: MondayHighlightRow[]
  empty: string
  onOpen: (phone: string) => void
}) =>
  rows.length === 0 ? (
    <p className="monday_highlight_empty">{empty}</p>
  ) : (
    <ol className="monday_highlight_list">
      {rows.map((row, index) => (
        <li key={row.phone}>
          <span className="monday_highlight_rank">{index + 1}</span>
          <button
            type="button"
            className="monday_highlight_who"
            onClick={() => onOpen(row.phone)}
          >
            <span className="monday_highlight_name">{row.name}</span>
            <span className="monday_highlight_note">{row.note}</span>
          </button>
          <span className="monday_highlight_value">{row.value}</span>
        </li>
      ))}
    </ol>
  )

/** Monday 고객 표 아래의 요약 카드 네 개 — 이름을 누르면 고객 상세가 열린다. */
export const MondayHighlights = ({
  highlights,
  onOpen,
}: {
  highlights: MondayHighlightsData
  onOpen: (phone: string) => void
}) => (
  <div className="monday_highlights">
    {CARDS.map((card) => (
      <section key={card.key} className="monday_highlight">
        <h2>{card.title}</h2>
        <p className="monday_highlight_desc">{card.desc}</p>
        <HighlightList
          rows={highlights[card.key]}
          empty={card.empty}
          onOpen={onOpen}
        />
      </section>
    ))}
  </div>
)

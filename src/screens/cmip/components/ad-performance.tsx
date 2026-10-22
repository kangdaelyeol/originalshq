import type { AdPerformanceNode, AttributionRow } from '../client'
import type { ISODate } from '../types'
import { useAdPerformanceViewModel } from '../view-model/use-ad-performance-view-model'

const won = (v: number): string => `${Math.round(v).toLocaleString()}원`
/** 사람 수 — 같은 이름의 광고가 여럿이라 나눠 가진 경우만 소수 한 자리. */
const people = (v: number): string =>
  Math.abs(v - Math.round(v)) < 0.05
    ? `${Math.round(v).toLocaleString()}명`
    : `${v.toFixed(1)}명`
const pct = (v: number): string =>
  Number.isFinite(v)
    ? `${v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : '-'
const roasOf = (n: { revenue: number; spend: number }) =>
  n.spend > 0 ? (n.revenue / n.spend) * 100 : NaN
const costPer = (spend: number, count: number) =>
  count > 0 ? won(spend / count) : '-'

const LEVEL_LABEL = ['캠페인', '광고셋', '광고'] as const

const MetricCells = ({ node }: { node: AdPerformanceNode }) => (
  <>
    <td>{won(node.spend)}</td>
    <td>{people(node.leads)}</td>
    <td>{costPer(node.spend, node.leads)}</td>
    <td>{people(node.buyers)}</td>
    <td>{node.leads > 0 ? pct((node.buyers / node.leads) * 100) : '-'}</td>
    <td>{won(node.revenue)}</td>
    <td>{pct(roasOf(node))}</td>
  </>
)

const NodeRows = ({
  node,
  level,
  expanded,
  toggle,
}: {
  node: AdPerformanceNode
  level: 0 | 1 | 2
  expanded: ReadonlySet<string>
  toggle: (id: string) => void
}) => {
  const open = expanded.has(node.id)
  const canOpen = level < 2 && node.children.length > 0
  return (
    <>
      <tr
        className={`ad-performance__row ad-performance__row--${LEVEL_LABEL[level]}${
          canOpen ? ' channel-insight__table-row--clickable' : ''
        }`}
        onClick={canOpen ? () => toggle(node.id) : undefined}
      >
        <td
          className="ad-performance__name"
          style={{ paddingLeft: 10 + level * 18 }}
          title={node.name}
        >
          {canOpen ? (
            <button
              type="button"
              className="ad-performance__toggle"
              aria-expanded={open}
              aria-label={`${node.name} ${open ? '접기' : '펼치기'}`}
              onClick={(event) => {
                event.stopPropagation()
                toggle(node.id)
              }}
            >
              {open ? '▾' : '▸'}
            </button>
          ) : (
            <span className="ad-performance__toggle-space" />
          )}
          <span className="ad-performance__level">{LEVEL_LABEL[level]}</span>
          {node.name}
        </td>
        <MetricCells node={node} />
      </tr>
      {open &&
        node.children.map((child) => (
          <NodeRows
            key={child.id}
            node={child}
            level={(level + 1) as 1 | 2}
            expanded={expanded}
            toggle={toggle}
          />
        ))}
    </>
  )
}

/**
 * 광고 성과 탭 — Monday 상담의 utm_campaign(Meta 광고 이름)으로 고객을 Meta
 * 광고에 잇고, 캠페인 → 광고셋 → 광고별로 광고비·문의·구매·귀속 매출을
 * 보여 준다. 귀속 규칙은 ROAS 탭의 하한과 같다.
 */
export function AdPerformancePanel({
  attribution,
  dateStart,
  dateEnd,
}: {
  attribution: AttributionRow[] | null
  dateStart: ISODate
  dateEnd: ISODate
}) {
  const {
    status,
    error,
    attributionMissing,
    performance,
    expanded,
    toggle,
    showUnmatched,
    setShowUnmatched,
  } = useAdPerformanceViewModel(attribution, dateStart, dateEnd)

  if (attributionMissing || status === 'error') {
    return (
      <section className="channel-insight__section">
        <p className="channel-insight__result-empty">
          {attributionMissing
            ? '고객 유입 경로 데이터를 불러오지 못했습니다.'
            : `Meta 광고 단위 데이터를 불러오지 못했습니다 — ${error}`}
        </p>
      </section>
    )
  }
  if (!performance) {
    return (
      <section className="channel-insight__section">
        <p className="channel-insight__result-empty">불러오는 중…</p>
      </section>
    )
  }

  const { total, campaigns, unmatched, unmatchedTotal } = performance
  const allRevenue = total.revenue + unmatchedTotal.revenue

  return (
    <>
      <section className="channel-insight__section">
        <div className="channel-insight__section-head">
          <h3 className="channel-insight__section-title">Meta 광고 성과</h3>
        </div>
        <div className="channel-insight__summary-grid roas-attribution__tiles">
          <div className="channel-insight__kpi">
            <span className="channel-insight__kpi-label">광고비</span>
            <span className="channel-insight__kpi-value">
              {won(total.spend)}
            </span>
          </div>
          <div className="channel-insight__kpi">
            <span className="channel-insight__kpi-label">문의 고객</span>
            <span className="channel-insight__kpi-value">
              {people(total.leads)}
            </span>
          </div>
          <div className="channel-insight__kpi">
            <span className="channel-insight__kpi-label">구매 고객</span>
            <span className="channel-insight__kpi-value">
              {people(total.buyers)}
            </span>
          </div>
          <div className="channel-insight__kpi">
            <span className="channel-insight__kpi-label">귀속 매출</span>
            <span className="channel-insight__kpi-value">
              {won(total.revenue)}
            </span>
          </div>
          <div className="channel-insight__kpi">
            <span className="channel-insight__kpi-label">광고 ROAS</span>
            <span className="channel-insight__kpi-value">
              {pct(roasOf(total))}
            </span>
          </div>
        </div>
        <p className="roas-attribution__note">
          * 문의 고객 = 조회 기간에 Meta UTM 상담이 접수된 고객 · 구매 고객·귀속
          매출 = UTM 상담 접수일부터 90일 안의 첫 구매 중 결제일이 조회 기간인
          것 (ROAS 탭 하한과 같은 기준)
          <br />* 상담의 utm_campaign(광고 이름)으로 광고를 찾고, 같은 이름의
          광고가 여러 광고셋에 있으면 상담일 광고비 비율로 나눕니다 (그래서 사람
          수가 소수일 수 있습니다)
          <br />* 최근 문의는 아직 90일이 지나지 않아 구매가 덜 잡혀 있습니다
        </p>
        <div className="channel-insight__table-wrap">
          <table className="channel-insight__table channel-insight__table--roas ad-performance__table">
            <thead>
              <tr>
                <th>캠페인 / 광고셋 / 광고</th>
                <th>광고비</th>
                <th>문의</th>
                <th>문의당 비용</th>
                <th>구매</th>
                <th>구매 전환율</th>
                <th>귀속 매출</th>
                <th>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <NodeRows
                  key={campaign.id}
                  node={campaign}
                  level={0}
                  expanded={expanded}
                  toggle={toggle}
                />
              ))}
              <tr className="roas-attribution__subtotal">
                <td className="ad-performance__name">합계</td>
                <MetricCells
                  node={{ id: 'total', name: '합계', children: [], ...total }}
                />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="channel-insight__section">
        <div className="channel-insight__section-head">
          <h3 className="channel-insight__section-title">
            광고를 찾지 못한 utm_campaign
          </h3>
          <button
            type="button"
            className="channel-insight__btn channel-insight__ghost"
            onClick={() => setShowUnmatched(!showUnmatched)}
          >
            {showUnmatched ? '접기' : `${unmatched.length}개 보기`}
          </button>
        </div>
        <p className="roas-attribution__note">
          Meta UTM 고객 중 utm_campaign이 Meta 광고 이름과 맞지 않는 경우 — 문의{' '}
          {people(unmatchedTotal.leads)}, 구매 {people(unmatchedTotal.buyers)},
          매출 {won(unmatchedTotal.revenue)}
          {allRevenue > 0 &&
            ` (Meta 귀속 매출의 ${((unmatchedTotal.revenue / allRevenue) * 100).toFixed(1)}%)`}
          . 광고 이름이 바뀌었거나, 수집 기간 밖에서만 돈 광고이거나, utm에 다른
          값이 들어간 경우입니다.
        </p>
        {showUnmatched && unmatched.length > 0 && (
          <div className="channel-insight__table-wrap">
            <table className="channel-insight__table channel-insight__table--roas ad-performance__table">
              <thead>
                <tr>
                  <th>utm_campaign</th>
                  <th>문의</th>
                  <th>구매</th>
                  <th>매출</th>
                </tr>
              </thead>
              <tbody>
                {unmatched.map((row) => (
                  <tr key={row.utmCampaign}>
                    <td className="ad-performance__name">{row.utmCampaign}</td>
                    <td>{people(row.leads)}</td>
                    <td>{people(row.buyers)}</td>
                    <td>{won(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

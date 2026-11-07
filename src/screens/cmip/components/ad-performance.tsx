import type { CSSProperties } from 'react'
import {
  LEAD_COHORT_WINDOWS,
  type AdPerformanceDay,
  type AdPerformanceMetrics,
  type AdPerformanceNode,
  type AttributionRow,
  type LeadCohortRow,
  type PurchaseScope,
} from '../client'
import { trendSeriesOf } from '../utils/trend-series'
import type { ISODate } from '../types'
import {
  LEAD_COHORT_MONTHS,
  PURCHASE_SCOPE_LABEL,
  useAdPerformanceViewModel,
  type AdPerformanceDisplay,
} from '../view-model/use-ad-performance-view-model'
import {
  LoadingPanel,
  Segmented,
  Sparkline,
  TrendGrid,
} from '@/components/glass'
import { AdEfficiency, type EfficiencySort } from './ad-efficiency'

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
/** 상담 건수 — 사람 수처럼 나눠 가진 경우만 소수 한 자리. */
const cases = (v: number): string =>
  Math.abs(v - Math.round(v)) < 0.05
    ? `${Math.round(v).toLocaleString()}건`
    : `${v.toFixed(1)}건`
const roasOf = (n: { revenue: number; spend: number }) =>
  n.spend > 0 ? (n.revenue / n.spend) * 100 : NaN
const costPer = (spend: number, count: number) =>
  count > 0 ? won(spend / count) : '-'
const rateOf = (part: number, whole: number) =>
  whole > 0 ? (part / whole) * 100 : NaN

// 기준선(주간 매체 성과표 원문) — 넘으면 경고 색으로.
const COST_PER_LEAD_LIMIT = 130_000
const MISENTRY_RATE_LIMIT = 30
const overClass = (over: boolean) => (over ? 'ad-performance__over' : undefined)

/** 표의 숫자 칸이 무엇을 받았는지 — 오기입률 재료(따로 받는다), 방문체험
 * 예약일·범위별 첫 결제일이 든 데이터인지, 결제 전환의 구매 범위. */
interface MetricView {
  quality: 'loading' | 'ready' | 'error'
  outcomesReady: boolean
  scope: PurchaseScope
}

const sumOf = (
  days: readonly AdPerformanceDay[],
  key: 'spend' | 'leads' | 'buyers' | 'revenue',
) => days.reduce((sum, day) => sum + day[key], 0)

const LEVEL_LABEL = ['캠페인', '광고셋', '광고'] as const

const DISPLAY_LABEL: Record<AdPerformanceDisplay, string> = {
  chart: '그래프',
  table: '표',
}
const SORT_LABEL: Record<EfficiencySort, string> = {
  spend: '광고비',
  roas: 'ROAS',
  revenue: '매출',
}

const MetricCells = ({
  node,
  view,
}: {
  node: AdPerformanceMetrics
  view: MetricView
}) => {
  const misentryRate = rateOf(node.misentry, node.decided)
  // 통합은 예전 데이터(구매 날짜)로도 셀 수 있다.
  const conversionReady = view.scope === 'all' || view.outcomesReady
  return (
    <>
      <td>{won(node.spend)}</td>
      <td>{people(node.leads)}</td>
      <td
        className={overClass(
          node.leads > 0 && node.spend / node.leads > COST_PER_LEAD_LIMIT,
        )}
      >
        {costPer(node.spend, node.leads)}
      </td>
      <td
        className={overClass(
          view.quality === 'ready' && misentryRate > MISENTRY_RATE_LIMIT,
        )}
        title={
          view.quality === 'ready'
            ? `판정이 끝난 상담 ${cases(node.decided)} 중 오기입 ${cases(node.misentry)} · 판정 전 ${cases(node.consultations - node.decided)}`
            : undefined
        }
      >
        {view.quality === 'loading'
          ? '…'
          : view.quality === 'error'
            ? '-'
            : pct(misentryRate)}
      </td>
      <td
        title={
          view.outcomesReady
            ? `유효 리드 ${people(node.leads)} 중 ${people(node.visitBooked)}`
            : undefined
        }
      >
        {view.outcomesReady ? pct(rateOf(node.visitBooked, node.leads)) : '-'}
      </td>
      <td
        title={
          conversionReady
            ? `유효 리드 ${people(node.leads)} 중 ${people(node.converted)}`
            : undefined
        }
      >
        {conversionReady ? pct(rateOf(node.converted, node.leads)) : '-'}
      </td>
      <td>{won(node.revenue)}</td>
      <td>{pct(roasOf(node))}</td>
    </>
  )
}

const NodeRows = ({
  node,
  level,
  expanded,
  toggle,
  view,
}: {
  node: AdPerformanceNode
  level: 0 | 1 | 2
  expanded: ReadonlySet<string>
  toggle: (id: string) => void
  view: MetricView
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
        <MetricCells node={node} view={view} />
      </tr>
      {open &&
        node.children.map((child) => (
          <NodeRows
            key={child.id}
            node={child}
            level={(level + 1) as 1 | 2}
            expanded={expanded}
            toggle={toggle}
            view={view}
          />
        ))}
    </>
  )
}

/** 유입월 결제 전환 표 — 달마다 유효 리드, 방문체험 예약, 30·60·90일 안 첫
 * 구매 비율. 기간을 다 못 채운 칸은 '진행 중', 첫 리드도 못 채운 칸은 비운다
 * (ROAS 탭 코호트와 같은 표시). */
const LeadCohortTable = ({
  cohorts,
  outcomesReady,
  conversionReady,
}: {
  cohorts: readonly LeadCohortRow[]
  outcomesReady: boolean
  conversionReady: boolean
}) => (
  <div className="channel-insight__table-wrap">
    <table className="channel-insight__table channel-insight__table--roas">
      <thead>
        <tr>
          <th>유입 월</th>
          <th>유효 리드</th>
          <th>방문체험 예약</th>
          {LEAD_COHORT_WINDOWS.map((window) => (
            <th key={window}>{window}일 결제 전환</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cohorts.map((cohort) => (
          <tr key={cohort.month}>
            <td>{cohort.month.replace('-', '.')}</td>
            <td>{cohort.leads.toLocaleString()}명</td>
            <td>
              {outcomesReady ? (
                <>
                  {pct(rateOf(cohort.visitBooked, cohort.leads))}
                  <span className="roas-attribution__sub">
                    {cohort.visitBooked.toLocaleString()}/
                    {cohort.leads.toLocaleString()}명
                  </span>
                </>
              ) : (
                '-'
              )}
            </td>
            {LEAD_COHORT_WINDOWS.map((window) => {
              const cell = cohort.cells[window]
              if (!conversionReady) return <td key={window}>-</td>
              // 첫 리드도 기간을 못 채운 칸은 앞 칸과 같은 값이라 비운다 — 첫
              // 칸(30일)은 지금까지의 값을 "진행 중"으로 보인다.
              if (
                cell.status === 'pending' &&
                window !== LEAD_COHORT_WINDOWS[0]
              ) {
                return (
                  <td key={window}>
                    -<span className="roas-attribution__sub">집계 전</span>
                  </td>
                )
              }
              return (
                <td key={window}>
                  <span className="roas-attribution__cell">
                    {cell.status !== 'complete' && (
                      <span className="roas-attribution__pending">진행 중</span>
                    )}
                    {pct(cell.rate)}
                  </span>
                  <span className="roas-attribution__sub">
                    {cell.converted.toLocaleString()}/
                    {cohort.leads.toLocaleString()}명
                  </span>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

/**
 * 광고 성과 탭 — Monday 상담의 utm_campaign(Meta 광고 이름)으로 고객을 Meta
 * 광고에 잇고, 캠페인 → 광고셋 → 광고별로 광고비·유효 리드·오기입률·방문체험
 * 예약률·결제 전환·귀속 매출을 보여 준다(주간 매체 성과표 R2 — Meta). 귀속
 * 매출은 ROAS 탭의 하한과 같은 규칙이다.
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
    cohorts,
    outcomesReady,
    qualityStatus,
    scope,
    setScope,
    expanded,
    toggle,
    showUnmatched,
    setShowUnmatched,
    display,
    setDisplay,
    sort,
    setSort,
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
  // 광고 단위 데이터는 따로 받는다 — 받는 동안 섹션 카드 하나에 로딩.
  if (!performance)
    return (
      <section className="channel-insight__section">
        <LoadingPanel label="광고 성과를 불러오는 중" minHeight={420} />
      </section>
    )

  const { total, campaigns, unmatched, unmatchedTotal, daily } = performance
  const allRevenue = total.revenue + unmatchedTotal.revenue
  const view: MetricView = { quality: qualityStatus, outcomesReady, scope }
  const conversionReady = scope === 'all' || outcomesReady
  const scopeToggle = (
    <Segmented
      options={PURCHASE_SCOPE_LABEL}
      value={scope}
      onChange={setScope}
      label="결제 전환 구매 범위"
    />
  )
  const tiles: {
    key: string
    label: string
    value: string
    format: (value: number) => string
    /** 묶은 날들(하루·주·달)의 값 — 합계 지표는 더하고 ROAS는 합계로 나눈다. */
    groupValue: (days: readonly AdPerformanceDay[]) => number
    /** 하루치를 무엇으로 세는지 — 크게 볼 때 부제. */
    basis: string
  }[] = [
    {
      key: 'spend',
      label: '광고비',
      value: won(total.spend),
      format: won,
      groupValue: (days) => sumOf(days, 'spend'),
      basis: '그날 쓴 광고비',
    },
    {
      key: 'leads',
      label: '유효 리드',
      value: people(total.leads),
      format: people,
      groupValue: (days) => sumOf(days, 'leads'),
      basis: '처음 UTM 상담 접수일 기준 · 오기입 고객 제외',
    },
    {
      key: 'buyers',
      label: '구매 고객',
      value: people(total.buyers),
      format: people,
      groupValue: (days) => sumOf(days, 'buyers'),
      basis: '귀속 첫 구매 결제일 기준',
    },
    {
      key: 'revenue',
      label: '귀속 매출',
      value: won(total.revenue),
      format: won,
      groupValue: (days) => sumOf(days, 'revenue'),
      basis: '귀속 첫 구매 결제일 기준',
    },
    {
      key: 'roas',
      label: '광고 ROAS',
      value: pct(roasOf(total)),
      format: pct,
      groupValue: (days) => {
        const spend = sumOf(days, 'spend')
        return spend > 0 ? (sumOf(days, 'revenue') / spend) * 100 : 0
      },
      basis: '그날 귀속 매출 ÷ 그날 광고비',
    },
  ]

  return (
    <>
      <section className="channel-insight__section">
        <div className="channel-insight__section-head">
          <h3 className="channel-insight__section-title">Meta 광고 성과</h3>
        </div>
        {/* 숫자 칸 — 값 옆에 날짜별 추이. 칸을 누르면 이 묶음 안에서 그 칸이
            커지며 추이를 자세히 보여 준다(TrendGrid). */}
        <TrendGrid
          className="channel-insight__summary-grid roas-attribution__tiles has-trend"
          style={{ '--cols': 5 } as CSSProperties}
          tiles={tiles.map((tile, index) => {
            const values = daily.map((day) => tile.groupValue([day]))
            return {
              key: tile.key,
              className: 'channel-insight__kpi',
              style: { '--glass-i': index } as CSSProperties,
              detail: {
                title: `Meta 광고 · ${tile.label}`,
                subtitle: `${dateStart} ~ ${dateEnd} · ${tile.basis}`,
                value: tile.value,
                format: tile.format,
                series: () => trendSeriesOf(daily, tile.groupValue),
              },
              content: (
                <>
                  <span className="channel-insight__kpi-label">
                    {tile.label}
                  </span>
                  <span className="channel-insight__kpi-row">
                    <span className="channel-insight__kpi-value">
                      {tile.value}
                    </span>
                    <Sparkline
                      className="channel-insight__kpi-spark"
                      values={values}
                    />
                  </span>
                </>
              ),
            }
          })}
        />
        <p className="roas-attribution__note">
          * 유효 리드 = 조회 기간에 처음 Meta UTM 상담이 접수된 고객(오기입 고객
          제외) · 구매 고객·귀속 매출 = UTM 상담 접수일부터 90일 안의 첫 구매 중
          결제일이 조회 기간인 것 (ROAS 탭 하한과 같은 기준)
          <br />* 상담의 utm_campaign(광고 이름)으로 광고를 찾고, 같은 이름의
          광고가 여러 광고셋에 있으면 상담일 광고비 비율로 나눕니다 (그래서 사람
          수가 소수일 수 있습니다)
          <br />* 최근 문의는 아직 90일이 지나지 않아 구매가 덜 잡혀 있습니다
        </p>
        <div className="channel-insight__section-head ad-performance__list-head">
          <h4 className="ad-performance__list-title">캠페인별</h4>
          <div className="channel-insight__section-head-actions">
            {display === 'chart' && (
              <Segmented
                options={SORT_LABEL}
                value={sort}
                onChange={setSort}
                label="정렬"
                role="buttons"
              />
            )}
            {display === 'table' && scopeToggle}
            <Segmented
              options={DISPLAY_LABEL}
              value={display}
              onChange={setDisplay}
              label="그래프 / 표"
            />
          </div>
        </div>
        {display === 'chart' ? (
          <AdEfficiency
            campaigns={campaigns}
            total={total}
            sort={sort}
            expanded={expanded}
            toggle={toggle}
          />
        ) : (
          <>
            <div className="channel-insight__table-wrap">
              <table className="channel-insight__table channel-insight__table--roas ad-performance__table">
                <thead>
                  <tr>
                    <th>캠페인 / 광고셋 / 광고</th>
                    <th>광고비</th>
                    <th>유효 리드</th>
                    <th>유효 리드당 비용</th>
                    <th>오기입률</th>
                    <th>방문체험 예약률</th>
                    <th>결제 전환({PURCHASE_SCOPE_LABEL[scope]})</th>
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
                      view={view}
                    />
                  ))}
                  <tr className="roas-attribution__subtotal">
                    <td className="ad-performance__name">합계</td>
                    <MetricCells node={total} view={view} />
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="roas-attribution__note ad-performance__table-note">
              * 오기입률 = 조회 기간에 접수된 UTM 상담 중 판정이 끝난
              상담(상태가 비었거나 '신규 상담 유입'인 것 제외)에서 오기입 비율 —
              상담 한 건 단위라 번호를 못 읽은 상담도 들어갑니다
              <br />* 방문체험 예약률·결제 전환 = 유효 리드 중 리드일(UTM 상담
              접수일)부터 90일 안에 방문체험을 예약한·첫 구매를 한 비율 — 최근
              리드는 아직 90일이 안 돼 낮게 보입니다(달마다 기간이 찬 값은 아래
              유입월 표)
              <br />* 기준선: 유효 리드당 비용 13만 원, 오기입률 30% — 넘으면
              경고 색
              {!outcomesReady && (
                <>
                  <br />* 방문체험 예약률과 오프라인·온라인 결제 전환은 서버
                  반영 뒤 첫 Monday 동기화부터 보입니다
                </>
              )}
            </p>
          </>
        )}
      </section>

      <section className="channel-insight__section">
        <div className="channel-insight__section-head">
          <h3 className="channel-insight__section-title">유입월 결제 전환</h3>
          <div className="channel-insight__section-head-actions">
            {scopeToggle}
          </div>
        </div>
        <p className="roas-attribution__note">
          Meta 유효 리드(광고를 찾지 못한 utm_campaign 포함)를 리드일(UTM 상담
          접수일)의 달로 묶어, 리드일부터 30·60·90일 안에 첫 구매를 한
          비율입니다. 결제는 문의 뒤 몇 주 지나 일어나서 같은 달 리드끼리 기간이
          찬 값을 견줍니다. 조회 기간과 상관없이 끝 날짜의 달까지 최근{' '}
          {LEAD_COHORT_MONTHS}개월을 달 전체로 셉니다. '진행 중'은 그 달 리드
          일부가 아직 기간을 못 채워 더 오를 수 있는 값입니다.
        </p>
        <LeadCohortTable
          cohorts={cohorts}
          outcomesReady={outcomesReady}
          conversionReady={conversionReady}
        />
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
          Meta UTM 고객 중 utm_campaign이 Meta 광고 이름과 맞지 않는 경우 — 유효
          리드 {people(unmatchedTotal.leads)}, 구매{' '}
          {people(unmatchedTotal.buyers)}, 매출 {won(unmatchedTotal.revenue)}
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
                  <th>유효 리드</th>
                  <th>오기입률</th>
                  <th>구매</th>
                  <th>매출</th>
                </tr>
              </thead>
              <tbody>
                {unmatched.map((row) => (
                  <tr key={row.utmCampaign}>
                    <td className="ad-performance__name">{row.utmCampaign}</td>
                    <td>{people(row.leads)}</td>
                    <td
                      className={overClass(
                        rateOf(row.misentry, row.decided) > MISENTRY_RATE_LIMIT,
                      )}
                      title={`판정이 끝난 상담 ${cases(row.decided)} 중 오기입 ${cases(row.misentry)}`}
                    >
                      {pct(rateOf(row.misentry, row.decided))}
                    </td>
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

import type { CSSProperties } from 'react'
import type { AttributionRow, CombinedInsight } from '../client'
import {
  AD_CHANNELS,
  CHANNEL_LABEL,
  COHORT_WINDOWS,
  useRoasAttributionViewModel,
  type AttributionChannelRow,
  type CohortRow,
} from '../view-model/use-roas-attribution-view-model'
import { useDisplayMode } from '../view-model/use-display-mode'
import {
  AttributionMix,
  DisplayToggle,
  RatioChips,
  RoasRangeGauge,
} from './roas-charts'

const won = (v: number): string => `${Math.round(v).toLocaleString()}원`
const pct = (v: number): string =>
  Number.isFinite(v)
    ? `${v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : '-'
const share = (v: number): string => `${(v * 100).toFixed(1)}%`
/** 달 이름 — "2026.09"(며칠부터 며칠인지는 달 이름으로 안다). */
const monthLabel = (month: string): string => month.replace('-', '.')

/** 코호트 칸 색 — 손익분기(100%) 위는 데이터색, 아래는 위험색. 100%에서 멀수록
 * 진하게(로그 — 50%·200%가 같은 진하기). */
const heatOf = (roas: number) => {
  if (!Number.isFinite(roas) || roas <= 0) return undefined
  const strength = Math.min(1, Math.abs(Math.log2(roas / 100)) / 2)
  return {
    '--heat': 0.25 + strength * 0.75,
    '--heat-color': roas >= 100 ? 'var(--glass-accent)' : 'var(--glass-danger)',
  } as CSSProperties
}

/** 광고비 회수 — 처음으로 ROAS 100%를 넘긴 기간. 아직 다 안 찬 코호트는 진행 중. */
const Payback = ({ cohort }: { cohort: CohortRow }) => {
  const reached = COHORT_WINDOWS.find(
    (window) =>
      cohort.cells[window].status !== 'pending' &&
      cohort.cells[window].roas >= 100,
  )
  if (reached) {
    return <span className="roas-payback is-done">{reached}일 안에 회수</span>
  }
  const last = COHORT_WINDOWS[COHORT_WINDOWS.length - 1]
  return cohort.cells[last].status === 'complete' ? (
    <span className="roas-payback is-miss">{last}일 미회수</span>
  ) : (
    <span className="roas-payback is-pending">진행 중</span>
  )
}

const ChannelRow = ({
  row,
  emphasis,
}: {
  row: AttributionChannelRow
  emphasis?: boolean
}) => (
  <tr className={emphasis ? 'roas-attribution__subtotal' : undefined}>
    <td>{CHANNEL_LABEL[row.channel]}</td>
    <td>{row.spend === null ? '-' : won(row.spend)}</td>
    <td>{row.buyers.toLocaleString()}명</td>
    <td>{won(row.revenue)}</td>
    <td>{share(row.share)}</td>
    <td>{row.roas === null ? '-' : pct(row.roas)}</td>
  </tr>
)

/**
 * ROAS 탭의 광고 기여 섹션 — 두 가지를 보여 준다.
 *
 * 1. ROAS 범위: 광고로 확인된 신규 고객 매출 ÷ 광고비(하한)와 신규 고객
 *    ROAS(상한). 진짜 광고 ROAS는 이 사이에 있고, 경로를 모르는 매출이
 *    줄어들수록 두 값이 가까워진다.
 * 2. 고객 유입 월 코호트 ROAS: 그 달에 처음 나타난 고객이 30·60·90일 안에 산
 *    금액 ÷ 그 달 광고비 — 문의와 구매 사이의 시차를 걷어낸 값.
 *
 * 매출은 xtool 고객 통합 기준(전화번호로 묶은 Monday 결제 + Cafe24 주문의
 * 계약 금액)이라, 위 요약의 cmip 매출과 원 단위까지 같지는 않다.
 */
export function RoasAttribution({
  combinedInsight,
  attribution,
  upperBound,
}: {
  combinedInsight: CombinedInsight | null
  attribution: AttributionRow[] | null
  /** 상한 — 위 "ROAS 요약"의 신규 고객 ROAS를 그대로 받는다(같은 탭에서 두
   * 값이 어긋나 보이지 않게). */
  upperBound: number
}) {
  const data = useRoasAttributionViewModel(combinedInsight, attribution)
  const [display, setDisplay] = useDisplayMode('cmip.roas.range.display')

  if (!data) {
    return (
      <section className="channel-insight__section">
        <div className="channel-insight__section-head">
          <h3 className="channel-insight__section-title">광고 기여 ROAS</h3>
        </div>
        <p className="channel-insight__result-empty">
          고객 유입 경로 데이터를 불러오지 못했습니다.
        </p>
      </section>
    )
  }

  const { range, cohorts } = data
  const adRows = range.rows.filter((row) =>
    (AD_CHANNELS as readonly string[]).includes(row.channel),
  )
  const otherRows = range.rows.filter(
    (row) => !(AD_CHANNELS as readonly string[]).includes(row.channel),
  )
  const totalBuyers = range.rows.reduce((sum, row) => sum + row.buyers, 0)
  const adSubtotal: AttributionChannelRow = {
    channel: 'meta',
    spend: range.totalSpend,
    buyers: adRows.reduce((s, row) => s + row.buyers, 0),
    revenue: range.adRevenue,
    share: range.newRevenue > 0 ? range.adRevenue / range.newRevenue : 0,
    roas: range.lowerBound,
  }

  return (
    <>
      <section className="channel-insight__section">
        <div className="channel-insight__section-head">
          <h3 className="channel-insight__section-title">
            ROAS 범위 (광고 기여)
          </h3>
          <DisplayToggle value={display} onChange={setDisplay} />
        </div>
        {display === 'chart' && (
          <div className="roas-visual">
            <RoasRangeGauge lower={range.lowerBound} upper={upperBound} />
            <RatioChips
              items={[
                {
                  key: 'unknown',
                  label: 'UTM 없는 신규 매출 비중',
                  value: share(range.unknownShare),
                  note: '이 비중이 클수록 하한과 상한이 벌어집니다',
                  tone: range.unknownShare >= 0.5 ? 'warn' : undefined,
                },
                {
                  key: 'buyers',
                  label: '신규 고객',
                  value: `${totalBuyers.toLocaleString()}명`,
                  note: '조회 기간에 첫 구매를 한 고객',
                },
                {
                  key: 'cac',
                  label: '신규 고객 1명당 광고비',
                  value:
                    totalBuyers > 0 ? won(range.totalSpend / totalBuyers) : '-',
                  note: '광고비 ÷ 신규 고객 전체 — 획득 비용의 하한(광고 아닌 유입도 섞임)',
                },
                {
                  key: 'adCac',
                  label: 'UTM 광고 고객 1명당 광고비',
                  value:
                    adSubtotal.buyers > 0
                      ? won(range.totalSpend / adSubtotal.buyers)
                      : '-',
                  note: '광고비 ÷ UTM 광고로 확인된 신규 고객 — 획득 비용의 상한',
                },
                {
                  key: 'aov',
                  label: '신규 고객 첫 구매 평균',
                  value:
                    totalBuyers > 0 ? won(range.newRevenue / totalBuyers) : '-',
                  note: '신규 고객 매출 ÷ 신규 고객 — 한 명을 데려오면 처음에 얼마를 사는지',
                },
              ]}
            />
            <AttributionMix
              rows={range.rows.map((row) => ({
                key: row.channel,
                label: CHANNEL_LABEL[row.channel],
                revenue: row.revenue,
                buyers: row.buyers,
                spend: row.spend,
                roas: row.roas,
              }))}
              total={range.newRevenue}
            />
          </div>
        )}
        {display === 'table' && (
          <>
            <div className="channel-insight__summary-grid roas-attribution__tiles">
              <div className="channel-insight__kpi">
                <span className="channel-insight__kpi-label">
                  하한 · UTM 광고 ROAS
                </span>
                <span className="channel-insight__kpi-value">
                  {pct(range.lowerBound)}
                </span>
              </div>
              <div className="channel-insight__kpi">
                <span className="channel-insight__kpi-label">
                  상한 · 신규 고객 ROAS
                </span>
                <span className="channel-insight__kpi-value">
                  {pct(upperBound)}
                </span>
              </div>
              <div className="channel-insight__kpi">
                <span className="channel-insight__kpi-label">
                  UTM 없는 신규 매출 비중
                </span>
                <span className="channel-insight__kpi-value">
                  {share(range.unknownShare)}
                </span>
              </div>
            </div>
            <div className="channel-insight__table-wrap">
              <table className="channel-insight__table channel-insight__table--roas">
                <thead>
                  <tr>
                    <th>유입 채널</th>
                    <th>광고비</th>
                    <th>첫 구매 고객</th>
                    <th>첫 구매 매출</th>
                    <th>신규 매출 비중</th>
                    <th>ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {adRows.map((row) => (
                    <ChannelRow key={row.channel} row={row} />
                  ))}
                  <tr className="roas-attribution__subtotal">
                    <td>UTM 광고 합계 (하한)</td>
                    <td>{won(adSubtotal.spend ?? 0)}</td>
                    <td>{adSubtotal.buyers.toLocaleString()}명</td>
                    <td>{won(adSubtotal.revenue)}</td>
                    <td>{share(adSubtotal.share)}</td>
                    <td>{pct(adSubtotal.roas ?? 0)}</td>
                  </tr>
                  {otherRows.map((row) => (
                    <ChannelRow key={row.channel} row={row} />
                  ))}
                  <tr className="roas-attribution__subtotal">
                    <td>신규 고객 전체</td>
                    <td>{won(range.totalSpend)}</td>
                    <td>
                      {range.rows
                        .reduce((s, row) => s + row.buyers, 0)
                        .toLocaleString()}
                      명
                    </td>
                    <td>{won(range.newRevenue)}</td>
                    <td>100%</td>
                    <td>-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="roas-attribution__note">
          조회 기간에 첫 구매를 한 고객을 가장 이른 상담의 UTM source로 나누어
          추적
          <br />
          TODO: 방문체험 보드-유입기준이 광고성과 측정 기준이 될 수 있는지
          확인스크
          <br /> * 하한값 = UTM이 광고 채널(Meta·Google·Naver)인 고객의 첫
          구매만 광고 성과로 계산한 값 (UTM 상담 접수일부터 90일 안의 구매만,
          상담 전에 이미 산 고객은 제외)
          <br />* 상한값 = 재구매만 뺀 신규 고객 매출 전체
        </p>
      </section>

      <section className="channel-insight__section">
        <div className="channel-insight__section-head">
          <h3 className="channel-insight__section-title">
            고객 유입 월 코호트 ROAS
          </h3>
        </div>
        <p className="roas-attribution__note">
          아래 작은 글씨는 UTM이 광고 채널인 고객만 센 값(하한, 같은 90일 규칙).
        </p>
        {cohorts.length === 0 ? (
          <p className="channel-insight__result-empty">데이터 없음</p>
        ) : (
          <div className="channel-insight__table-wrap">
            <table className="channel-insight__table channel-insight__table--roas">
              <thead>
                <tr>
                  <th>유입 월</th>
                  <th>신규 고객</th>
                  <th>광고비</th>
                  {COHORT_WINDOWS.map((window) => (
                    <th key={window}>{window}일 ROAS</th>
                  ))}
                  <th>광고비 회수</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((cohort) => (
                  <tr key={cohort.month}>
                    <td>{monthLabel(cohort.month)}</td>
                    <td>
                      {cohort.customers.toLocaleString()}명
                      <span className="roas-attribution__sub">
                        UTM 광고 {cohort.adCustomers.toLocaleString()}명
                      </span>
                    </td>
                    <td>{won(cohort.spend)}</td>
                    {COHORT_WINDOWS.map((window) => {
                      const cell = cohort.cells[window]
                      // 첫 고객도 기간을 못 채운 칸은 앞 칸과 같은 값이라 비운다 —
                      // 단 첫 칸(30일)은 비우면 그 달에 보이는 값이 없어서
                      // "진행 중"으로 지금까지의 값을 보여 준다.
                      if (
                        cell.status === 'pending' &&
                        window !== COHORT_WINDOWS[0]
                      ) {
                        return (
                          <td key={window}>
                            -
                            <span className="roas-attribution__sub">
                              집계 전
                            </span>
                          </td>
                        )
                      }
                      return (
                        <td
                          key={window}
                          className="roas-cohort-cell"
                          style={heatOf(cell.roas)}
                        >
                          <span className="roas-attribution__cell">
                            {cell.status !== 'complete' && (
                              <span className="roas-attribution__pending">
                                진행 중
                              </span>
                            )}
                            {pct(cell.roas)}
                          </span>
                          <span className="roas-attribution__sub">
                            {won(cell.revenue)} · UTM 광고 {pct(cell.adRoas)}
                          </span>
                        </td>
                      )
                    })}
                    <td>
                      <Payback cohort={cohort} />
                    </td>
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

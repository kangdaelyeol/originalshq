import '@/screens/xtool-lead-manager/styles/nav.scss'
import '@/screens/xtool-lead-manager/styles/main.scss'
import '@/screens/xtool-lead-manager/styles/monday-stats.scss'
import '@/screens/xtool-lead-manager/styles/funnel-glass.scss'
import type { CSSProperties } from 'react'
import {
  CalendarClock,
  CreditCard,
  Footprints,
  Gauge,
  Route,
  ShoppingBag,
  Timer,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Segmented, StatTile } from '@/components/glass'
import { useRef } from 'react'
import { useModal } from '@/screens/xtool-lead-manager/hooks/use-modal'
import type {
  useMondayStatsViewModel,
  useMondayViewModel,
} from '@/screens/xtool-lead-manager/view-model'
import { StatsSkeleton } from './stats-skeleton'
import {
  formatPhoneNumber,
  formatWon,
  PURCHASE_SCOPE_LABEL,
  type PathRate,
  type PurchaseScope,
  type RateRow,
} from '@/screens/xtool-lead-manager/utils'

type MondayStatsProps = ReturnType<typeof useMondayStatsViewModel> & {
  /** 고객 목록을 받아오는 중인지·실패했는지 — 목록은 Monday 고객 탭의
   * view-model이 갖고 있다. */
  status: ReturnType<typeof useMondayViewModel>['state']['status']
  onReload: () => void
  /** 경로 목록에서 고객을 누르면 — Monday 고객 탭에서 그 고객 상세를 연다. */
  onOpenCustomer: (phone: string) => void
}

const SCOPE_DESC: Record<PurchaseScope, string> = {
  all: '구매는 오프라인 결제와 온라인몰 주문을 합쳐서 봅니다.',
  offline:
    '구매는 오프라인 결제만 봅니다. 문의 기록 없이 온라인에서만 산 고객은 모수에서 뺍니다.',
  online:
    '구매는 온라인몰 주문만 봅니다. 문의 기록 없이 오프라인에서만 산 고객은 모수에서 뺍니다.',
}

const percent = (rate: number): string => `${(rate * 100).toFixed(1)}%`
const people = (count: number): string => `${count.toLocaleString('ko-KR')}명`
const days = (value: number | null): string =>
  value === null ? '-' : `${Math.round(value * 10) / 10}일`
const monthLabel = (month: string): string => month.replace('-', '.')

/** 가로 막대 하나 — 이름 / 막대 / 값. 막대 길이는 `share`(0~1). 값은 막대
 * 끝이 아니라 오른쪽 칸에 글자로 적어, 막대가 짧아도 잘리지 않는다. */
const Bar = ({
  label,
  share,
  value,
  note,
  order = 0,
}: {
  label: string
  share: number
  value: string
  note: string
  /** 처음 그릴 때 위에서부터 차례로 자라게 — 순서(0부터). */
  order?: number
}) => (
  <div
    className="stats_bar"
    title={`${label}: ${value} (${note})`}
    style={{ '--glass-i': order } as CSSProperties}
  >
    <span className="stats_bar_label">{label}</span>
    <span className="stats_bar_track">
      <span
        className="stats_bar_fill"
        style={{ width: `${Math.max(share, 0) * 100}%` }}
      />
    </span>
    <span className="stats_bar_value">
      {value}
      <small>{note}</small>
    </span>
  </div>
)

/** 경로별 전환 타일의 아이콘(경로 id별). */
const PATH_ICONS: Record<string, LucideIcon> = {
  'consult-visit': Footprints,
  'consult-buy': ShoppingBag,
  'visit-buy': CreditCard,
  'consult-visit-buy': Route,
}

/** 전환율 표 — 한 줄이 한 집단(콜백 단계, 유입 경로, 담당자). 전환율 칸에는
 * 숫자 옆에 같은 값의 얇은 막대를 깔아 줄끼리 비교하기 쉽게 한다. */
const RateTable = ({
  head,
  rows,
  extra,
}: {
  head: string
  rows: RateRow[]
  /** 첫 칸 다음에 끼워 넣을 칸(콜백 표의 "누적 도달"). */
  extra?: { title: string; cell: (row: RateRow, index: number) => string }
}) => {
  const maxRate = Math.max(...rows.map((row) => row.purchaseRate), 0.0001)
  const maxVisit = Math.max(...rows.map((row) => row.visitRate), 0.0001)

  return (
    <table className="stats_table">
      <thead>
        <tr>
          <th>{head}</th>
          {extra && <th>{extra.title}</th>}
          <th>고객</th>
          <th>방문체험 전환율</th>
          <th>구매 전환율</th>
          <th>구매</th>
          <th>구매 금액</th>
          <th>인입→구매 (중앙값)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            {extra && <td>{extra.cell(row, index)}</td>}
            <td>{people(row.customers)}</td>
            <td>
              <span className="stats_rate">
                <span className="stats_rate_track">
                  <span
                    className="stats_rate_bar"
                    style={{ width: `${(row.visitRate / maxVisit) * 100}%` }}
                  />
                </span>
                <span className="stats_rate_text">
                  {percent(row.visitRate)}
                </span>
              </span>
            </td>
            <td>
              <span className="stats_rate">
                <span className="stats_rate_track">
                  <span
                    className="stats_rate_bar"
                    style={{ width: `${(row.purchaseRate / maxRate) * 100}%` }}
                  />
                </span>
                <span className="stats_rate_text">
                  {percent(row.purchaseRate)}
                </span>
              </span>
            </td>
            <td>{people(row.purchases)}</td>
            <td>{row.amount > 0 ? formatWon(row.amount) : '-'}</td>
            <td>{days(row.medianDays)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** 경로를 따라간 고객 목록(모달) — 고객 하나하나를 추적할 수 있게 핵심 날짜·
 * 금액을 보여 주고, 이름을 누르면 Monday 고객 탭에서 그 고객 상세를 연다.
 * Esc·바깥 클릭·닫기 버튼으로 닫는다. */
const PathCustomersModal = ({
  path,
  onClose,
  onOpenCustomer,
}: {
  path: PathRate
  onClose: () => void
  onOpenCustomer: (phone: string) => void
}) => {
  const closeRef = useRef<HTMLButtonElement>(null)

  useModal(onClose, closeRef)

  return (
    <div className="stats_path_modal" onClick={onClose}>
      <div
        className="stats_path_dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-path-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="stats_path_head">
          <h2 id="stats-path-title">
            {path.label}{' '}
            <span className="stats_path_count">{people(path.to)}</span>
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="stats_path_close"
            aria-label="닫기"
            onClick={onClose}
          >
            <X strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        <p className="stats_desc">
          {path.base}. 첫 구매가 최근인 순(구매 전이면 최초 인입이 최근인 순).
          이름을 누르면 Monday 고객 탭에서 상담·방문체험·결제 기록을 모두 볼 수
          있습니다.
        </p>
        <div className="stats_path_scroll">
          <table className="stats_table stats_path_table">
            <thead>
              <tr>
                <th>이름</th>
                <th>번호</th>
                <th>최초 인입</th>
                <th>방문체험</th>
                <th>첫 구매</th>
                <th>구매 금액</th>
                <th>인입→구매</th>
                <th>담당자</th>
                <th>유입 경로</th>
                <th>기록된 보드</th>
              </tr>
            </thead>
            <tbody>
              {path.customers.map((customer) => (
                <tr key={customer.phone}>
                  <td>
                    <button
                      type="button"
                      className="stats_path_name"
                      onClick={() => onOpenCustomer(customer.phone)}
                    >
                      {customer.name}
                    </button>
                  </td>
                  <td>{formatPhoneNumber(customer.phone)}</td>
                  <td>{customer.firstContactAt ?? '-'}</td>
                  <td>
                    {customer.visitCompleted
                      ? (customer.latestVisitAt ?? '완료')
                      : '-'}
                  </td>
                  <td>{customer.firstPurchaseAt ?? '-'}</td>
                  <td>{customer.amount ? formatWon(customer.amount) : '-'}</td>
                  <td>{days(customer.days)}</td>
                  <td>{customer.assignee ?? '-'}</td>
                  <td>{customer.source ?? '-'}</td>
                  <td className="stats_path_boards">
                    {customer.boards.join(', ') || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/**
 * 퍼널 통계 탭 — Monday 통합 고객을 "최초 인입 월" 기준으로 묶어 본다.
 *
 * 단위는 전부 고객(전화번호 하나)이고, 오기입 고객은 모수에서 뺀다. 최근
 * 달의 고객은 아직 구매까지 갈 시간이 없었을 수 있어 전환율이 낮게 보인다는
 * 점을 화면에도 적어 둔다.
 */
export const MondayStats = ({
  state,
  actions,
  status,
  onReload,
  onOpenCustomer,
}: MondayStatsProps) => {
  const { period, scope, months, stats, openPathId } = state
  const {
    changeFrom,
    changeTo,
    resetPeriod,
    changeScope,
    togglePath,
    closePath,
  } = actions
  const openPath = stats.paths.find((each) => each.id === openPathId) ?? null
  const { steps, paths, callback, sources } = stats
  const valid = steps[0].count

  return (
    <>
      <div className="lead_manager_nav monday_stats_nav funnel_nav glass_theme">
        <div className="inner">
          <span className="stats_nav_label">최초 인입 월</span>
          <div className="page_size_select">
            <select
              value={period.from ?? ''}
              aria-label="시작 월"
              onChange={(e) => changeFrom(e.target.value || null)}
            >
              <option value="">처음부터</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
          </div>
          <span className="stats_nav_label">~</span>
          <div className="page_size_select">
            <select
              value={period.to ?? ''}
              aria-label="끝 월"
              onChange={(e) => changeTo(e.target.value || null)}
            >
              <option value="">지금까지</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
          </div>
          {(period.from || period.to) && (
            <button type="button" className="stats_reset" onClick={resetPeriod}>
              전체 기간
            </button>
          )}
          {/* 구매 기준 — 아래 모든 구매 지표(전환율·건수·금액·소요 일수)가
              이 선택을 따른다. */}
          <span className="stats_nav_label stats_scope_label">구매 기준</span>
          <Segmented
            options={PURCHASE_SCOPE_LABEL}
            value={scope}
            onChange={changeScope}
            label="구매 기준"
            size="md"
          />
          <span className="stats_nav_note">
            고객 {people(stats.totalCustomers)} 중 오기입{' '}
            {people(stats.misentryCustomers)} 제외
          </span>
        </div>
      </div>

      <div className="xtool-main monday_stats funnel_main glass_theme">
        <div className="wrapper">
          {status === 'error' ? (
            <div className="monday_error">
              <p>Monday 고객 목록을 불러오지 못했습니다.</p>
              <button type="button" onClick={onReload}>
                다시 시도
              </button>
            </div>
          ) : status === 'idle' || status === 'loading' ? (
            <StatsSkeleton />
          ) : (
            <>
              <section className="stats_card">
                <h2>퍼널</h2>
                <p className="stats_desc">
                  유효 고객 중 각 단계까지 간 고객. 구매는 방문체험 없이도
                  일어나므로 앞 단계의 부분집합이 아닙니다. {SCOPE_DESC[scope]}
                </p>
                <div className="stats_bars">
                  {steps.map((step, index) => (
                    <Bar
                      key={step.label}
                      order={index}
                      label={step.label}
                      share={step.rate}
                      value={people(step.count)}
                      note={percent(step.rate)}
                    />
                  ))}
                </div>
                {scope === 'all' && (
                  <p className="stats_split">
                    구매 고객 구성 — 오프라인만{' '}
                    {people(stats.buyerSplit.offlineOnly)} · 온라인만{' '}
                    {people(stats.buyerSplit.onlineOnly)} · 둘 다{' '}
                    {people(stats.buyerSplit.both)}
                  </p>
                )}
              </section>

              <div className="stats_row">
                <section className="stats_card">
                  <h2>상담·방문체험 경로별 전환</h2>
                  <p className="stats_desc">
                    상담은 상담 보드 기록이 있는 고객, 방문체험은 체험을 완료한
                    고객 기준. 칸에 마우스를 올리면 모수가 보입니다.
                  </p>
                  <div className="stats_tiles">
                    {paths.map((each) => (
                      <div key={each.id} title={each.base}>
                        <StatTile
                          icon={PATH_ICONS[each.id] ?? Gauge}
                          label={each.label}
                          value={percent(each.rate)}
                          sub={`${people(each.from)} 중 ${people(each.to)}`}
                          onGo={
                            each.to === 0
                              ? undefined
                              : () => togglePath(each.id)
                          }
                          linkLabel={`${each.label} 고객 자세히 보기`}
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <section className="stats_card">
                  <h2>최초 인입 → 구매 소요 일수</h2>
                  <p className="stats_desc">
                    문의 기록이 있는 구매 고객 {people(stats.days.customers)}{' '}
                    기준. 결제 기록만 있는 고객 제외.
                  </p>
                  <div className="stats_tiles">
                    <StatTile
                      icon={Timer}
                      label="중앙값"
                      value={days(stats.days.median)}
                      sub="절반이 이 안에 구매"
                    />
                    <StatTile
                      icon={CalendarClock}
                      label="평균"
                      value={days(stats.days.mean)}
                      sub="오래 걸린 고객에 끌려 길어짐"
                    />
                  </div>
                  <div className="stats_bars compact">
                    {stats.days.buckets.map((bucket, index) => (
                      <Bar
                        key={bucket.label}
                        order={index}
                        label={bucket.label}
                        share={bucket.rate}
                        value={people(bucket.count)}
                        note={percent(bucket.rate)}
                      />
                    ))}
                  </div>
                </section>
              </div>

              {openPath && (
                <PathCustomersModal
                  path={openPath}
                  onClose={closePath}
                  onOpenCustomer={onOpenCustomer}
                />
              )}

              <section className="stats_card">
                <h2>콜백 단계별 전환</h2>
                <p className="stats_desc">
                  단계를 건너뛰어 적은 경우(2단계부터, 1→3단계)는 날짜가 적힌
                  가장 높은 단계까지 간 것으로 봅니다.
                </p>
                <RateTable
                  head="최종 도달 단계"
                  rows={callback}
                  extra={{
                    title: '이 단계 이상',
                    cell: (_, index) => people(callback[index].reached),
                  }}
                />
              </section>

              <section className="stats_card">
                <h2>유입 경로별 전환</h2>
                <p className="stats_desc">
                  가장 이른 상담의 UTM source, 없으면 방문체험 보드의 유입경로.
                  유효 고객 {people(valid)} 기준.
                </p>
                <RateTable head="유입 경로" rows={sources} />
              </section>

              <p className="stats_footnote">
                기간은 고객이 처음 기록에 나타난 달입니다. 최근 달의 고객은 아직
                구매까지 갈 시간이 없었을 수 있어 전환율이 낮게 보입니다.
                구매에는 오프라인 결제(Monday)와 온라인몰(Cafe24) 주문이 모두
                포함됩니다.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}

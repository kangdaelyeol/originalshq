import '../styles/insight-charts.scss'
import type { CSSProperties } from 'react'
import type { AdPerformanceMetrics, AdPerformanceNode } from '../client'
import { KIND_LABEL, nodeName } from './ad-performance-labels'

export type EfficiencySort = 'spend' | 'roas' | 'revenue'

// 오기입률 기준선(주간 매체 성과표 원문) — 넘으면 경고 색.
const MISENTRY_RATE_LIMIT = 30

// "돈은 쓰는데 구매가 안 나는" 줄 — 광고비 몫이 이만큼 넘는데 구매가 없으면
// (나눠 가진 0.x명도 구매로 본다 — "구매 0.5명"에 "구매 없음"이 붙지 않게).
const NO_BUY_SPEND_SHARE = 0.05

const won = (v: number): string => `${Math.round(v).toLocaleString()}원`
const people = (v: number): string =>
  Math.abs(v - Math.round(v)) < 0.05
    ? `${Math.round(v).toLocaleString()}명`
    : `${v.toFixed(1)}명`
const share = (v: number): string => `${(v * 100).toFixed(1)}%`
const roasOf = (n: { revenue: number; spend: number }) =>
  n.spend > 0 ? (n.revenue / n.spend) * 100 : NaN

const SORT_VALUE: Record<EfficiencySort, (node: AdPerformanceNode) => number> =
  {
    spend: (node) => node.spend,
    revenue: (node) => node.revenue,
    // 광고비가 없는 줄(ROAS를 셀 수 없는)은 맨 아래로.
    roas: (node) => {
      const roas = roasOf(node)
      return Number.isNaN(roas) ? -Infinity : roas
    },
  }

const sorted = (nodes: readonly AdPerformanceNode[], sort: EfficiencySort) =>
  [...nodes].sort((a, b) => SORT_VALUE[sort](b) - SORT_VALUE[sort](a))

const Row = ({
  node,
  depth,
  total,
  scale,
  sort,
  expanded,
  toggle,
  order,
}: {
  node: AdPerformanceNode
  /** 매체 0, 캠페인 1, 광고셋·광고그룹 2, 광고 3 — 들여쓰기. */
  depth: number
  total: AdPerformanceMetrics
  /** 막대 100% 폭이 되는 몫 — 가장 큰 매체 몫. */
  scale: number
  sort: EfficiencySort
  expanded: ReadonlySet<string>
  toggle: (id: string) => void
  order: number
}) => {
  const open = expanded.has(node.id)
  const canOpen = node.children.length > 0
  const name = nodeName(node)
  const spendShare = total.spend > 0 ? node.spend / total.spend : 0
  const revenueShare = total.revenue > 0 ? node.revenue / total.revenue : 0
  const roas = roasOf(node)
  // 오기입률 — 판정이 끝난 상담이 있을 때만(재료를 아직 못 받았으면 0건).
  const misentryRate =
    node.decided > 0 ? (node.misentry / node.decided) * 100 : null
  const noBuy = spendShare >= NO_BUY_SPEND_SHARE && node.buyers < 0.05
  const width = (value: number) =>
    `${scale > 0 ? Math.min(100, (value / scale) * 100) : 0}%`

  return (
    <>
      <div
        className={`ad-efficiency__row is-level-${depth}${noBuy ? ' is-no-buy' : ''}`}
        style={{ '--glass-i': Math.min(order, 14) } as CSSProperties}
      >
        <button
          type="button"
          className="ad-efficiency__name"
          style={{ paddingLeft: 10 + depth * 18 }}
          disabled={!canOpen}
          aria-expanded={canOpen ? open : undefined}
          title={name}
          onClick={() => toggle(node.id)}
        >
          <svg
            className={`ad-efficiency__caret${open ? ' is-open' : ''}`}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            {canOpen && (
              <path
                d="M7.5 5 12.5 10 7.5 15"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
          <span className="ad-efficiency__level">{KIND_LABEL[node.kind]}</span>
          <span className="ad-efficiency__text">{name}</span>
        </button>

        <div className="ad-efficiency__bars">
          <div
            className="ad-efficiency__bar is-spend"
            title={`광고비 ${won(node.spend)}`}
          >
            <span className="ad-efficiency__track">
              <i style={{ width: width(spendShare) }} />
            </span>
            <span className="ad-efficiency__share">{share(spendShare)}</span>
          </div>
          <div
            className="ad-efficiency__bar is-revenue"
            title={`귀속 매출 ${won(node.revenue)}`}
          >
            <span className="ad-efficiency__track">
              <i style={{ width: width(revenueShare) }} />
            </span>
            <span className="ad-efficiency__share">{share(revenueShare)}</span>
          </div>
        </div>

        <div className="ad-efficiency__stats">
          <span>
            유효 리드 <b>{people(node.leads)}</b>
          </span>
          {/* 칸 자리가 고정이라 재료가 없어도 그린다('-'). */}
          <span
            className={
              misentryRate !== null && misentryRate > MISENTRY_RATE_LIMIT
                ? 'ad-efficiency__misentry is-high'
                : 'ad-efficiency__misentry'
            }
          >
            오기입{' '}
            <b>{misentryRate === null ? '-' : `${misentryRate.toFixed(1)}%`}</b>
          </span>
          <span>
            구매 <b>{people(node.buyers)}</b>
          </span>
          <span className={`ad-efficiency__roas${roas < 100 ? ' is-low' : ''}`}>
            ROAS {Number.isNaN(roas) ? '-' : `${roas.toFixed(1)}%`}
          </span>
          {noBuy && <span className="ad-efficiency__warn">구매 없음</span>}
        </div>
      </div>
      {open &&
        sorted(node.children, sort).map((child, index) => (
          <Row
            key={child.id}
            node={child}
            depth={depth + 1}
            total={total}
            scale={scale}
            sort={sort}
            expanded={expanded}
            toggle={toggle}
            order={index}
          />
        ))}
    </>
  )
}

/**
 * 광고 성과 · 효율 — 매체마다 전체 광고비 중 몫(회색)과 귀속 매출 중 몫(색)
 * 막대를 나란히. 매출 막대가 더 길면 쓴 돈보다 많이 벌어 온 줄이다. 광고비
 * 몫이 5% 넘는데 구매가 없으면 "구매 없음"을 붙인다. 줄을 누르면 캠페인 →
 * 광고셋·광고그룹 → 광고로 펼친다(표와 같은 펼침 상태).
 */
export function AdEfficiency({
  nodes,
  total,
  sort,
  expanded,
  toggle,
}: {
  /** 맨 위 줄 — 매체. */
  nodes: readonly AdPerformanceNode[]
  total: AdPerformanceMetrics
  sort: EfficiencySort
  expanded: ReadonlySet<string>
  toggle: (id: string) => void
}) {
  // 막대 폭의 기준 — 가장 큰 매체 몫을 꽉 찬 폭으로(그 아래 줄은 그 안이라
  // 넘지 않는다).
  const scale = Math.max(
    0,
    ...nodes.map((node) =>
      Math.max(
        total.spend > 0 ? node.spend / total.spend : 0,
        total.revenue > 0 ? node.revenue / total.revenue : 0,
      ),
    ),
  )

  return (
    <div className="ad-efficiency">
      <div className="ad-efficiency__legend">
        <span>
          <i className="is-spend" />
          광고비 몫
        </span>
        <span>
          <i className="is-revenue" />
          귀속 매출 몫
        </span>
        <small>매출 막대가 더 길면 쓴 돈보다 많이 벌어 온 줄</small>
      </div>
      <div className="ad-efficiency__rows">
        {sorted(nodes, sort).map((node, index) => (
          <Row
            key={node.id}
            node={node}
            depth={0}
            total={total}
            scale={scale}
            sort={sort}
            expanded={expanded}
            toggle={toggle}
            order={index}
          />
        ))}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Segmented } from '@/components/glass'
import type { AdEntityDay, AdEntityKey } from '../../client'
import { addDays } from '../../utils'
import { useAdEntityDaily } from '../../view-model/use-ad-entity-daily'
import { won } from './labels'

const PERIOD_OPTIONS = { '7': '7일', '14': '14일', '30': '30일' } as const
type Period = keyof typeof PERIOD_OPTIONS

/** 최근 days일(오늘 포함)의 합계와 거기서 나온 단가·ROAS. */
const summarize = (days: readonly AdEntityDay[], from: string) => {
  const sum = { spend: 0, conversions: 0, revenue: 0 }
  for (const day of days) {
    if (day.date < from) continue
    sum.spend += day.spend
    sum.conversions += day.conversions
    sum.revenue += day.revenue
  }
  return {
    ...sum,
    cpa: sum.conversions > 0 ? sum.spend / sum.conversions : null,
    // 전환 가치가 없는 목표(문의 등)는 ROAS를 낼 수 없다.
    roas:
      sum.spend > 0 && sum.revenue > 0 ? (sum.revenue / sum.spend) * 100 : null,
  }
}

/**
 * 고른 캠페인·광고셋의 결과 지표 — 목표값을 손으로 넣는 대신 플랫폼이 잡은
 * 성과(getAdEntityDaily)로 광고비·전환·전환 단가·ROAS를 보여 준다.
 */
export function ResultMetrics({
  entityKey,
  today,
}: {
  entityKey: AdEntityKey
  today: string
}) {
  const daily = useAdEntityDaily(entityKey)
  const [period, setPeriod] = useState<Period>('14')
  const from = addDays(today, -(Number(period) - 1))

  const body = (() => {
    if (daily.status === 'loading')
      return <p className="ad-results__note">성과를 불러오는 중…</p>
    if (daily.status === 'error')
      return (
        <p className="ad-results__note">
          성과를 불러오지 못했습니다 — {daily.error}
        </p>
      )
    const s = summarize(daily.days, from)
    if (s.spend === 0 && s.conversions === 0)
      return <p className="ad-results__note">이 기간에는 성과가 없습니다.</p>
    const items = [
      { label: '광고비', value: won(s.spend) },
      { label: '전환', value: `${s.conversions.toLocaleString('ko-KR')}건` },
      { label: '전환 단가', value: s.cpa === null ? '-' : won(s.cpa) },
      {
        label: 'ROAS',
        value:
          s.roas === null
            ? '-'
            : `${Math.round(s.roas).toLocaleString('ko-KR')}%`,
      },
    ]
    return (
      <dl className="ad-results__grid">
        {items.map((item) => (
          <div key={item.label} className="ad-results__item">
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    )
  })()

  return (
    <section className="ad-results" aria-label="결과 지표">
      <div className="ad-results__head">
        <h4>결과 지표</h4>
        <span className="ad-results__hint">플랫폼 기준 · 오늘 포함</span>
        <Segmented
          options={PERIOD_OPTIONS}
          value={period}
          onChange={setPeriod}
          label="기간"
          role="buttons"
        />
      </div>
      {body}
    </section>
  )
}

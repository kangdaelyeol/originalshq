import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { Sparkline, TrendGrid } from '@/components/glass'
import type { FullListRow } from '../../view-model/use-full-list-table-view-model'
import { CHANNELS } from '../channels'
import {
  METRIC_FIELDS,
  type MetricField,
  type MetricKey,
} from '../metric-fields'
import { ChannelMark } from './channel-label'
import { formatMD } from '../../utils'

const FIELD = Object.fromEntries(
  METRIC_FIELDS.map((field) => [field.key, field]),
) as Record<MetricKey, MetricField>

// 카드 아래 칩 — 큰 값(정렬 지표)과 겹치지 않는 앞의 두 개. 칩은 짧게(한 줄에
// 들어가게): 이름은 줄이고 값은 소수를 떨군다(표 보기에는 그대로).
const FOOT: readonly {
  key: MetricKey
  label: string
  format: (value: number) => string
}[] = [
  {
    key: 'conversions',
    label: '전환',
    format: (v) =>
      `${v.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}건`,
  },
  {
    key: 'cpa',
    label: 'CPA',
    format: (v) => `${Math.round(v).toLocaleString('ko-KR')}원`,
  },
  {
    key: 'spend',
    label: '광고비',
    format: (v) => `${Math.round(v).toLocaleString('ko-KR')}원`,
  },
  {
    key: 'ctr',
    label: 'CTR',
    format: (v) => `${v.toFixed(2)}%`,
  },
]

const CHANNEL_LABEL = Object.fromEntries(
  CHANNELS.map((channel) => [channel.key, channel.label]),
)

/**
 * 캠페인·광고셋 목록의 카드 보기 — 캠페인 하나가 카드 하나(광고셋은 표 보기).
 * 카드에는 채널 표식, 이름, 정렬 지표의 값과 그 날짜별 작은 추이 그래프,
 * 아래에 다른 지표 두 개. 카드를 누르면 이 목록 안에서 그 카드가 커지며 추이를
 * 자세히 보여 주고(TrendGrid), 오른쪽 위 동그라미로 아래 비교 표에 넣고 뺀다
 * (표 보기의 체크와 같다).
 */
export function CampaignCards({
  rows,
  metricKey,
  selected,
  onToggleSelect,
  flashKey,
  onFlashEnd,
  emptyLabel,
  periodLabel,
}: {
  rows: readonly FullListRow[]
  /** 큰 값·추이 그래프로 보여 줄 지표 — 정렬 지표(이름 정렬이면 Spend). */
  metricKey: MetricKey
  selected: ReadonlySet<string>
  onToggleSelect: (selectKey: string) => void
  flashKey: string | null
  onFlashEnd: () => void
  emptyLabel: string
  /** 크게 볼 때 적을 기간. */
  periodLabel?: string
}) {
  if (rows.length === 0)
    return <p className="channel-insight__result-empty">{emptyLabel}</p>

  const field = FIELD[metricKey]
  const footFields = FOOT.filter((foot) => foot.key !== metricKey).slice(0, 2)

  return (
    <TrendGrid
      className="campaign-cards"
      tiles={rows.map((row, index) => {
        const checked = selected.has(row.selectKey)
        const flashing = flashKey === row.selectKey
        const adsetCount = row.children?.length ?? 0
        const values = (row.trend ?? []).map((day) => day[metricKey])
        return {
          key: row.key,
          className: `campaign-card${checked ? ' is-selected' : ''}${
            flashing ? ' is-flash' : ''
          }`,
          // 추이 그래프가 위 카드부터 차례로 그려진다(12장까지만 늦춘다).
          style: { '--glass-i': Math.min(index, 12) } as CSSProperties,
          data: { 'data-select-key': row.selectKey },
          onAnimationEnd: flashing
            ? (event) => {
                if (event.animationName === 'campaign-card-flash') onFlashEnd()
              }
            : undefined,
          values,
          detail: {
            title: `${row.name} · ${field.label}`,
            subtitle: periodLabel ? `${periodLabel} · 일별` : '일별',
            value: field.format(row.metrics[metricKey]),
            labels: (row.trend ?? []).map((day) => formatMD(day.date)),
            format: field.format,
          },
          content: (
            <>
              <span className="campaign-card__head">
                <span className="campaign-card__avatar">
                  {row.channels[0] && (
                    <ChannelMark channelKey={row.channels[0]} />
                  )}
                </span>
                <span className="campaign-card__titles">
                  <span className="campaign-card__name" title={row.name}>
                    {row.name}
                  </span>
                  <span className="campaign-card__sub">
                    {row.channels.map((key) => CHANNEL_LABEL[key]).join(' · ')}
                    {adsetCount > 0 && ` · 광고셋 ${adsetCount}`}
                  </span>
                </span>
                {/* 비교 표에 넣기·빼기 — 카드를 누르면 추이를 자세히 보므로
                    고르기는 이 동그라미로. */}
                <button
                  type="button"
                  className="campaign-card__check"
                  aria-pressed={checked}
                  aria-label={`${row.name} 비교 표에 ${checked ? '빼기' : '넣기'}`}
                  title={checked ? '비교 표에서 빼기' : '비교 표에 넣기'}
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleSelect(row.selectKey)
                  }}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Check strokeWidth={2.6} />
                </button>
              </span>

              <span className="campaign-card__body">
                <span className="campaign-card__metric">
                  <span className="campaign-card__label">{field.label}</span>
                  <strong className="campaign-card__value">
                    {field.format(row.metrics[metricKey])}
                  </strong>
                </span>
                <Sparkline className="campaign-card__spark" values={values} />
              </span>

              <span className="campaign-card__foot">
                {footFields.map((foot, footIndex) => (
                  <span
                    key={foot.key}
                    className={`campaign-card__chip${footIndex === 0 ? ' has-dot' : ''}`}
                  >
                    {foot.label} {foot.format(row.metrics[foot.key])}
                  </span>
                ))}
              </span>
            </>
          ),
        }
      })}
    />
  )
}

import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { Sparkline } from '@/components/glass'
import type { FullListRow } from '../../view-model/use-full-list-table-view-model'
import { CHANNELS } from '../channels'
import {
  METRIC_FIELDS,
  type MetricField,
  type MetricKey,
} from '../metric-fields'
import { ChannelMark } from './channel-label'

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
 * 아래에 다른 지표 두 개. 카드를 누르면 아래 비교 표에 넣고 뺀다(표 보기의
 * 체크와 같다).
 */
export function CampaignCards({
  rows,
  metricKey,
  selected,
  onToggleSelect,
  flashKey,
  onFlashEnd,
  emptyLabel,
}: {
  rows: readonly FullListRow[]
  /** 큰 값·추이 그래프로 보여 줄 지표 — 정렬 지표(이름 정렬이면 Spend). */
  metricKey: MetricKey
  selected: ReadonlySet<string>
  onToggleSelect: (selectKey: string) => void
  flashKey: string | null
  onFlashEnd: () => void
  emptyLabel: string
}) {
  if (rows.length === 0)
    return <p className="channel-insight__result-empty">{emptyLabel}</p>

  const field = FIELD[metricKey]
  const footFields = FOOT.filter((foot) => foot.key !== metricKey).slice(0, 2)

  return (
    <ul className="campaign-cards">
      {rows.map((row, index) => {
        const checked = selected.has(row.selectKey)
        const flashing = flashKey === row.selectKey
        const adsetCount = row.children?.length ?? 0
        return (
          <li key={row.key}>
            <button
              type="button"
              data-select-key={row.selectKey}
              className={`campaign-card${checked ? ' is-selected' : ''}${
                flashing ? ' is-flash' : ''
              }`}
              aria-pressed={checked}
              aria-label={`${row.name} — 비교 표에 ${checked ? '빼기' : '넣기'}`}
              // 추이 그래프가 위 카드부터 차례로 그려진다(12장까지만 늦춘다).
              style={{ '--glass-i': Math.min(index, 12) } as CSSProperties}
              onClick={() => onToggleSelect(row.selectKey)}
              onAnimationEnd={
                flashing
                  ? (event) => {
                      if (event.animationName === 'campaign-card-flash')
                        onFlashEnd()
                    }
                  : undefined
              }
            >
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
                <span className="campaign-card__check" aria-hidden>
                  <Check strokeWidth={2.6} />
                </span>
              </span>

              <span className="campaign-card__body">
                <span className="campaign-card__metric">
                  <span className="campaign-card__label">{field.label}</span>
                  <strong className="campaign-card__value">
                    {field.format(row.metrics[metricKey])}
                  </strong>
                </span>
                <Sparkline
                  className="campaign-card__spark"
                  values={(row.trend ?? []).map((day) => day[metricKey])}
                />
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
            </button>
          </li>
        )
      })}
    </ul>
  )
}

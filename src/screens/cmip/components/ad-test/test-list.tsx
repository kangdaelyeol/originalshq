import { useMemo, useState, type CSSProperties } from 'react'
import { Segmented } from '@/components/glass'
import type {
  PickerChannel,
  TestTarget,
} from '../../view-model/use-ad-test-view-model'
import { CHANNELS } from '../channels'
import { ChannelTile } from '../channel-insight/channel-label'
import { shortDate } from '../ad-settings/labels'

const CHANNEL_OPTIONS = {
  all: '전체',
  ...Object.fromEntries(CHANNELS.map((c) => [c.key, c.label])),
} as Record<PickerChannel, string>

/**
 * 왼쪽 — 설정 이력이 있는 캠페인·광고셋(광고 설정 탭에서 장을 넣은 것), 최근에
 * 바뀐 것부터. 광고셋은 캠페인 설정이 바뀐 것도 구간이 되어 같이 나온다.
 */
export function TestList({
  targets,
  selectedKey,
  today,
  onSelect,
}: {
  targets: readonly TestTarget[]
  selectedKey: string | null
  today: string
  onSelect: (key: string) => void
}) {
  const [channel, setChannel] = useState<PickerChannel>('all')
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return targets.filter(
      ({ entity }) =>
        (channel === 'all' || entity.channel === channel) &&
        (!q ||
          entity.name.toLowerCase().includes(q) ||
          entity.campaignName.toLowerCase().includes(q) ||
          entity.platformId.includes(q)),
    )
  }, [targets, channel, query])

  return (
    <div className="ad-test-list">
      <Segmented
        options={CHANNEL_OPTIONS}
        value={channel}
        onChange={setChannel}
        label="채널"
      />
      <input
        className="ad-input"
        type="search"
        placeholder="캠페인·광고셋 이름 또는 ID"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {targets.length === 0 ? (
        <p className="ad-test__empty">
          아직 설정을 넣은 캠페인·광고셋이 없습니다.
          <br />
          광고 설정 탭에서 장을 넣으면, 바뀐 날마다 구간이 생깁니다.
        </p>
      ) : shown.length === 0 ? (
        <p className="ad-test__empty">맞는 캠페인·광고셋이 없습니다.</p>
      ) : (
        <ul className="ad-test-list__items">
          {shown.map((target, i) => {
            const { entity } = target
            // 광고셋 자신의 장·매체 설정은 그대로고 캠페인 것만 바뀌었다.
            const inherited =
              entity.level === 'adset' &&
              target.events.every(
                (e) =>
                  !e.sources.includes('adset') && !e.platform.includes('adset'),
              )
            return (
              <li
                key={entity.key}
                style={{ '--glass-i': Math.min(i, 12) } as CSSProperties}
              >
                <button
                  type="button"
                  className={`ad-test-item${selectedKey === entity.key ? ' is-selected' : ''}`}
                  onClick={() => onSelect(entity.key)}
                >
                  <ChannelTile channelKey={entity.channel} />
                  <span className="ad-test-item__text">
                    <span className="ad-test-item__title">{entity.name}</span>
                    <span className="ad-test-item__sub">
                      {entity.level === 'adset'
                        ? `광고셋 · ${entity.campaignName}`
                        : '캠페인'}
                    </span>
                    <span className="ad-test-item__meta">
                      <span className="ad-badge is-current">
                        구간 {target.segmentCount}
                      </span>
                      {target.scheduledCount > 0 && (
                        <span className="ad-badge is-scheduled">
                          예약 {target.scheduledCount}
                        </span>
                      )}
                      {inherited && (
                        <span className="ad-badge is-inherited">
                          캠페인 설정
                        </span>
                      )}
                      {target.lastChange &&
                        `${shortDate(target.lastChange, today)} 변경`}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

import { useMemo, useState, type CSSProperties } from 'react'
import { Segmented } from '@/components/glass'
import type { AdChannel, AdEntity, AdTest } from '../../client'
import { addDays } from '../../utils'
import { CHANNELS } from '../channels'
import { ChannelTile } from '../channel-insight/channel-label'
import { shortDate } from '../ad-settings/labels'

type Mode = 'tests' | 'pick'
const MODE_LABEL: Record<Mode, string> = { tests: '테스트', pick: '새 테스트' }
type ChannelFilter = 'all' | AdChannel
const CHANNEL_OPTIONS = {
  all: '전체',
  ...Object.fromEntries(CHANNELS.map((c) => [c.key, c.label])),
} as Record<ChannelFilter, string>

/**
 * 왼쪽 — 저장된 테스트(모두가 같이 보는 목록)와, 새 테스트를 만들 캠페인·광고셋
 * 고르기. 대상마다 테스트가 하나라, 이미 테스트가 있는 대상을 고르면 그
 * 테스트가 열린다.
 */
export function TestList({
  tests,
  entities,
  selectedKey,
  today,
  hasDraft,
  onSelect,
}: {
  tests: readonly AdTest[]
  entities: readonly AdEntity[]
  selectedKey: string | null
  today: string
  hasDraft: (key: string) => boolean
  onSelect: (key: string) => void
}) {
  const [mode, setMode] = useState<Mode>(tests.length ? 'tests' : 'pick')
  const [channel, setChannel] = useState<ChannelFilter>('all')
  const [query, setQuery] = useState('')
  const testKeys = useMemo(
    () => new Set(tests.map((t) => t.entityKey)),
    [tests],
  )
  const entityByKey = useMemo(
    () => new Map(entities.map((e) => [e.key, e])),
    [entities],
  )

  // 고를 대상 — 최근 2주 안에 돈 것 먼저, 검색어는 이름·ID.
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    const since = addDays(today, -14)
    return entities
      .filter(
        (e) =>
          (channel === 'all' || e.channel === channel) &&
          (!q ||
            e.name.toLowerCase().includes(q) ||
            e.campaignName.toLowerCase().includes(q) ||
            e.platformId.includes(q)),
      )
      .sort(
        (a, b) =>
          Number(b.lastSeenDate >= since) - Number(a.lastSeenDate >= since) ||
          b.lastSeenDate.localeCompare(a.lastSeenDate) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 80)
  }, [entities, channel, query, today])

  return (
    <div className="ad-test-list">
      <Segmented
        options={MODE_LABEL}
        value={mode}
        onChange={setMode}
        label="목록"
      />

      {mode === 'tests' ? (
        tests.length === 0 ? (
          <p className="ad-test__empty">
            아직 저장된 테스트가 없습니다.
            <br />
            "새 테스트"에서 캠페인이나 광고셋을 고르세요.
          </p>
        ) : (
          <ul className="ad-test-list__items">
            {tests.map((test, i) => {
              const entity = entityByKey.get(test.entityKey)
              return (
                <li
                  key={test.id}
                  style={{ '--glass-i': Math.min(i, 12) } as CSSProperties}
                >
                  <button
                    type="button"
                    className={`ad-test-item${selectedKey === test.entityKey ? ' is-selected' : ''}`}
                    onClick={() => onSelect(test.entityKey)}
                  >
                    <ChannelTile channelKey={test.channel} />
                    <span className="ad-test-item__text">
                      <span className="ad-test-item__title">{test.title}</span>
                      <span className="ad-test-item__sub">
                        {test.level === 'adset' ? '광고셋' : '캠페인'} ·{' '}
                        {entity?.name ?? test.entityName}
                      </span>
                      <span className="ad-test-item__meta">
                        <span
                          className={`ad-badge ${test.status === 'running' ? 'is-scheduled' : ''}`}
                        >
                          {test.status === 'running' ? '진행 중' : '완료'}
                        </span>
                        구간 {test.segments.length}개 ·{' '}
                        {shortDate(
                          new Date(test.updatedAt).toISOString().slice(0, 10),
                          today,
                        )}{' '}
                        저장
                        {hasDraft(test.entityKey) && (
                          <span className="ad-badge is-missing">
                            저장 안 한 변경
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )
      ) : (
        <>
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
          <ul className="ad-test-list__items">
            {candidates.map((e) => (
              <li key={e.key}>
                <button
                  type="button"
                  className={`ad-test-item is-pick${selectedKey === e.key ? ' is-selected' : ''}`}
                  onClick={() => onSelect(e.key)}
                >
                  <ChannelTile channelKey={e.channel} />
                  <span className="ad-test-item__text">
                    <span className="ad-test-item__title">{e.name}</span>
                    <span className="ad-test-item__sub">
                      {e.level === 'adset'
                        ? `광고셋 · ${e.campaignName}`
                        : '캠페인'}
                    </span>
                    <span className="ad-test-item__meta">
                      {testKeys.has(e.key) && (
                        <span className="ad-badge is-current">테스트 있음</span>
                      )}
                      {e.lastSeenDate >= addDays(today, -1)
                        ? '운영 중'
                        : `${shortDate(e.lastSeenDate, today)}까지`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

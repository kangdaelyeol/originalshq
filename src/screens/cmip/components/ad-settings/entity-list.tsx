import type { CSSProperties } from 'react'
import {
  settingAt,
  type AdEntity,
  type AdEntityKey,
  type AdSettingVersion,
  type ConversionGoal,
} from '../../client'
import type { AdSettingsTreeNode } from '../../view-model/use-ad-settings-view-model'
import { ChannelMark } from '../channel-insight/channel-label'
import { addDays } from '../../utils'
import { formatBudget, shortDate } from './labels'

const Row = ({
  entity,
  byEntity,
  goals,
  today,
  selected,
  onSelect,
  toggle,
}: {
  entity: AdEntity
  byEntity: ReadonlyMap<AdEntityKey, AdSettingVersion[]>
  goals: ReadonlyMap<string, ConversionGoal>
  today: string
  selected: boolean
  onSelect: (key: string) => void
  toggle?: { open: boolean; count: number; onToggle: () => void }
}) => {
  const setting = settingAt(entity, byEntity, today)
  const own = byEntity.get(entity.key) ?? []
  const scheduled = own.some((v) => v.effectiveFrom > today)
  // 광고셋이 직접 정하지 않고 캠페인 것을 따르는 목표인지.
  const ownGoal = own
    .filter((v) => v.effectiveFrom <= today)
    .at(-1)?.conversionGoal
  const inherited =
    entity.level === 'adset' && !ownGoal && setting.conversionGoal !== null
  const goal = setting.conversionGoal
    ? goals.get(setting.conversionGoal)
    : undefined
  // 성과는 하루 늦게 들어오기도 해서, 어제까지 잡혔으면 돌고 있는 것으로 본다.
  const stale = entity.lastSeenDate < addDays(today, -1)

  return (
    <div
      className={`ad-entity is-${entity.level}${selected ? ' is-selected' : ''}`}
    >
      {toggle ? (
        <button
          type="button"
          className={`ad-entity__toggle${toggle.open ? ' is-open' : ''}`}
          aria-expanded={toggle.open}
          aria-label={toggle.open ? '광고셋 접기' : '광고셋 펼치기'}
          onClick={toggle.onToggle}
          disabled={toggle.count === 0}
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M7.5 5 12.5 10 7.5 15"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : (
        <span className="ad-entity__toggle-space" />
      )}
      <button
        type="button"
        className="ad-entity__main"
        onClick={() => onSelect(entity.key)}
        title={`${entity.name}\nID ${entity.platformId}\n${entity.firstSeenDate} ~ ${entity.lastSeenDate}`}
      >
        <span className="ad-entity__name">
          {entity.level === 'campaign' && (
            <ChannelMark channelKey={entity.channel} />
          )}
          <span>{entity.name}</span>
        </span>
        <span className="ad-entity__badges">
          {goal ? (
            <span className={`ad-badge${inherited ? ' is-inherited' : ''}`}>
              {goal.label}
            </span>
          ) : (
            <span className="ad-badge is-missing">목표 없음</span>
          )}
          {setting.budget && (
            <span className="ad-badge">{formatBudget(setting.budget)}</span>
          )}
          {scheduled && <span className="ad-badge is-scheduled">예약</span>}
          {toggle && <span className="ad-entity__count">{toggle.count}</span>}
          <span className={`ad-entity__seen${stale ? ' is-stale' : ''}`}>
            {stale ? `${shortDate(entity.lastSeenDate, today)}까지` : '운영 중'}
          </span>
        </span>
      </button>
    </div>
  )
}

/** 캠페인 → 광고셋 목록 — 줄마다 오늘 적용 중인 목표·예산과 예약 표시.
 * 광고셋이 캠페인 목표를 따르면 목표 배지가 옅다. */
export function EntityList({
  tree,
  byEntity,
  goals,
  today,
  selectedKey,
  expanded,
  onSelect,
  onToggle,
}: {
  tree: readonly AdSettingsTreeNode[]
  byEntity: ReadonlyMap<AdEntityKey, AdSettingVersion[]>
  goals: ReadonlyMap<string, ConversionGoal>
  today: string
  selectedKey: string | null
  expanded: ReadonlySet<string>
  onSelect: (key: string) => void
  onToggle: (key: string) => void
}) {
  if (tree.length === 0) {
    return <p className="ad-settings__empty">조건에 맞는 캠페인이 없습니다.</p>
  }
  return (
    <div className="ad-entity-list">
      {tree.map(({ campaign, adsets }, index) => {
        const open = expanded.has(campaign.key)
        return (
          <div
            key={campaign.key}
            className="ad-entity-group"
            style={{ '--glass-i': Math.min(index, 12) } as CSSProperties}
          >
            <Row
              entity={campaign}
              byEntity={byEntity}
              goals={goals}
              today={today}
              selected={selectedKey === campaign.key}
              onSelect={onSelect}
              toggle={{
                open,
                count: adsets.length,
                onToggle: () => onToggle(campaign.key),
              }}
            />
            {open &&
              adsets.map((adset) => (
                <Row
                  key={adset.key}
                  entity={adset}
                  byEntity={byEntity}
                  goals={goals}
                  today={today}
                  selected={selectedKey === adset.key}
                  onSelect={onSelect}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
}

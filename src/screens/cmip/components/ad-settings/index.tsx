import '../../styles/ad-settings.scss'
import { useEffect, useMemo, useState } from 'react'
import { AutoHeight, LoadingPanel, Segmented } from '@/components/glass'
import {
  useAdSettingsViewModel,
  type ChannelFilter,
} from '../../view-model/use-ad-settings-view-model'
import { CHANNELS } from '../channels'
import { CatalogManager } from './catalog-manager'
import { EntityList } from './entity-list'
import { SettingEditor } from './setting-editor'

const CHANNEL_OPTIONS: Record<ChannelFilter, string> = {
  all: '전체',
  ...(Object.fromEntries(CHANNELS.map((c) => [c.key, c.label])) as Record<
    Exclude<ChannelFilter, 'all'>,
    string
  >),
}
const SCOPE_OPTIONS = { active: '최근 14일', all: '전체 기간' } as const

/**
 * "광고 설정" 탭 — 왼쪽은 캠페인 → 광고셋 목록(동기화 때 자동으로 모인 것),
 * 오른쪽은 고른 대상의 설정(적용 시작일과 함께 한 장씩 쌓인다)과 변경 이력.
 * 위의 "목표·소재 관리"에서 고르는 목록(전환 목표·소재 셋)을 고친다.
 */
export function AdSettingsPanel() {
  const vm = useAdSettingsViewModel()
  const [showCatalog, setShowCatalog] = useState(false)
  const { notice, setNotice } = vm

  // 알림은 잠깐 보였다가 사라진다.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice, setNotice])

  const goals = useMemo(
    () => new Map((vm.snapshot?.goals ?? []).map((g) => [g.key, g])),
    [vm.snapshot],
  )

  const selected = vm.selected
  const selectedCampaign =
    selected?.level === 'adset'
      ? (vm.entityByKey.get(
          `${selected.channel}:campaign:${selected.campaignId}`,
        ) ?? null)
      : null

  return (
    <section className="channel-insight__section ad-settings">
      <AutoHeight className="channel-insight__section-body">
        {!vm.snapshot ? (
          vm.error ? (
            <p className="channel-insight__result-empty">
              광고 설정을 불러오지 못했습니다 — {vm.error}
            </p>
          ) : (
            <LoadingPanel label="광고 설정을 불러오는 중" minHeight={420} />
          )
        ) : (
          <div className="ad-settings__inner">
            <div className="channel-insight__section-head">
              <h3 className="channel-insight__section-title">광고 설정</h3>
              <span className="ad-settings__coverage">
                광고셋 <b>{vm.coverage.adsets}</b>개 중 전환 목표{' '}
                <b>{vm.coverage.withGoal}</b>개
                {vm.coverage.scheduled > 0 &&
                  ` · 예약 ${vm.coverage.scheduled}건`}
              </span>
              <button
                type="button"
                className={`ad-button${showCatalog ? ' is-active' : ''}`}
                aria-expanded={showCatalog}
                onClick={() => setShowCatalog((v) => !v)}
              >
                목표·소재 관리
              </button>
            </div>

            {showCatalog && (
              <CatalogManager
                goals={vm.snapshot.goals}
                creativeSets={vm.snapshot.creativeSets}
                saving={vm.saving}
                send={vm.send}
              />
            )}

            <div className="ad-settings__toolbar">
              <Segmented
                options={CHANNEL_OPTIONS}
                value={vm.channel}
                onChange={vm.setChannel}
                label="채널"
              />
              <Segmented
                options={SCOPE_OPTIONS}
                value={vm.activeOnly ? 'active' : 'all'}
                onChange={(v) => vm.setActiveOnly(v === 'active')}
                label="기간"
                role="buttons"
              />
              <input
                className="ad-input ad-settings__search"
                type="search"
                placeholder="캠페인·광고셋 이름 또는 ID"
                value={vm.query}
                onChange={(e) => vm.setQuery(e.target.value)}
              />
            </div>

            <div className="ad-settings__body">
              <EntityList
                tree={vm.tree}
                byEntity={vm.byEntity}
                goals={goals}
                today={vm.today}
                selectedKey={vm.selected?.key ?? null}
                expanded={vm.expanded}
                onSelect={vm.setSelectedKey}
                onToggle={vm.toggleExpanded}
              />
              <div className="ad-settings__editor">
                {selected ? (
                  <SettingEditor
                    key={selected.key}
                    entity={selected}
                    campaign={selectedCampaign}
                    byEntity={vm.byEntity}
                    goals={vm.snapshot.goals}
                    creativeSets={vm.snapshot.creativeSets}
                    today={vm.today}
                    saving={vm.saving}
                    send={vm.send}
                  />
                ) : (
                  <p className="ad-settings__placeholder">
                    왼쪽에서 캠페인이나 광고셋을 고르세요.
                    <br />
                    캠페인에 넣은 설정은 소속 광고셋이 비워 둔 칸에 그대로
                    적용됩니다.
                  </p>
                )}
              </div>
            </div>

            {notice && (
              <div className="ad-settings__notice" role="status">
                {notice}
              </div>
            )}
          </div>
        )}
      </AutoHeight>
    </section>
  )
}

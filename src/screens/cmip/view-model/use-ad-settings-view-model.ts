import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getAdSettings,
  saveAdSettings,
  settingAt,
  versionsByEntity,
  type AdChannel,
  type AdEntity,
  type AdSettingsSnapshot,
  type SaveAdSettingsRequest,
} from '../client'
import { addDays, todayISO } from '../utils'
import {
  boolean,
  oneOf,
  usePersistentState,
} from '@/hooks/use-persistent-state'

export type ChannelFilter = 'all' | AdChannel

/** "돌고 있는" 기준 — 최근 이만큼 안에 성과가 잡힌 대상. */
const ACTIVE_DAYS = 14

/** 목록의 캠페인 한 줄 — 그 아래 광고셋들. */
export interface AdSettingsTreeNode {
  campaign: AdEntity
  adsets: AdEntity[]
}

const matches = (entity: AdEntity, query: string) =>
  entity.name.toLowerCase().includes(query) || entity.platformId.includes(query)

/**
 * "광고 설정" 탭 — 캠페인·광고셋 목록(동기화 때 자동으로 모인 것)에서 대상을
 * 골라 전환 목표·소비 설정 비용·소재 셋 등을 적용 시작일과 함께 저장한다.
 * 저장·삭제 뒤에는 전부 다시 받는다(수백 건이라 가볍고, 서버와 어긋날 일이
 * 없다).
 */
export const useAdSettingsViewModel = () => {
  const [snapshot, setSnapshot] = useState<AdSettingsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [channel, setChannel] = usePersistentState<ChannelFilter>(
    'cmip.adSettings.channel',
    'all',
    oneOf<ChannelFilter>(['all', 'meta', 'google', 'naver', 'openai']),
  )
  const [activeOnly, setActiveOnly] = usePersistentState(
    'cmip.adSettings.activeOnly',
    true,
    boolean,
  )
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())

  const today = todayISO()

  const reload = useCallback(async () => {
    try {
      setSnapshot(await getAdSettings())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  // 처음 열 때 한 번.
  useEffect(() => {
    void reload()
  }, [reload])

  const byEntity = useMemo(
    () => versionsByEntity(snapshot?.versions ?? []),
    [snapshot],
  )
  const entityByKey = useMemo(
    () => new Map((snapshot?.entities ?? []).map((e) => [e.key, e])),
    [snapshot],
  )

  // 캠페인 → 광고셋 트리. 검색어·채널·"돌고 있는 것만"에 맞는 광고셋이 있으면
  // 캠페인도 남긴다(캠페인 이름이 맞으면 광고셋을 전부 보인다).
  const tree = useMemo((): AdSettingsTreeNode[] => {
    if (!snapshot) return []
    const since = addDays(today, -ACTIVE_DAYS)
    const q = query.trim().toLowerCase()
    const inScope = (e: AdEntity) =>
      (channel === 'all' || e.channel === channel) &&
      (!activeOnly || e.lastSeenDate >= since)
    const adsetsOf = new Map<string, AdEntity[]>()
    for (const e of snapshot.entities) {
      if (e.level !== 'adset' || !inScope(e)) continue
      const key = `${e.channel}:campaign:${e.campaignId}`
      const list = adsetsOf.get(key)
      if (list) list.push(e)
      else adsetsOf.set(key, [e])
    }
    return snapshot.entities
      .filter((e) => e.level === 'campaign' && inScope(e))
      .map((campaign) => {
        const adsets = (adsetsOf.get(campaign.key) ?? []).sort((a, b) =>
          a.name.localeCompare(b.name),
        )
        if (!q || matches(campaign, q)) return { campaign, adsets }
        return { campaign, adsets: adsets.filter((a) => matches(a, q)) }
      })
      .filter((node) => !q || matches(node.campaign, q) || node.adsets.length)
      .sort(
        (a, b) =>
          b.campaign.lastSeenDate.localeCompare(a.campaign.lastSeenDate) ||
          a.campaign.name.localeCompare(b.campaign.name),
      )
  }, [snapshot, channel, activeOnly, query, today])

  // 요약 — 보이는 광고셋 중 오늘 전환 목표가 정해진(캠페인에서 따른 것 포함) 수.
  const coverage = useMemo(() => {
    const adsets = tree.flatMap((node) => node.adsets)
    const withGoal = adsets.filter(
      (a) => settingAt(a, byEntity, today).conversionGoal !== null,
    ).length
    const scheduled = (snapshot?.versions ?? []).filter(
      (v) => v.effectiveFrom > today,
    ).length
    return { adsets: adsets.length, withGoal, scheduled }
  }, [tree, byEntity, today, snapshot])

  const selected = selectedKey ? (entityByKey.get(selectedKey) ?? null) : null

  const toggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  /** 저장·삭제 공통 — 보내고, 다 다시 받고, 결과를 알린다. 실패하면 throw하지
   * 않고 false(알림 줄에 이유). */
  const send = useCallback(
    async (request: SaveAdSettingsRequest, done: string) => {
      setSaving(true)
      try {
        await saveAdSettings(request)
        await reload()
        setNotice(done)
        return true
      } catch (err) {
        setNotice(
          `저장하지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`,
        )
        return false
      } finally {
        setSaving(false)
      }
    },
    [reload],
  )

  return {
    snapshot,
    error,
    saving,
    notice,
    today,
    channel,
    activeOnly,
    query,
    tree,
    coverage,
    byEntity,
    entityByKey,
    selected,
    expanded,
    setNotice,
    setChannel,
    setActiveOnly,
    setQuery,
    setSelectedKey,
    toggleExpanded,
    send,
    reload,
  } as const
}

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  adEntityKey,
  dataEvents,
  fillDays,
  getAdEntityDaily,
  getAdSettings,
  segmentMetrics,
  settingAt,
  versionsByEntity,
  type AdChannel,
  type AdCreativeView,
  type AdEntity,
  type AdEntityDay,
  type AdSettingsSnapshot,
  type CreativeAnalysis,
  type GoalKpi,
} from '../client'
import {
  settingEvents,
  settingSegments,
  type SettingEvent,
} from '../components/ad-test/changes'
import { todayISO } from '../utils'
import { changeCachedCreatives, useAdCreatives } from './use-ad-creatives'
import { usePersistentState } from '@/hooks/use-persistent-state'

type DailyState =
  | { status: 'loading' }
  | { status: 'ready'; days: AdEntityDay[] }
  | { status: 'error'; error: string }

// 받는 중 — 그릴 때마다 새 객체를 만들지 않게 하나를 같이 쓴다.
const LOADING: DailyState = { status: 'loading' }

/** 왼쪽 목록의 대상 하나 — 설정 이력이 있는 캠페인·광고셋. */
export interface TestTarget {
  entity: AdEntity
  /** 설정이 실제로 바뀐 날들(광고셋은 캠페인 변경 포함). */
  events: SettingEvent[]
  /** 오늘까지 시작한 장 수(= 구간 수)와 앞날로 넣은 장 수. */
  segmentCount: number
  scheduledCount: number
  /** 마지막으로 바뀐 날(예약 제외) — 없으면 null. */
  lastChange: string | null
}

export type PickerChannel = 'all' | AdChannel

/**
 * "매체별 테스트" 탭 — 광고 설정의 장(이력)이 곧 구간이다. 설정이 바뀐 날마다
 * 구간이 새로 시작하고, 구간마다 그 동안의 성과를 견준다(광고셋은 비워 둔 칸이
 * 따르는 캠페인 설정의 변경도, 매체에서 읽은 예산·입찰·타기팅이 바뀐 날도 구간이
 * 된다). 여기서는 구간을 따로 나누거나 저장하지 않는다 — 설정을 고치면(광고
 * 설정 탭) 구간도 바뀐다.
 */
export const useAdTestViewModel = () => {
  const [snapshot, setSnapshot] = useState<AdSettingsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = usePersistentState<string | null>(
    'cmip.adTest.selected',
    null,
    (stored) => (typeof stored === 'string' ? stored : undefined),
  )
  // 첫 설정 전 2주를 기준 구간으로 같이 볼지 — 이 브라우저에 남긴다.
  const [withBaseline, setWithBaseline] = usePersistentState<boolean>(
    'cmip.adTest.baseline',
    true,
    (stored) => (typeof stored === 'boolean' ? stored : undefined),
  )
  const [daily, setDaily] = useState<Record<string, DailyState>>({})
  const today = todayISO()

  // 요청을 보낸 대상 — 받는 중에 다시 그려도 두 번 보내지 않게.
  const requested = useRef(new Set<string>())

  // 처음 열 때 한 번 — 결과가 오면 그때 상태를 바꾼다.
  useEffect(() => {
    let alive = true
    getAdSettings()
      .then((next) => {
        if (!alive) return
        setSnapshot(next)
        setError(null)
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      alive = false
    }
  }, [])

  // 고른 대상의 일별 성과 — 대상마다 한 번만 받는다. 받은 결과가 없으면 받는
  // 중이다(받던 요청은 대상을 바꿔도 끊지 않고, 끝나면 그 대상 칸에 넣는다).
  const dailyState: DailyState | undefined = selectedKey
    ? (daily[selectedKey] ?? LOADING)
    : undefined
  useEffect(() => {
    if (!selectedKey || requested.current.has(selectedKey)) return
    const key = selectedKey
    requested.current.add(key)
    getAdEntityDaily(key)
      .then((days) =>
        setDaily((prev) => ({ ...prev, [key]: { status: 'ready', days } })),
      )
      .catch((err: unknown) =>
        setDaily((prev) => ({
          ...prev,
          [key]: {
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          },
        })),
      )
  }, [selectedKey])

  const byEntity = useMemo(
    () => versionsByEntity(snapshot?.versions ?? []),
    [snapshot],
  )
  const entityByKey = useMemo(
    () => new Map((snapshot?.entities ?? []).map((e) => [e.key, e])),
    [snapshot],
  )
  // 매체 설정 기록(자동) — 바뀐 날도 구간 경계가 된다.
  const platform = useMemo(
    () => new Map((snapshot?.platform ?? []).map((p) => [p.entityKey, p])),
    [snapshot],
  )

  // 왼쪽 목록 — 설정 이력이 있는 대상만, 최근에 바뀐 것부터.
  const targets = useMemo<TestTarget[]>(() => {
    if (!snapshot) return []
    return snapshot.entities
      .map((entity) => {
        const events = settingEvents(
          entity,
          byEntity,
          snapshot.goals,
          snapshot.creativeSets,
          platform,
        )
        const past = events.filter((e) => e.date <= today)
        return {
          entity,
          events,
          segmentCount: past.length,
          scheduledCount: events.length - past.length,
          lastChange: past[past.length - 1]?.date ?? null,
        }
      })
      .filter((target) => target.events.length > 0)
      .sort(
        (a, b) =>
          (b.lastChange ?? '').localeCompare(a.lastChange ?? '') ||
          a.entity.name.localeCompare(b.entity.name),
      )
  }, [snapshot, byEntity, platform, today])

  const entity = selectedKey ? (entityByKey.get(selectedKey) ?? null) : null
  const campaign =
    entity?.level === 'adset'
      ? (entityByKey.get(`${entity.channel}:campaign:${entity.campaignId}`) ??
        null)
      : null
  const days = useMemo(
    () => (dailyState?.status === 'ready' ? fillDays(dailyState.days) : []),
    [dailyState],
  )
  const events = useMemo(
    () =>
      targets.find((target) => target.entity.key === selectedKey)?.events ?? [],
    [targets, selectedKey],
  )

  const { segments, scheduled } = useMemo(
    () =>
      entity
        ? settingSegments(entity, byEntity, events, platform, {
            today,
            firstDay: days[0]?.date ?? null,
            lastDay: days[days.length - 1]?.date ?? null,
            withBaseline,
          })
        : { segments: [], scheduled: [] },
    [entity, byEntity, events, platform, today, days, withBaseline],
  )
  const metrics = useMemo(
    () => segments.map((s) => segmentMetrics(days, s.start, s.end)),
    [segments, days],
  )
  const changes = useMemo(() => dataEvents(days), [days])

  // 구간(장)에 고른 소재 — 캠페인의 소재 목록(그 광고셋들 소재와 캠페인에 올린
  // 것)에서 찾는다. 광고셋은 비워 둔 소재 칸이 캠페인 것을 따르므로 캠페인
  // 목록이라야 다 들어 있다. 고른 소재가 없으면 받지 않는다.
  const creativeKey =
    entity && segments.some((s) => s.setting?.creativeIds.length)
      ? entity.level === 'campaign'
        ? entity.key
        : adEntityKey(entity.channel, 'campaign', entity.campaignId)
      : null
  const creativesState = useAdCreatives(creativeKey)
  // 이 화면에서 방금 분석한 것 — 목록을 다시 받지 않고 바로 보인다.
  const [analyzed, setAnalyzed] = useState<Record<string, CreativeAnalysis>>({})
  const creativeById = useMemo(
    () =>
      new Map<string, AdCreativeView>(
        creativesState.status === 'ready'
          ? creativesState.creatives.map((c) => [
              c.id,
              analyzed[c.id] ? { ...c, analysis: analyzed[c.id] } : c,
            ])
          : [],
      ),
    [creativesState, analyzed],
  )
  const applyAnalysis = (id: string, analysis: CreativeAnalysis) => {
    setAnalyzed((prev) => ({ ...prev, [id]: analysis }))
    // 받아 둔 목록에도 — 광고 설정 편집기를 열어도 보이게.
    changeCachedCreatives((list) =>
      list.map((c) => (c.id === id ? { ...c, analysis } : c)),
    )
  }

  // 판단 지표 — 지금 적용 중인 설정의 전환 목표가 정한 지표(없으면 null).
  const goalKpi: GoalKpi | null = (() => {
    if (!entity || !snapshot) return null
    const goalKey = settingAt(entity, byEntity, today).conversionGoal
    return snapshot.goals.find((g) => g.key === goalKey)?.kpi ?? null
  })()

  return {
    snapshot,
    error,
    today,
    targets,
    selectedKey,
    select: setSelectedKey,
    entity,
    campaign,
    byEntity,
    dailyState,
    days,
    events,
    segments,
    scheduled,
    metrics,
    changes,
    goalKpi,
    withBaseline,
    setWithBaseline,
    creativesState: creativeKey ? creativesState : null,
    creativeById,
    applyAnalysis,
  } as const
}

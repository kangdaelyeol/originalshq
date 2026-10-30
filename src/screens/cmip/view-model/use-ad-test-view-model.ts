import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  SEGMENT_LETTERS,
  dataEvents,
  evenSegments,
  fillDays,
  getAdEntityDaily,
  getAdSettings,
  newSegmentId,
  saveAdSettings,
  segmentMetrics,
  settingAt,
  splitRange,
  versionsByEntity,
  type AdChannel,
  type AdEntity,
  type AdEntityDay,
  type AdSettingsSnapshot,
  type AdTest,
  type AdTestInput,
  type AdTestSegment,
  type GoalKpi,
  type SaveAdSettingsRequest,
} from '../client'
import {
  settingEvents,
  summarizeChanges,
  type SettingEvent,
} from '../components/ad-test/changes'
import { addDays, todayISO } from '../utils'
import type { ISODate } from '../types'
import { usePersistentState } from '@/hooks/use-persistent-state'

/** 새 테스트의 기본 범위 — 데이터가 있는 마지막 날까지 4주. */
const DEFAULT_DAYS = 28

type DailyState =
  | { status: 'loading' }
  | { status: 'ready'; days: AdEntityDay[] }
  | { status: 'error'; error: string }

const toInput = (test: AdTest): AdTestInput => ({
  entityKey: test.entityKey,
  title: test.title,
  hypothesis: test.hypothesis,
  primaryKpi: test.primaryKpi,
  status: test.status,
  segments: test.segments,
})

/** "구간 A"처럼 기본 이름인 구간은 시작일 순으로 글자를 다시 붙인다(직접 지은
 * 이름은 그대로). */
const relabel = (segments: readonly AdTestSegment[]): AdTestSegment[] => {
  const sorted = [...segments].sort(
    (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
  )
  return sorted.map((s, i) =>
    /^구간 [A-Z]$/.test(s.label)
      ? { ...s, label: `구간 ${SEGMENT_LETTERS[i] ?? i + 1}` }
      : s,
  )
}

/** 새 테스트 — 최근 설정 변경 앞뒤(없으면 마지막 4주)를 설정 바뀐 날마다
 * 자르고(그 날 바뀐 칸을 메모로), 바뀐 날이 없으면 반으로. */
const defaultDraft = (
  entity: AdEntity,
  days: readonly AdEntityDay[],
  events: readonly SettingEvent[],
  today: ISODate,
): AdTestInput => {
  const end = days.length ? days[days.length - 1].date : today
  const first = days.length ? days[0].date : addDays(today, -(DEFAULT_DAYS - 1))
  // 최근 60일 안에 설정이 바뀐 날이 있으면 그 첫 변경 2주 전부터(바뀌기 전과
  // 견주게), 없으면 마지막 4주.
  const recent = events.find((e) => e.date > addDays(end, -60) && e.date <= end)
  const candidate = recent
    ? addDays(recent.date, -14)
    : addDays(end, -(DEFAULT_DAYS - 1))
  const start = candidate > first ? candidate : first
  const cuts = events.map((e) => e.date).filter((d) => d > start && d <= end)
  const noteOf = (date: ISODate) => {
    const event = events.find((e) => e.date === date)
    return event ? summarizeChanges(event) : ''
  }
  return {
    entityKey: entity.key,
    title: `${entity.name} 테스트`,
    hypothesis: '',
    primaryKpi: null,
    status: 'running',
    segments: cuts.length
      ? splitRange(start, end, cuts, noteOf)
      : start < end
        ? evenSegments(start, end, 2)
        : splitRange(start, end, []),
  }
}

export type PickerChannel = 'all' | AdChannel

/**
 * "매체별 테스트" 탭 — 캠페인·광고셋 하나를 골라(대상마다 테스트 하나, 모두가
 * 같이 보는 DB) 성과를 구간으로 나눠 견준다. 그 대상의 설정 변경(광고 설정
 * 기록)과 성과에서 찾은 변화(광고비 수준·멈춤)를 알려 주고, 그 날로 구간을
 * 나눌 수 있다. 고치는 동안은 대상마다 초안으로 들고 있다가 저장한다.
 */
export const useAdTestViewModel = () => {
  const [snapshot, setSnapshot] = useState<AdSettingsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = usePersistentState<string | null>(
    'cmip.adTest.selected',
    null,
    (stored) => (typeof stored === 'string' ? stored : undefined),
  )
  const [daily, setDaily] = useState<Record<string, DailyState>>({})
  const [drafts, setDrafts] = useState<Record<string, AdTestInput>>({})
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

  // 고른 대상의 일별 성과 — 대상마다 한 번만 받는다(받는 중 표시가 붙어 effect가
  // 다시 돌아도 이미 있으면 그냥 지나간다 — 받던 요청은 끊지 않는다).
  const dailyState = selectedKey ? daily[selectedKey] : undefined
  useEffect(() => {
    if (!selectedKey || dailyState) return
    const key = selectedKey
    setDaily((prev) => ({ ...prev, [key]: { status: 'loading' } }))
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
  }, [selectedKey, dailyState])

  const byEntity = useMemo(
    () => versionsByEntity(snapshot?.versions ?? []),
    [snapshot],
  )
  const entityByKey = useMemo(
    () => new Map((snapshot?.entities ?? []).map((e) => [e.key, e])),
    [snapshot],
  )
  const entity = selectedKey ? (entityByKey.get(selectedKey) ?? null) : null
  const campaign =
    entity?.level === 'adset'
      ? (entityByKey.get(`${entity.channel}:campaign:${entity.campaignId}`) ??
        null)
      : null
  const saved = snapshot?.tests.find((t) => t.entityKey === selectedKey) ?? null
  const days = useMemo(
    () => (dailyState?.status === 'ready' ? fillDays(dailyState.days) : []),
    [dailyState],
  )

  const events = useMemo(
    () =>
      entity && snapshot
        ? settingEvents(entity, byEntity, snapshot.goals, snapshot.creativeSets)
        : [],
    [entity, snapshot, byEntity],
  )
  const changes = useMemo(() => dataEvents(days), [days])

  const draft: AdTestInput | null =
    (selectedKey ? drafts[selectedKey] : undefined) ??
    (saved
      ? toInput(saved)
      : entity && dailyState?.status === 'ready'
        ? defaultDraft(entity, days, events, today)
        : null)
  const dirty =
    draft !== null &&
    JSON.stringify(draft) !== JSON.stringify(saved ? toInput(saved) : null)

  const metrics = useMemo(
    () =>
      draft
        ? draft.segments.map((s) => segmentMetrics(days, s.start, s.end))
        : [],
    [draft, days],
  )

  // 판단 지표 — 테스트에 정한 것, 없으면 대상 전환 목표의 지표, 그것도 없으면 CPA.
  const goalKpi: GoalKpi | null = (() => {
    if (!entity || !snapshot) return null
    const goalKey = settingAt(entity, byEntity, today).conversionGoal
    return snapshot.goals.find((g) => g.key === goalKey)?.kpi ?? null
  })()
  const primaryKpi: GoalKpi = draft?.primaryKpi ?? goalKpi ?? 'cpa'

  /** 초안 고치기 — 고른 대상의 초안을 바꾼다(아직 없으면 지금 보이는 값에서). */
  const edit = (change: (prev: AdTestInput) => AdTestInput) => {
    if (!selectedKey || !draft) return
    setDrafts((prev) => ({
      ...prev,
      [selectedKey]: change(prev[selectedKey] ?? draft),
    }))
  }
  const setSegments = (next: (prev: AdTestSegment[]) => AdTestSegment[]) =>
    edit((d) => ({ ...d, segments: relabel(next(d.segments)) }))

  const lastDay = days.length ? days[days.length - 1].date : today
  const firstDay = days.length
    ? days[0].date
    : addDays(today, -(DEFAULT_DAYS - 1))

  const segmentActions = {
    update: (id: string, patch: Partial<AdTestSegment>) =>
      setSegments((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s
          const next = { ...s, ...patch }
          // 끝이 시작보다 앞서면 맞춘다.
          if (next.end < next.start) {
            if (patch.start) next.end = next.start
            else next.start = next.end
          }
          return next
        }),
      ),
    remove: (id: string) =>
      setSegments((prev) => prev.filter((s) => s.id !== id)),
    /** 마지막 구간 뒤에 일주일 — 데이터 마지막 날을 넘지 않게. */
    add: () =>
      setSegments((prev) => {
        const last = prev[prev.length - 1]
        const start = last ? addDays(last.end, 1) : addDays(lastDay, -6)
        const end = addDays(start, 6) < lastDay ? addDays(start, 6) : lastDay
        return [
          ...prev,
          {
            id: newSegmentId(),
            label: `구간 ${SEGMENT_LETTERS[prev.length] ?? prev.length + 1}`,
            start: start > end ? end : start,
            end,
            note: '',
          },
        ]
      }),
    /** 그 날부터 새 구간 — 그 날을 품은 구간을 둘로. */
    splitAt: (date: ISODate, note = '') =>
      setSegments((prev) => {
        const target = prev.find((s) => s.start < date && date <= s.end)
        if (!target) return prev
        return [
          ...prev.filter((s) => s.id !== target.id),
          { ...target, end: addDays(date, -1) },
          {
            id: newSegmentId(),
            label: '구간 Z',
            start: date,
            end: target.end,
            note,
          },
        ]
      }),
    /** 첫 구간 앞에 — 그 날부터 첫 구간 전날까지(범위 밖 알림에서). */
    addBefore: (date: ISODate, note = '') =>
      setSegments((prev) => {
        const first = prev[0]?.start
        if (!first || date >= first) return prev
        return [
          {
            id: newSegmentId(),
            label: '구간 Z',
            start: date,
            end: addDays(first, -1),
            note,
          },
          ...prev,
        ]
      }),
    /** 지금 범위를 설정 바뀐 날마다 다시 자른다. */
    bySettings: () =>
      setSegments((prev) => {
        const start = prev[0]?.start ?? firstDay
        const end = prev.reduce(
          (m, s) => (s.end > m ? s.end : m),
          prev[0]?.end ?? lastDay,
        )
        const cuts = events
          .map((e) => e.date)
          .filter((d) => d > start && d <= end)
        return splitRange(start, end, cuts, (date) => {
          const event = events.find((e) => e.date === date)
          return event ? summarizeChanges(event) : ''
        })
      }),
    /** 지금 범위를 n개로 고르게. */
    even: (n: number) =>
      setSegments((prev) => {
        const start = prev[0]?.start ?? firstDay
        const end = prev.reduce(
          (m, s) => (s.end > m ? s.end : m),
          prev[0]?.end ?? lastDay,
        )
        return evenSegments(start, end, n)
      }),
  }

  const send = async (request: SaveAdSettingsRequest, done: string) => {
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
  }
  const discardDraft = () => {
    if (!selectedKey) return
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[selectedKey]
      return next
    })
  }
  const save = async () => {
    if (!draft) return
    if (
      await send(
        { action: 'saveTest', test: draft },
        '테스트를 저장했습니다 — 모두가 같이 봅니다',
      )
    ) {
      discardDraft()
    }
  }
  const remove = async () => {
    if (!selectedKey) return
    if (
      await send(
        { action: 'deleteTest', entityKey: selectedKey },
        '테스트를 지웠습니다',
      )
    ) {
      discardDraft()
    }
  }

  return {
    snapshot,
    error,
    saving,
    notice,
    setNotice,
    today,
    selectedKey,
    select: setSelectedKey,
    entity,
    campaign,
    byEntity,
    saved,
    dailyState,
    days,
    events,
    changes,
    draft,
    dirty,
    metrics,
    goalKpi,
    primaryKpi,
    edit,
    segmentActions,
    discardDraft,
    save,
    remove,
    hasDraft: (key: string) => key in drafts,
  } as const
}

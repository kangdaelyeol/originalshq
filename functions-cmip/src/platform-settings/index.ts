// 매체 설정 기록 — 캠페인·광고셋의 예산·입찰·목표·타기팅을 매체에서 읽어
// adPlatformSettings에 쌓는다. 장(손으로 적는 설정)은 건드리지 않고, 화면이
// 둘을 같이 본다(편집기는 새 장을 열 때 매체 값으로 칸을 채우고, 매체별 테스트는
// 매체 값이 바뀐 날도 구간 경계로 쓴다).
//
// 읽을 때마다 마지막 줄과 견줘 다를 때만 쓴다 — 처음 읽은 대상은 기준 줄
// 하나(변경이 아니다), 같은 날 또 바뀌면 그 날 줄을 고친다. 처음 읽은 날 전의
// 변경은 매체의 변경 기록(Meta 활동·Google change_event·OpenAI audit_logs, 지난
// 30일)에서 바뀐 칸만 pastChanges에 채운다 — 네이버·당근은 변경 기록이 없다.
import type { WriteBatch } from 'firebase-admin/firestore'
import type {
  PlatformPastChange,
  PlatformSettingDoc,
  PlatformSettingEntry,
  PlatformSettingFields,
} from '../ad-settings/types'
import type { DaangnCredentials } from '../channel/daangn/client'
import { getRefreshToken } from '../channel/google'
import type { GoogleAdsAccount } from '../channel/google/types'
import type { NaverCredentials } from '../channel/naver/client'
import type { OpenaiCredentials } from '../channel/openai/client'
import { todayISO } from '../channel/utils/dates'
import { db } from '../data'
import { readDaangnSettings } from './daangn'
import { readGooglePastChanges, readGoogleSettings } from './google'
import { readMetaPastChanges, readMetaSettings } from './meta'
import { readNaverSettings } from './naver'
import { readOpenaiPastChanges, readOpenaiSettings } from './openai'
import {
  AD_PLATFORM_SETTINGS,
  type PastChangeReading,
  type PlatformReading,
  type PlatformSettingsResult,
} from './types'

export * from './types'

const FIELDS: (keyof PlatformSettingFields)[] = [
  'budget',
  'bidding',
  'targetCpa',
  'targetRoas',
  'audience',
]

const same = (
  a: PlatformSettingFields[keyof PlatformSettingFields],
  b: PlatformSettingFields[keyof PlatformSettingFields],
) =>
  a !== null && typeof a === 'object' && b !== null && typeof b === 'object'
    ? a.amount === b.amount && a.period === b.period
    : a === b

/** before에서 after로 바뀐 칸. */
export const changedFields = (
  before: PlatformSettingFields,
  after: PlatformSettingFields,
) => FIELDS.filter((f) => !same(before[f], after[f]))

const entryOf = (
  fields: PlatformSettingFields,
  from: string,
  changed: PlatformSettingEntry['changed'],
): PlatformSettingEntry => ({
  from,
  changed,
  budget: fields.budget,
  bidding: fields.bidding,
  targetCpa: fields.targetCpa,
  targetRoas: fields.targetRoas,
  audience: fields.audience,
})

/** 지난 기록에 오늘 읽은 값을 더한 새 기록 — 바뀐 게 없으면 null. */
export const nextHistory = (
  history: readonly PlatformSettingEntry[],
  fields: PlatformSettingFields,
  today: string,
): PlatformSettingEntry[] | null => {
  const last = history[history.length - 1]
  if (!last) return [entryOf(fields, today, [])]
  if (changedFields(last, fields).length === 0) return null
  if (last.from !== today)
    return [...history, entryOf(fields, today, changedFields(last, fields))]
  // 같은 날 또 바뀌었다 — 그 날 줄을 고친다(바뀐 칸은 그 앞 줄과 견준다). 앞
  // 줄과 같아졌으면(되돌렸으면) 그 날 줄을 뺀다.
  const before = history[history.length - 2]
  if (!before) return [entryOf(fields, today, [])]
  const changed = changedFields(before, fields)
  return changed.length === 0
    ? history.slice(0, -1)
    : [...history.slice(0, -1), entryOf(fields, today, changed)]
}

/** 읽은 값을 기록에 반영한다 — 바뀐 대상만 쓰고, 나머지는 하루 한 번
 * lastSeenDate·이름만 고친다. */
export async function recordPlatformSettings(
  readings: readonly PlatformReading[],
): Promise<PlatformSettingsResult> {
  const today = todayISO()
  const col = db.collection(AD_PLATFORM_SETTINGS)
  const refs = readings.map((r) => col.doc(r.entityKey))
  const snaps = refs.length ? await db.getAll(...refs) : []
  let added = 0
  let changed = 0
  // 쓰기 묶음은 500건이 상한이라 400건씩 나눠 쓴다.
  const writes: ((batch: WriteBatch) => void)[] = []
  for (const [index, r] of readings.entries()) {
    const prev = snaps[index].exists
      ? (snaps[index].data() as PlatformSettingDoc)
      : null
    const history = nextHistory(prev?.history ?? [], r.fields, today)
    // 지난 변경만 있던 문서(지금 처음 집행 중인 것을 읽음)도 처음 읽은 것이다.
    // 바뀜은 변경 줄이 생긴 것만 — 처음 읽은 날 또 바뀌어 기준 줄을 고친 것은
    // 변경이 아니다.
    if (!prev?.history?.length) added += 1
    else if (history?.[history.length - 1]?.changed.length) changed += 1
    if (!history && prev?.lastSeenDate === today && prev.name === r.name)
      continue
    const doc: Partial<PlatformSettingDoc> = {
      entityKey: r.entityKey,
      channel: r.channel,
      level: r.level,
      platformId: r.platformId,
      name: r.name,
      lastSeenDate: today,
      ...(history ? { history } : {}),
    }
    writes.push((batch) => batch.set(refs[index], doc, { merge: true }))
  }
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch()
    for (const write of writes.slice(i, i + 400)) write(batch)
    await batch.commit()
  }
  return { entities: readings.length, added, changed }
}

/** 지난 변경을 기록에 더한다 — 그 대상을 처음 읽은 날(history[0]) 전의 것만,
 * 이미 넣은 id는 빼고. 처음 읽은 뒤로는 새로 들 것이 없어(그 뒤 변경은 history가
 * 잡는다) 보통 아무것도 쓰지 않는다. 지금 집행하지 않아 읽은 적 없는 대상은 지난
 * 변경만 가진 문서를 만든다. 새로 넣은 수를 돌려준다. */
export async function recordPastChanges(
  readings: readonly PastChangeReading[],
): Promise<number> {
  const byEntity = new Map<string, PastChangeReading[]>()
  for (const r of readings)
    byEntity.set(r.entityKey, [...(byEntity.get(r.entityKey) ?? []), r])
  const keys = [...byEntity.keys()]
  const col = db.collection(AD_PLATFORM_SETTINGS)
  const refs = keys.map((k) => col.doc(k))
  const snaps = refs.length ? await db.getAll(...refs) : []
  let added = 0
  const writes: ((batch: WriteBatch) => void)[] = []
  for (const [index, key] of keys.entries()) {
    const list = byEntity.get(key)!
    const prev = snaps[index].exists
      ? (snaps[index].data() as PlatformSettingDoc)
      : null
    const firstRead = prev?.history?.[0]?.from
    const known = new Set((prev?.pastChanges ?? []).map((c) => c.id))
    const fresh: PlatformPastChange[] = []
    for (const { change } of list) {
      if (known.has(change.id) || (firstRead && change.date >= firstRead))
        continue
      known.add(change.id)
      fresh.push(change)
    }
    if (fresh.length === 0) continue
    added += fresh.length
    const pastChanges = [...(prev?.pastChanges ?? []), ...fresh].sort(
      (a, b) => a.at - b.at,
    )
    const r = list[0]
    const doc: Partial<PlatformSettingDoc> = prev
      ? { pastChanges }
      : {
          entityKey: r.entityKey,
          channel: r.channel,
          level: r.level,
          platformId: r.platformId,
          name: list.find((x) => x.name)?.name ?? '',
          history: [],
          lastSeenDate: '',
          pastChanges,
        }
    writes.push((batch) => batch.set(refs[index], doc, { merge: true }))
  }
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch()
    for (const write of writes.slice(i, i + 400)) write(batch)
    await batch.commit()
  }
  return added
}

/** 지금 설정을 먼저 쌓고(처음 읽은 날이 정해진다) 지난 변경을 더한다. */
const withPast = async (
  readings: readonly PlatformReading[],
  past: () => Promise<readonly PastChangeReading[]>,
): Promise<PlatformSettingsResult> => {
  const result = await recordPlatformSettings(readings)
  return { ...result, pastAdded: await recordPastChanges(await past()) }
}

export const syncMetaPlatformSettings = async (accessToken: string) =>
  withPast(await readMetaSettings(accessToken), () =>
    readMetaPastChanges(accessToken),
  )

export const syncGooglePlatformSettings = async (
  brandId: string,
  account: GoogleAdsAccount,
) => {
  const refreshToken = await getRefreshToken(brandId)
  return withPast(await readGoogleSettings(account, refreshToken), () =>
    readGooglePastChanges(account, refreshToken),
  )
}

export const syncNaverPlatformSettings = async (
  credentials: NaverCredentials,
) => recordPlatformSettings(await readNaverSettings(credentials))

export const syncOpenaiPlatformSettings = async (
  credentials: OpenaiCredentials,
) =>
  withPast(await readOpenaiSettings(credentials), () =>
    readOpenaiPastChanges(credentials),
  )

export const syncDaangnPlatformSettings = async (
  credentials: DaangnCredentials,
) => recordPlatformSettings(await readDaangnSettings(credentials))

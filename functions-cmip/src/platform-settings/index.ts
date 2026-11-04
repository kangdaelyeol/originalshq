// 매체 설정 기록 — 캠페인·광고셋의 예산·입찰·목표·타기팅을 매체에서 읽어
// adPlatformSettings에 쌓는다. 장(손으로 적는 설정)은 건드리지 않고, 화면이
// 둘을 같이 본다(편집기는 새 장을 열 때 매체 값으로 칸을 채우고, 매체별 테스트는
// 매체 값이 바뀐 날도 구간 경계로 쓴다).
//
// 읽을 때마다 마지막 줄과 견줘 다를 때만 쓴다 — 처음 읽은 대상은 기준 줄
// 하나(변경이 아니다), 같은 날 또 바뀌면 그 날 줄을 고친다. 지난 변경을 매체의
// 변경 기록(Google change_event 등)에서 채우는 일은 아직 하지 않는다.
import type { WriteBatch } from 'firebase-admin/firestore'
import type {
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
import { readGoogleSettings } from './google'
import { readMetaSettings } from './meta'
import { readNaverSettings } from './naver'
import { readOpenaiSettings } from './openai'
import {
  AD_PLATFORM_SETTINGS,
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
    if (!prev) added += 1
    else if (history) changed += 1
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

export const syncMetaPlatformSettings = async (accessToken: string) =>
  recordPlatformSettings(await readMetaSettings(accessToken))

export const syncGooglePlatformSettings = async (
  brandId: string,
  account: GoogleAdsAccount,
) =>
  recordPlatformSettings(
    await readGoogleSettings(account, await getRefreshToken(brandId)),
  )

export const syncNaverPlatformSettings = async (
  credentials: NaverCredentials,
) => recordPlatformSettings(await readNaverSettings(credentials))

export const syncOpenaiPlatformSettings = async (
  credentials: OpenaiCredentials,
) => recordPlatformSettings(await readOpenaiSettings(credentials))

export const syncDaangnPlatformSettings = async (
  credentials: DaangnCredentials,
) => recordPlatformSettings(await readDaangnSettings(credentials))

// 광고 소재 동기화 — 매체에서 집행 중인 광고의 소재를 찾아 adCreatives에 모으고,
// 아직 처리하지 않은 소재를 몇 개씩 내려받아 프레임을 뽑는다(media.ts).
// 쓰기를 줄이려고, 이미 있는 소재는 광고가 늘었거나 날짜가 바뀐 경우에만 고친다.
import type { WriteBatch } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import { todayISO } from '../channel/utils/dates'
import { db } from '../data'
import { isMissingBucket, processCreativeMedia } from './media'
import {
  findActiveMetaCreatives,
  mediaUrlOf,
  pageTokensOf,
  type FoundCreative,
} from './meta'
import { AD_CREATIVES, type AdCreative } from './types'

export * from './types'

/** 한 번 실행에 처리(내려받기·프레임)할 최대 소재 수 — 나머지는 다음 실행에.
 * 제한 시간(deadlineMs)이 먼저 오면 그 전에 멈춘다. 이미지는 하나에 1초 남짓,
 * 영상은 프레임 수만큼 더 걸린다. */
const PROCESS_PER_RUN = 60
/** 이만큼 실패하면 failed로 멈춘다(그 전까지는 다음 실행에 다시 시도). */
const MAX_ATTEMPTS = 3

const adsetKeysOf = (ads: FoundCreative['ads']) =>
  [...new Set(Object.values(ads).map((a) => `meta:adset:${a.adsetId}`))].sort()

export interface CreativeSyncResult {
  /** 집행 중인 광고 수와 거기서 찾은 소재 수. */
  ads: number
  creatives: number
  /** 이번에 처음 본 소재. */
  newCreatives: number
  /** 광고가 늘었거나 날짜가 바뀌어 고친 소재. */
  updated: number
  processed: number
  failed: { id: string; error: string }[]
  /** 아직 처리하지 않은 소재(다음 실행에). */
  pending: number
}

/**
 * Meta 소재 동기화. deadlineMs(벽시계 시각)가 가까우면 처리를 멈추고 남은 건
 * 다음 실행에 넘긴다.
 */
export async function syncMetaCreatives(
  accessToken: string,
  deadlineMs: number,
): Promise<CreativeSyncResult> {
  const today = todayISO()
  const found = await findActiveMetaCreatives(accessToken)

  // 1) 찾은 소재를 모은다 — 이미 있는 문서는 한 번에 읽는다.
  const refs = found.creatives.map((c) => db.collection(AD_CREATIVES).doc(c.id))
  const existing = refs.length ? await db.getAll(...refs) : []
  let newCreatives = 0
  let updated = 0
  // 쓰기 묶음은 500건이 상한이라 400건씩 나눠 쓴다.
  const writes: ((batch: WriteBatch) => void)[] = []
  for (const [index, creative] of found.creatives.entries()) {
    const snap = existing[index]
    const adsetKeys = adsetKeysOf(creative.ads)
    if (!snap.exists) {
      const doc: AdCreative = {
        ...creative,
        channel: 'meta',
        adsetKeys,
        firstSeenAt: Date.now(),
        lastSeenDate: today,
        status: 'pending',
        attempts: 0,
        error: null,
        media: null,
      }
      writes.push((batch) => batch.set(refs[index], doc))
      newCreatives += 1
      continue
    }
    const prev = snap.data() as AdCreative
    // 예전에 쓰였던 광고도 남긴다(그 기간의 성과를 볼 때 필요하다).
    const ads = { ...prev.ads, ...creative.ads }
    const changed =
      prev.lastSeenDate !== today ||
      Object.keys(ads).length !== Object.keys(prev.ads).length
    if (!changed) continue
    writes.push((batch) =>
      batch.update(refs[index], {
        ads,
        adsetKeys: adsetKeysOf(ads),
        lastSeenDate: today,
        pageId: prev.pageId ?? creative.pageId,
      }),
    )
    updated += 1
  }
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch()
    for (const write of writes.slice(i, i + 400)) write(batch)
    await batch.commit()
  }

  // 2) 처리 안 한 소재를 몇 개씩 — 새로 찾은 것만이 아니라 지난번에 못 한 것도.
  const pendingSnap = await db
    .collection(AD_CREATIVES)
    .where('status', '==', 'pending')
    .get()
  const pending = pendingSnap.docs.map((d) => d.data() as AdCreative)
  const pageTokens = pending.some((c) => c.kind === 'video')
    ? await pageTokensOf(accessToken)
    : new Map<string, string>()

  let processed = 0
  let stopped = 0
  const failed: CreativeSyncResult['failed'] = []
  for (const creative of pending.slice(0, PROCESS_PER_RUN)) {
    if (Date.now() > deadlineMs) break
    const ref = db.collection(AD_CREATIVES).doc(creative.id)
    try {
      const { url, lengthSec } = await mediaUrlOf(
        creative,
        accessToken,
        pageTokens,
      )
      const media = await processCreativeMedia(
        creative.id,
        creative.kind,
        url,
        lengthSec,
      )
      await ref.update({ status: 'ready', media, error: null })
      processed += 1
    } catch (err) {
      if (isMissingBucket(err))
        throw new Error(
          'Storage 버킷이 없습니다 — Firebase 콘솔에서 Storage를 켜 주세요',
        )
      const error = err instanceof Error ? err.message : String(err)
      const attempts = creative.attempts + 1
      logger.warn(`소재 처리 실패(${creative.id}, ${attempts}번째):`, error)
      await ref.update({
        attempts,
        error,
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
      })
      failed.push({ id: creative.id, error })
      if (attempts >= MAX_ATTEMPTS) stopped += 1
    }
  }

  return {
    ads: found.ads,
    creatives: found.creatives.length,
    newCreatives,
    updated,
    processed,
    failed,
    // 실패해도 MAX_ATTEMPTS 전이면 다시 시도할 거라 남은 것에 든다.
    pending: pending.length - processed - stopped,
  }
}

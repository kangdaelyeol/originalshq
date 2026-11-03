// 소재 직접 올리기 — 매체에서 가져올 수 없는 소재(Google 유튜브 영상, 네이버·
// OpenAI 소재 등)를 광고 설정 화면에서 올린다. 함수는 요청 본문이 32MB까지라
// 파일은 함수를 거치지 않는다:
//   1) startCreativeUpload — Storage 재개형 업로드 세션을 열어 주소를 준다.
//      크기·형식·대상(entityKey)은 이때 세션에 박아 둬서 화면이 바꿀 수 없다.
//   2) 화면이 그 주소로 파일을 바로 올린다(PUT). 세션을 열 때 화면의 Origin을
//      넘겨서 버킷 CORS 설정이 따로 필요 없다.
//   3) finishCreativeUpload — 올라온 파일에서 프레임을 뽑고(media.ts) 소재
//      문서를 만든다. 처리하지 못한 파일은 지운다.
import { randomUUID } from 'node:crypto'
import { getStorage } from 'firebase-admin/storage'
import { ENTITY_KEY, type AdEntityKey } from '../ad-settings'
import { todayISO } from '../channel/utils/dates'
import { db } from '../data'
import { HttpError } from '../http'
import type { ValidationResponse } from '../types'
import { viewOf, type AdCreativeView } from './list'
import { extOf, isMissingBucket, processCreativeMedia } from './media'
import {
  AD_CREATIVES,
  type AdCreative,
  type CreativeChannel,
  type CreativeKind,
} from './types'

/** 올릴 수 있는 형식 — ffmpeg가 프레임을 뽑을 수 있고 브라우저가 보여 주는 것. */
const KINDS: Record<string, CreativeKind> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
}

/** 함수 메모리 안의 임시 폴더에 받아 처리하므로(media.ts MAX_BYTES와 같은 선). */
const MAX_BYTES: Record<CreativeKind, number> = {
  video: 200 * 1024 * 1024,
  image: 30 * 1024 * 1024,
}

export const UPLOAD_ID = /^upload_(video|image)_[0-9a-f]{16}$/

export interface StartUploadInput {
  entityKey: AdEntityKey
  fileName: string
  contentType: string
  size: number
}

export const validateStartUpload = (
  body: unknown,
): ValidationResponse<StartUploadInput> => {
  const x = (body ?? {}) as Record<string, unknown>
  if (typeof x.entityKey !== 'string' || !ENTITY_KEY.test(x.entityKey))
    return { ok: false, error: 'entityKey는 "채널:단위:ID" 모양이어야 합니다' }
  if (typeof x.fileName !== 'string' || !x.fileName.trim())
    return { ok: false, error: '파일 이름이 필요합니다' }
  const contentType = typeof x.contentType === 'string' ? x.contentType : ''
  const kind = KINDS[contentType]
  if (!kind)
    return {
      ok: false,
      error: 'JPG·PNG·WebP·GIF 이미지나 MP4·MOV·WebM 영상만 올릴 수 있습니다',
    }
  const size = Number(x.size)
  if (!Number.isInteger(size) || size <= 0)
    return { ok: false, error: '파일 크기가 필요합니다' }
  if (size > MAX_BYTES[kind])
    return {
      ok: false,
      error: `${kind === 'video' ? '영상' : '이미지'}은 ${MAX_BYTES[kind] / 1024 / 1024}MB까지 올릴 수 있습니다`,
    }
  return {
    ok: true,
    data: {
      entityKey: x.entityKey,
      fileName: x.fileName.trim().slice(0, 200),
      contentType,
      size,
    },
  }
}

const pathOf = (creativeId: string, contentType: string) =>
  `adCreatives/${creativeId}/original.${extOf(contentType)}`

/** 1) 업로드 세션을 연다 — 화면은 받은 uploadUrl로 파일을 PUT한다. */
export async function startCreativeUpload(
  input: StartUploadInput,
  uploadedBy: string,
  origin: string,
): Promise<{ creativeId: string; uploadUrl: string }> {
  const kind = KINDS[input.contentType]
  const creativeId = `upload_${kind}_${randomUUID().replace(/-/g, '').slice(0, 16)}`
  const file = getStorage().bucket().file(pathOf(creativeId, input.contentType))
  const [uploadUrl] = await file
    .createResumableUpload({
      origin,
      metadata: {
        // 길이를 정해 두면 Storage가 다른 크기의 파일을 받지 않는다.
        contentLength: input.size,
        contentType: input.contentType,
        metadata: {
          firebaseStorageDownloadTokens: randomUUID(),
          entityKey: input.entityKey,
          fileName: input.fileName,
          uploadedBy,
        },
      },
    })
    .catch((err: unknown) => {
      if (isMissingBucket(err))
        throw new HttpError(
          503,
          'Storage 버킷이 없습니다 — Firebase 콘솔에서 Storage를 켜 주세요',
        )
      throw err
    })
  return { creativeId, uploadUrl }
}

/** 2) 다 올라온 파일을 처리해 소재 문서를 만든다 — 같은 소재로 다시 부르면
 * 만든 것을 그대로 돌려준다. */
export async function finishCreativeUpload(
  creativeId: string,
): Promise<AdCreativeView> {
  const ref = db.collection(AD_CREATIVES).doc(creativeId)
  const existing = await ref.get()
  if (existing.exists) return viewOf(existing.data() as AdCreative)

  const bucket = getStorage().bucket()
  const [files] = await bucket.getFiles({
    prefix: `adCreatives/${creativeId}/`,
  })
  const original = files.find((f) => f.name.includes('/original.'))
  if (!original)
    throw new HttpError(404, '올라온 파일이 없습니다 — 다시 올려 주세요')
  const [metadata] = await original.getMetadata()
  const custom = (metadata.metadata ?? {}) as Record<string, string>
  const entityKey = String(custom.entityKey ?? '')
  if (!ENTITY_KEY.test(entityKey))
    throw new HttpError(400, '업로드 정보가 없습니다 — 다시 올려 주세요')

  const kind = KINDS[metadata.contentType ?? '']
  if (!kind) throw new HttpError(400, '올릴 수 없는 형식입니다')
  let media: AdCreative['media']
  try {
    media = await processCreativeMedia(creativeId, kind, {
      storagePath: original.name,
    })
  } catch (err) {
    // 프레임을 못 뽑는 파일은 남겨 둘 이유가 없다 — 지우고 다시 올리게.
    await bucket.deleteFiles({ prefix: `adCreatives/${creativeId}/` })
    throw new HttpError(
      422,
      `파일을 처리하지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const now = Date.now()
  const creative: AdCreative = {
    id: creativeId,
    channel: entityKey.split(':')[0] as CreativeChannel,
    kind,
    mediaId: creativeId.split('_')[2],
    accountId: '',
    pageId: null,
    sourceUrl: null,
    ads: {},
    adsetKeys: [entityKey],
    firstSeenAt: now,
    lastSeenDate: todayISO(),
    status: 'ready',
    attempts: 0,
    error: null,
    media,
    upload: {
      fileName: String(custom.fileName ?? ''),
      uploadedBy: String(custom.uploadedBy ?? ''),
      at: now,
    },
  }
  await ref.set(creative)
  return viewOf(creative)
}

/** 직접 올린 소재를 지운다 — 저장한 장에 들어 있으면 지우지 않는다(그 장의
 * 기록과 매체별 테스트가 이 소재를 가리킨다). */
export async function deleteUploadedCreative(creativeId: string) {
  const ref = db.collection(AD_CREATIVES).doc(creativeId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpError(404, '없는 소재입니다')
  if (!(snap.data() as AdCreative).upload)
    throw new HttpError(400, '매체에서 가져온 소재는 지울 수 없습니다')
  const used = await db
    .collection('adSettingVersions')
    .where('creativeIds', 'array-contains', creativeId)
    .limit(1)
    .get()
  if (!used.empty) {
    const version = used.docs[0].data() as { effectiveFrom?: string }
    throw new HttpError(
      409,
      `저장한 장(${version.effectiveFrom ?? '?'} 시작)에 들어 있어 지울 수 없습니다 — 그 장에서 빼고 지워 주세요`,
    )
  }
  await getStorage()
    .bucket()
    .deleteFiles({ prefix: `adCreatives/${creativeId}/` })
  await ref.delete()
  return { deleted: creativeId }
}

import { Firestore } from 'firebase-admin/firestore'
import { Editor } from './edits'
import { TechEditError } from './errors'

// 설정 > 배경에 직원이 올린 사진 — 팀 모두가 골라 쓸 수 있고, 지우기는 올린 사람만.
// 사진은 화면에서 1MB 아래로 줄여 보내고 Firestore에 bytes로 둔다(Storage를 따로
// 켜지 않으려고 — Storage 규칙은 xtool-read의 구성원 명단을 볼 수 없다). 목록(작은
// 미리보기 포함)과 원본을 나눠서, 목록만 볼 때 원본까지 내려받지 않게 한다.
const LIST = 'techBackgrounds'
const IMAGES = 'techBackgroundImages'

/** 원본 한 장 — 문서 한도(1MiB) 안쪽. 화면도 이보다 작게 줄여 보낸다. */
export const MAX_BACKGROUND_BYTES = 900 * 1024
const MAX_THUMB_BYTES = 120 * 1024
/** 팀 전체가 올릴 수 있는 장 수 */
const MAX_BACKGROUNDS = 40
const MAX_NAME = 40

export interface BackgroundInput {
  name?: unknown
  image?: unknown
  thumb?: unknown
  width?: unknown
  height?: unknown
}

/** 파일 앞머리로 본 사진 종류 — webp·jpeg·png만 */
function imageType(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg'
  }
  if (buf.readUInt32BE(0) === 0x89504e47) return 'image/png'
  return null
}

function decodeImage(value: unknown, max: number) {
  if (typeof value !== 'string' || !value) {
    throw new TechEditError('사진이 비어 있어요')
  }
  const data = Buffer.from(value, 'base64')
  if (data.length > max) {
    throw new TechEditError('사진이 너무 커요 — 다시 골라 주세요')
  }
  const type = imageType(data)
  if (!type) throw new TechEditError('사진 파일(jpg·png·webp)만 올릴 수 있어요')
  return { data, type }
}

const size = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ?
    Math.max(0, Math.round(value)) :
    0

/** 배경 사진 올리기 — 목록 문서와 원본 문서를 함께 만든다. */
export async function addBackground(
  db: Firestore,
  input: BackgroundInput,
  editor: Editor,
): Promise<{ id: string }> {
  const image = decodeImage(input.image, MAX_BACKGROUND_BYTES)
  const thumb = decodeImage(input.thumb, MAX_THUMB_BYTES)
  const name =
    String(input.name ?? '').trim().slice(0, MAX_NAME) || '이름 없는 사진'

  const count = (await db.collection(LIST).count().get()).data().count
  if (count >= MAX_BACKGROUNDS) {
    throw new TechEditError(
      `배경 사진은 ${MAX_BACKGROUNDS}장까지예요 — 안 쓰는 사진을 지운 뒤 올려 주세요`,
    )
  }

  const ref = db.collection(LIST).doc()
  const batch = db.batch()
  batch.set(ref, {
    id: ref.id,
    name,
    uploaderEmail: editor.email,
    uploaderName: editor.name,
    createdAt: Date.now(),
    width: size(input.width),
    height: size(input.height),
    type: image.type,
    size: image.data.length,
    thumb: thumb.data,
    thumbType: thumb.type,
  })
  batch.set(db.collection(IMAGES).doc(ref.id), {
    id: ref.id,
    type: image.type,
    data: image.data,
  })
  await batch.commit()
  return { id: ref.id }
}

/** 배경 사진 지우기 — 올린 사람만. */
export async function deleteBackground(
  db: Firestore,
  id: string,
  editor: Editor,
): Promise<void> {
  if (!id) throw new TechEditError('지울 사진을 골라 주세요')
  const ref = db.collection(LIST).doc(id)
  const doc = await ref.get()
  if (!doc.exists) throw new TechEditError('이미 지워진 사진이에요')
  if (doc.get('uploaderEmail') !== editor.email) {
    throw new TechEditError('올린 사람만 지울 수 있어요')
  }
  const batch = db.batch()
  batch.delete(ref)
  batch.delete(db.collection(IMAGES).doc(id))
  await batch.commit()
}

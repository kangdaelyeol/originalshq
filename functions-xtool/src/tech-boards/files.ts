import { Firestore } from 'firebase-admin/firestore'
import { findTechBoard } from './boards'
import { refreshItems } from './edits'
import { TechEditError } from './errors'
import { addEditLog, getBoardMeta, getItem } from './firestore'
import {
  addFileToColumn,
  changeColumnValues,
  fetchAssets,
} from './monday-api'
import { TechBoardKey, TechItemDoc } from './types'

// 파일 칸(사진·동영상·문서) — 원본은 Monday. 화면이 우리 함수로 파일을 보내면 그대로
// Monday 파일 칸에 붙이고(add_file_to_column), 보기는 그때그때 Monday 임시 주소
// (1시간)를 받아 쓴다. 캐시에는 파일 목록(이름·asset id)만 있다(칸 값 JSON).

/** 한 번에 올릴 수 있는 크기 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

// 올릴 수 있는 확장자 — 사진·동영상·문서. 브라우저가 종류(MIME)를 비워 보내는 파일
// (hwp 등)이 있어서 확장자로 본다.
const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp',
  'mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp', 'hwpx',
  'txt', 'csv', 'zip',
])

export interface TechFileRef {
  assetId: string
  name: string
  isImage: boolean
}

/** 파일 칸 값(JSON) → 파일 목록. 링크·문서(Monday doc)는 빼고 올린 파일만. */
export function filesOf(value: string | null | undefined): TechFileRef[] {
  if (!value) return []
  try {
    const files = (JSON.parse(value).files ?? []) as Array<{
      assetId?: number | string
      name?: string
      isImage?: string | boolean
      fileType?: string
    }>
    return files
      .filter((f) => (f.fileType ?? 'ASSET') === 'ASSET' && f.assetId)
      .map((f) => ({
        assetId: String(f.assetId),
        name: f.name ?? '파일',
        isImage: f.isImage === true || f.isImage === 'true',
      }))
  } catch {
    return []
  }
}

const extensionOf = (name: string) =>
  name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : ''

export interface UploadInput {
  boardKey: TechBoardKey
  itemId: string
  columnId: string
  fileName: string
  contentType: string
  data: Buffer
}

/** 파일 하나를 Monday 파일 칸에 붙이고 캐시·수정 기록을 맞춘다. */
export async function attachFile(
  db: Firestore,
  apiKey: string,
  input: UploadInput,
  editor: { email: string; name: string; uid: string },
): Promise<TechItemDoc | null> {
  const source = findTechBoard({ key: input.boardKey })
  if (!source) throw new TechEditError('없는 보드예요')
  const [meta, before] = await Promise.all([
    getBoardMeta(db, source.key),
    getItem(db, input.itemId),
  ])
  if (!meta) throw new TechEditError('보드 정보가 아직 없어요')
  if (!before || before.boardKey !== source.key) {
    throw new TechEditError('이 보드에 없는 항목이에요')
  }
  const column = meta.columns.find((c) => c.id === input.columnId)
  if (!column || column.type !== 'file') {
    throw new TechEditError('파일 칸이 아니에요')
  }
  if (input.data.length === 0) throw new TechEditError('빈 파일이에요')
  if (input.data.length > MAX_FILE_BYTES) {
    throw new TechEditError('10MB보다 큰 파일은 올릴 수 없어요')
  }
  if (!ALLOWED_EXTENSIONS.has(extensionOf(input.fileName))) {
    throw new TechEditError('사진·동영상·문서(pdf 등)만 올릴 수 있어요')
  }

  const log = {
    at: Date.now(),
    action: 'update' as const,
    boardKey: source.key,
    boardName: meta.name,
    itemId: before.itemId,
    itemName: before.name,
    by: editor,
  }
  try {
    await addFileToColumn(apiKey, before.itemId, column.id, {
      name: input.fileName,
      type: input.contentType || 'application/octet-stream',
      data: input.data,
    })
  } catch (error) {
    await addEditLog(db, {
      ...log,
      changes: [],
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
  const after =
    (await refreshItems(db, apiKey, source, [before.itemId], meta)).get(
      before.itemId,
    ) ?? null
  const names = (doc: TechItemDoc | null) =>
    filesOf(doc?.values[column.id]?.value)
      .map((f) => f.name)
      .join(', ') || null
  await addEditLog(db, {
    ...log,
    changes: [
      {
        field: column.id,
        title: column.title,
        before: names(before),
        after: names(after) ?? input.fileName,
      },
    ],
    ok: true,
  })
  return after
}

/** 파일 칸 비우기 — Monday API는 파일 하나만 지우기를 지원하지 않아 칸 전체를
 * 비운다(clear_all). 되돌릴 수 없다(Monday 쪽에서도). */
export async function clearFiles(
  db: Firestore,
  apiKey: string,
  input: { boardKey: TechBoardKey; itemId: string; columnId: string },
  editor: { email: string; name: string; uid: string },
): Promise<TechItemDoc | null> {
  const source = findTechBoard({ key: input.boardKey })
  if (!source) throw new TechEditError('없는 보드예요')
  const [meta, before] = await Promise.all([
    getBoardMeta(db, source.key),
    getItem(db, input.itemId),
  ])
  if (!meta) throw new TechEditError('보드 정보가 아직 없어요')
  if (!before || before.boardKey !== source.key) {
    throw new TechEditError('이 보드에 없는 항목이에요')
  }
  const column = meta.columns.find((c) => c.id === input.columnId)
  if (!column || column.type !== 'file') {
    throw new TechEditError('파일 칸이 아니에요')
  }
  const names =
    filesOf(before.values[column.id]?.value)
      .map((f) => f.name)
      .join(', ') || null
  const log = {
    at: Date.now(),
    action: 'update' as const,
    boardKey: source.key,
    boardName: meta.name,
    itemId: before.itemId,
    itemName: before.name,
    by: editor,
  }
  try {
    await changeColumnValues(apiKey, source.boardId, before.itemId, {
      [column.id]: { clear_all: true },
    })
  } catch (error) {
    await addEditLog(db, {
      ...log,
      changes: [],
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
  const after =
    (await refreshItems(db, apiKey, source, [before.itemId], meta)).get(
      before.itemId,
    ) ?? null
  await addEditLog(db, {
    ...log,
    changes: [
      { field: column.id, title: column.title, before: names, after: null },
    ],
    ok: true,
  })
  return after
}

/** 항목에 붙은 파일의 임시 주소(1시간) — 그 항목의 파일만 내준다. */
export async function fileUrls(
  db: Firestore,
  apiKey: string,
  itemId: string,
  assetIds: string[],
) {
  const item = await getItem(db, itemId)
  if (!item) throw new TechEditError('없는 항목이에요')
  const owned = new Set(
    Object.values(item.values).flatMap((cell) =>
      filesOf(cell.value).map((f) => f.assetId),
    ),
  )
  const ids = assetIds.filter((id) => owned.has(id)).slice(0, 50)
  const assets = await fetchAssets(apiKey, ids)
  return assets.map((a) => ({
    id: String(a.id),
    name: a.name,
    url: a.public_url,
    thumbnail: a.url_thumbnail,
    extension: a.file_extension,
    size: a.file_size,
  }))
}

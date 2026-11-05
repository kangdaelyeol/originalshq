import { httpsCallable } from 'firebase/functions'
import { xtoolFirebase } from '@/xtool-auth/firebase'
import type { TechBoardKey } from '@xtool-core/tech-boards'

// 파일 칸(사진·동영상·문서) — 원본은 Monday. 올리기는 우리 함수(techUploadFile)로 파일을 그대로
// 보내 Monday 파일 칸에 붙이고, 보기는 Monday 임시 주소(1시간)를 받아 쓴다.
// 서버 쪽: functions-xtool/src/tech-boards/files.ts

/** 한 번에 올릴 수 있는 크기 — 서버(MAX_FILE_BYTES)와 같게 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

/** 고를 수 있는 파일 — 서버의 ALLOWED_EXTENSIONS와 같게 */
export const FILE_ACCEPT =
  'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.hwpx,.txt,.csv,.zip,.heic,.heif'
const ALLOWED_EXTENSIONS = new Set(
  'jpg jpeg png gif webp heic heif bmp mp4 mov m4v webm avi mkv pdf doc docx xls xlsx ppt pptx hwp hwpx txt csv zip'.split(' '),
)

export interface TechFileRef {
  assetId: string
  name: string
  isImage: boolean
}

/** 파일 칸 값(JSON) → 올린 파일 목록(링크·Monday 문서는 뺀다) */
export function filesOf(value: string | null | undefined): TechFileRef[] {
  if (!value) return []
  try {
    const files = (JSON.parse(value).files ?? []) as {
      assetId?: number | string
      name?: string
      isImage?: string | boolean
      fileType?: string
    }[]
    return files
      .filter((f) => (f.fileType ?? 'ASSET') === 'ASSET' && f.assetId)
      .map((f) => ({ assetId: String(f.assetId), name: f.name ?? '파일', isImage: f.isImage === true || f.isImage === 'true' }))
  } catch {
    return []
  }
}

/** 올리기 전 확인 — 문제가 있으면 이유, 없으면 null */
export function checkFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return `${file.name}: 10MB보다 커서 올릴 수 없어요`
  const ext = file.name.includes('.') ? (file.name.split('.').pop() ?? '').toLowerCase() : ''
  if (!ALLOWED_EXTENSIONS.has(ext)) return `${file.name}: 사진·동영상·문서(pdf 등)만 올릴 수 있어요`
  return null
}

export interface UploadTarget {
  boardKey: TechBoardKey
  itemId: string
  columnId: string
}

/** 파일 하나 올리기 — 진행률(0~1)을 알려 준다. 실패하면 서버 문구로 throw. */
export async function uploadTechFile(target: UploadTarget, file: File, onProgress: (ratio: number) => void): Promise<void> {
  const { auth, functions } = xtoolFirebase()
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('로그인이 필요해요')
  const project = functions.app.options.projectId
  const url = `https://us-central1-${project}.cloudfunctions.net/techUploadFile`
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.setRequestHeader('X-Board-Key', target.boardKey)
    xhr.setRequestHeader('X-Item-Id', target.itemId)
    xhr.setRequestHeader('X-Column-Id', target.columnId)
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name))
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      let message = `올리지 못했어요(${xhr.status})`
      try {
        message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message
      } catch {
        // 문구가 JSON이 아니면 상태 코드만
      }
      reject(new Error(message))
    }
    xhr.onerror = () => reject(new Error('네트워크 오류로 올리지 못했어요'))
    xhr.send(file)
  })
}

export interface TechFileLink {
  id: string
  name: string
  /** 임시 공개 주소(1시간) */
  url: string | null
  /** 사진 썸네일 */
  thumbnail: string | null
  extension: string | null
  size: number | null
}

// 임시 주소는 1시간 — 50분까지만 다시 쓴다.
const URL_TTL_MS = 50 * 60 * 1000
const linkCache = new Map<string, { link: TechFileLink; at: number }>()

/** 항목에 붙은 파일들의 임시 주소·썸네일 */
export async function fetchFileLinks(itemId: string, assetIds: string[]): Promise<Map<string, TechFileLink>> {
  const now = Date.now()
  const result = new Map<string, TechFileLink>()
  const missing: string[] = []
  for (const id of assetIds) {
    const cached = linkCache.get(id)
    if (cached && now - cached.at < URL_TTL_MS) result.set(id, cached.link)
    else missing.push(id)
  }
  if (missing.length) {
    const { data } = await httpsCallable<{ itemId: string; assetIds: string[] }, { files: TechFileLink[] }>(
      xtoolFirebase().functions,
      'techFileUrls',
    )({ itemId, assetIds: missing })
    for (const link of data.files) {
      linkCache.set(link.id, { link, at: now })
      result.set(link.id, link)
    }
  }
  return result
}

/** 파일 칸 비우기(모두 지우기) — Monday API에 파일 하나만 지우기가 없어 칸 전체를 비운다. */
export const clearTechFiles = (target: UploadTarget) =>
  httpsCallable<UploadTarget, { itemId: string | null }>(xtoolFirebase().functions, 'techClearFiles')(target)

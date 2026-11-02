import { collection, doc, getDoc, onSnapshot, orderBy, query, type Bytes } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useEffect, useSyncExternalStore } from 'react'
import { xtoolFirebase } from '@/xtool-auth/firebase'

// 설정 > 배경에 직원이 올린 사진 — 팀 모두가 골라 쓰고, 지우기는 올린 사람만(함수가 확인).
// 사진은 여기서 1MB 아래로 줄여 보내고 Firestore에 bytes로 들어간다. 목록(techBackgrounds)
// 에는 작은 미리보기만, 원본은 따로(techBackgroundImages) — 고른 사진만 내려받는다.
// 서버 쪽: functions-xtool/src/tech-boards/backgrounds.ts

const LIST = 'techBackgrounds'
const IMAGES = 'techBackgroundImages'

/** 줄인 원본의 한도 — 서버(MAX_BACKGROUND_BYTES 900KB)보다 조금 작게 */
const MAX_IMAGE_BYTES = 880 * 1024
/** 고를 수 있는 원본 크기 — 줄이기 전 */
const MAX_SOURCE_BYTES = 30 * 1024 * 1024
export const BACKGROUND_ACCEPT = 'image/jpeg,image/png,image/webp'

export interface SharedBackground {
  id: string
  name: string
  uploaderEmail: string
  uploaderName: string
  createdAt: number
  /** 타일 미리보기(data URL) */
  thumbUrl: string
}

// ── 목록(실시간) ─────────────────────────────────────────────────────────────

interface ListState {
  items: SharedBackground[] | null
  error: string | null
}

let list: ListState = { items: null, error: null }
let unsubscribe: (() => void) | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const dataUrl = (bytes: Bytes, type: string) => `data:${type};base64,${bytes.toBase64()}`

function ensureList() {
  if (unsubscribe) return
  const { db } = xtoolFirebase()
  unsubscribe = onSnapshot(
    query(collection(db, LIST), orderBy('createdAt', 'desc')),
    (snap) => {
      list = {
        error: null,
        items: snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            name: String(data.name ?? ''),
            uploaderEmail: String(data.uploaderEmail ?? ''),
            uploaderName: String(data.uploaderName ?? ''),
            createdAt: Number(data.createdAt ?? 0),
            thumbUrl: dataUrl(data.thumb as Bytes, String(data.thumbType ?? 'image/webp')),
          }
        }),
      }
      emit()
    },
    (error) => {
      unsubscribe?.()
      unsubscribe = null
      list = { items: list.items, error: error.code === 'permission-denied' ? '공유 배경을 볼 권한이 없어요.' : error.message }
      emit()
    },
  )
}

/** 팀이 공유한 배경 — 최근에 올린 것부터. 설정 화면에 들어올 때 구독을 시작한다. */
export function useSharedBackgrounds(): ListState {
  useEffect(() => ensureList(), [])
  return useSyncExternalStore(subscribe, () => list)
}

// ── 원본(고른 사진 한 장) ────────────────────────────────────────────────────
// 처음 한 번만 Firestore에서 받고 브라우저 캐시(Cache API)에 둔다 — 다음 방문·로그인
// 화면(아직 로그인 전이라 Firestore를 못 읽는다)에서도 바로 그린다. 캐시에서 꺼낸 경우엔
// 로그인돼 있으면 목록 문서가 아직 있는지 확인해서, 올린 사람이 지웠으면 내린다.

const CACHE_NAME = 'xtool-tech-backgrounds'
// Cache API 열쇠 — 실제로 요청하지 않는 같은 출처 주소
const cacheKey = (id: string) => `/__xtool-tech-backgrounds/${id}`

/** id → 그릴 주소(object URL). null이면 없는(지워진) 사진. 아직 모르면 열쇠가 없다. */
const images = new Map<string, string | null>()
const loading = new Set<string>()

async function readCache(id: string): Promise<Blob | null> {
  try {
    const hit = await (await caches.open(CACHE_NAME)).match(cacheKey(id))
    return hit ? await hit.blob() : null
  } catch {
    return null
  }
}

async function writeCache(id: string, blob: Blob) {
  try {
    await (await caches.open(CACHE_NAME)).put(cacheKey(id), new Response(blob, { headers: { 'Content-Type': blob.type } }))
  } catch {
    /* 캐시를 못 쓰면 다음에 다시 받는다 */
  }
}

async function dropCache(id: string) {
  try {
    await (await caches.open(CACHE_NAME)).delete(cacheKey(id))
  } catch {
    /* 없으면 그만 */
  }
}

function setImage(id: string, url: string | null) {
  const previous = images.get(id)
  if (previous && previous !== url) URL.revokeObjectURL(previous)
  images.set(id, url)
  emit()
}

async function verifyStillShared(id: string) {
  const { auth, db } = xtoolFirebase()
  if (!auth.currentUser) return
  try {
    const snap = await getDoc(doc(db, LIST, id))
    if (!snap.exists()) {
      await dropCache(id)
      setImage(id, null)
    }
  } catch {
    /* 권한·네트워크 오류면 그대로 둔다 */
  }
}

async function loadImage(id: string) {
  if (loading.has(id) || images.has(id)) return
  loading.add(id)
  try {
    const cached = await readCache(id)
    if (cached) {
      setImage(id, URL.createObjectURL(cached))
      void verifyStillShared(id)
      return
    }
    const snap = await getDoc(doc(xtoolFirebase().db, IMAGES, id))
    if (!snap.exists()) {
      setImage(id, null)
      return
    }
    const data = snap.data()
    const blob = new Blob([new Uint8Array((data.data as Bytes).toUint8Array())], { type: String(data.type ?? 'image/webp') })
    void writeCache(id, blob)
    setImage(id, URL.createObjectURL(blob))
  } catch {
    // 로그인 전(권한 없음)·네트워크 오류 — 다음에 다시 시도한다(기본 배경으로 그린다).
  } finally {
    loading.delete(id)
  }
}

/** 공유 사진 한 장의 주소 — 받는 중이거나 지워졌으면 null(기본 배경으로 그린다). */
export function useSharedBackgroundUrl(id: string | null): string | null {
  useEffect(() => {
    if (id) void loadImage(id)
  }, [id])
  return useSyncExternalStore(subscribe, () => (id ? (images.get(id) ?? null) : null))
}

// ── 올리기·지우기 ────────────────────────────────────────────────────────────

const canvasBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

/** 긴 변을 maxSide로 줄여 webp(안 되는 브라우저는 jpeg)로 */
async function encode(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('이 브라우저에서는 사진을 줄일 수 없어요')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const webp = await canvasBlob(canvas, 'image/webp', quality)
  if (webp?.type === 'image/webp') return webp
  const jpeg = await canvasBlob(canvas, 'image/jpeg', quality)
  if (!jpeg) throw new Error('사진을 줄이지 못했어요')
  return jpeg
}

const base64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error ?? new Error('사진을 읽지 못했어요'))
    reader.readAsDataURL(blob)
  })

/** 고른 파일 → 보낼 원본·미리보기. 문서 한도 안에 들 때까지 크기·화질을 낮춘다. */
async function prepare(file: File) {
  if (!BACKGROUND_ACCEPT.split(',').includes(file.type)) {
    throw new Error('JPG·PNG·WEBP 사진만 올릴 수 있어요(아이폰 HEIC는 JPG로 바꿔서 올려 주세요)')
  }
  if (file.size > MAX_SOURCE_BYTES) throw new Error('30MB보다 큰 사진은 올릴 수 없어요')
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('사진을 열지 못했어요')
  })
  try {
    let image: Blob | null = null
    for (const side of [2560, 2048, 1600]) {
      for (const quality of [0.82, 0.72, 0.62]) {
        const blob = await encode(bitmap, side, quality)
        if (blob.size <= MAX_IMAGE_BYTES) {
          image = blob
          break
        }
      }
      if (image) break
    }
    if (!image) throw new Error('사진이 너무 커서 줄이지 못했어요')
    const thumb = await encode(bitmap, 480, 0.72)
    return {
      name: file.name.replace(/\.[^.]+$/, '').trim(),
      image: await base64(image),
      thumb: await base64(thumb),
      width: bitmap.width,
      height: bitmap.height,
    }
  } finally {
    bitmap.close()
  }
}

/** 배경 사진 올리기 — 새 사진의 id */
export async function uploadSharedBackground(file: File): Promise<string> {
  const payload = await prepare(file)
  const { data } = await httpsCallable<typeof payload, { id: string }>(
    xtoolFirebase().functions,
    'techAddBackground',
  )(payload)
  return data.id
}

/** 배경 사진 지우기 — 올린 사람만(서버가 확인한다) */
export async function deleteSharedBackground(id: string): Promise<void> {
  await httpsCallable<{ id: string }, { ok: boolean }>(xtoolFirebase().functions, 'techDeleteBackground')({ id })
  await dropCache(id)
  setImage(id, null)
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TechBoardMeta, TechColumn, TechItemDoc } from '../../../data/tech-boards'
import type { TechFileLink } from '../../../data/tech-files'
import type { WaterFileActions, WaterFileTarget } from '../board/file-actions'

// 견본 파일 칸 — 물 파일 칸(WaterItemFiles)을 Monday 없이 돌려 보는 가짜 저장소. 올리기는 지연(빠르게 1.1초 ·
// 느리게 3.2초 + 붙이는 시간)과 실패(58%에서 끊김)를 고를 수 있고, 올린 파일은 이 탭 안에서만 목록에 붙는다
// (사진은 고른 파일 그대로 미리보기). 화면 안에서만 쓰는 견본 — 실제로 아무 데도 올리지 않는다.

/** 견본 보드의 파일 칸 둘 */
export const SAMPLE_FILE_COLUMNS: TechColumn[] = [
  { id: 'photos', title: '사진', type: 'file', writable: true },
  { id: 'docs', title: '서류', type: 'file', writable: true },
]

/** 다음 올리기 결과 */
export type SampleUploadMode = 'fast' | 'slow' | 'fail'

interface SampleFile {
  assetId: string
  name: string
  isImage: boolean
  url: string
}

/** itemId → 칸 id → 파일 */
type Store = Record<string, Record<string, SampleFile[]>>

// 견본 사진 — 회색 벽 톤의 흐린 사진(기기 몸체 + 렌즈) SVG
const photo = (hue: number, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},14%,74%)"/><stop offset="1" stop-color="hsl(${hue},12%,36%)"/></linearGradient></defs><rect width="320" height="320" fill="url(#g)"/><rect x="66" y="104" width="188" height="112" rx="16" fill="hsl(${hue},8%,20%)" opacity=".86"/><circle cx="160" cy="160" r="32" fill="hsl(${hue},18%,82%)" opacity=".72"/><text x="160" y="284" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#fff" opacity=".88">${label}</text></svg>`,
  )}`

// 견본 문서 — 새 탭으로 열리게 blob 주소(data: 주소는 브라우저가 새 탭에서 막는다). 한 번만 만든다
let docUrl: string | null = null
const sampleDocUrl = () => {
  docUrl ??= URL.createObjectURL(
    new Blob(['견본 문서예요 — 실제 파일이 아니에요.'], { type: 'text/plain;charset=utf-8' }),
  )
  return docUrl
}

const initialStore = (): Store => {
  const photos: SampleFile[] = [
    { assetId: 'p1', name: '증상 사진 1.jpg', isImage: true, url: photo(260, '증상 1') },
    { assetId: 'p2', name: '보드 사진.jpg', isImage: true, url: photo(30, '보드') },
    { assetId: 'p3', name: '레이저 헤드.heic', isImage: true, url: 'data:image/heic;base64,AAAA' },
  ]
  const docs: SampleFile[] = [
    { assetId: 'd1', name: '견적서.pdf', isImage: false, url: sampleDocUrl() },
    { assetId: 'd2', name: '작동 영상.mp4', isImage: false, url: sampleDocUrl() },
  ]
  return {
    demo: { photos, docs },
    s1: { photos, docs },
    s2: { photos: photos.slice(0, 1), docs: [] },
    s3: { photos: [], docs: docs.slice(0, 1) },
  }
}

const docOf = (itemId: string, store: Store): TechItemDoc =>
  ({
    itemId,
    boardKey: 'repair',
    boardId: '0',
    name: '',
    groupId: null,
    record: {},
    values: Object.fromEntries(
      SAMPLE_FILE_COLUMNS.map((c) => [
        c.id,
        {
          text: '',
          value: JSON.stringify({
            files: (store[itemId]?.[c.id] ?? []).map((f) => ({
              assetId: f.assetId,
              name: f.name,
              isImage: f.isImage,
              fileType: 'ASSET',
            })),
          }),
        },
      ]),
    ),
    createdAt: null,
    updatedAt: null,
    syncedAt: 0,
  }) as unknown as TechItemDoc

/**
 * 견본 파일 저장소 — base 보드 정보에 파일 칸 둘을 더한 meta, 항목 찾기(itemOf), 가짜 일(actions: 올리기·비우기·
 * 주소)과 다음 올리기 결과(mode). actions는 한 번 만든 것을 계속 돌려준다(물 파일 칸의 주소 받기가 다시 돌지 않게).
 */
export function useSampleFiles(base: TechBoardMeta) {
  const [store, setStore] = useState<Store>(initialStore)
  const [mode, setMode] = useState<SampleUploadMode>('fast')
  const modeRef = useRef(mode)
  const storeRef = useRef(store)
  const timers = useRef(new Set<number>())
  const objectUrls = useRef<string[]>([])
  const nextId = useRef(1)

  useEffect(() => {
    modeRef.current = mode
    storeRef.current = store
  })

  // 떼어질 때 — 기다리던 가짜 일을 멈추고 고른 파일 미리보기 주소를 돌려준다
  useEffect(() => {
    const waits = timers.current
    const urls = objectUrls.current
    return () => {
      waits.forEach((t) => window.clearTimeout(t))
      waits.clear()
      urls.forEach((u) => URL.revokeObjectURL(u))
      urls.length = 0
    }
  }, [])

  const actions = useMemo<WaterFileActions>(() => {
    const later = (ms: number, run: () => void) => {
      const t = window.setTimeout(() => {
        timers.current.delete(t)
        run()
      }, ms)
      timers.current.add(t)
    }
    const add = (target: WaterFileTarget, file: File) => {
      const url = URL.createObjectURL(file)
      objectUrls.current.push(url)
      const entry: SampleFile = {
        assetId: `up${nextId.current++}`,
        name: file.name,
        isImage: file.type.startsWith('image/'),
        url,
      }
      setStore((s) => ({
        ...s,
        [target.itemId]: {
          ...s[target.itemId],
          [target.columnId]: [...(s[target.itemId]?.[target.columnId] ?? []), entry],
        },
      }))
    }
    return {
      // 80ms마다 진행 — 빠르게 1.1초·느리게 3.2초에 다 보내고, 붙이는 데 0.35·0.9초. 실패는 58%에서 끊긴다
      upload: (target, file, onProgress) =>
        new Promise<void>((resolve, reject) => {
          const m = modeRef.current
          const total = m === 'slow' ? 3200 : 1100
          let elapsed = 0
          const step = () => {
            elapsed += 80
            const ratio = Math.min(1, elapsed / total)
            onProgress(ratio)
            if (m === 'fail' && ratio >= 0.58) {
              reject(new Error('견본: 연결이 끊겼어요(일부러 실패)'))
              return
            }
            if (ratio >= 1) {
              later(m === 'slow' ? 900 : 350, () => {
                add(target, file)
                resolve()
              })
              return
            }
            later(80, step)
          }
          later(80, step)
        }),
      clear: (target) =>
        new Promise<void>((resolve, reject) => {
          const m = modeRef.current
          later(700, () => {
            if (m === 'fail') {
              reject(new Error('견본: 지우지 못했어요(일부러 실패)'))
              return
            }
            setStore((s) => ({ ...s, [target.itemId]: { ...s[target.itemId], [target.columnId]: [] } }))
            resolve()
          })
        }),
      // 주소는 0.45초 뒤에 — 그동안 썸네일 자리는 빈 홈
      links: (itemId, assetIds) =>
        new Promise<Map<string, TechFileLink>>((resolve) => {
          later(450, () => {
            const all = Object.values(storeRef.current[itemId] ?? {}).flat()
            const map = new Map<string, TechFileLink>()
            for (const id of assetIds) {
              const f = all.find((x) => x.assetId === id)
              if (f) {
                map.set(id, {
                  id,
                  name: f.name,
                  url: f.url,
                  thumbnail: null,
                  extension: f.name.split('.').pop() ?? null,
                  size: null,
                })
              }
            }
            resolve(map)
          })
        }),
    }
  }, [])

  const meta = useMemo<TechBoardMeta>(() => ({ ...base, columns: [...base.columns, ...SAMPLE_FILE_COLUMNS] }), [base])
  const itemOf = useCallback((itemId: string) => docOf(itemId, store), [store])
  const reset = useCallback(() => setStore(initialStore()), [])

  return { meta, itemOf, actions, mode, setMode, reset }
}

/** 견본 사진 파일 하나(캔버스로 그린 PNG) — "견본 사진 놓기" */
export async function samplePhotoFile(n: number): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = 480
  canvas.height = 360
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 480, 360)
    g.addColorStop(0, '#cdcbd0')
    g.addColorStop(1, '#6f6d72')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 480, 360)
    ctx.fillStyle = 'rgba(40, 38, 44, 0.85)'
    ctx.fillRect(110, 120, 260, 130)
    ctx.fillStyle = 'rgba(220, 218, 224, 0.75)'
    ctx.beginPath()
    ctx.arc(240, 185, 38, 0, Math.PI * 2)
    ctx.fill()
  }
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  return new File([blob ?? new Blob()], `견본 사진 ${n}.png`, { type: 'image/png' })
}

/**
 * 파일을 그 칸에 끌어다 놓은 것처럼 — 진짜 끌어다 놓기 이벤트(DataTransfer)를 칸 가운데에 보낸다(견본 단추·검사)
 */
export function dropOn(zone: Element, file: File) {
  const dt = new DataTransfer()
  dt.items.add(file)
  const r = zone.getBoundingClientRect()
  const init: DragEventInit = {
    bubbles: true,
    cancelable: true,
    dataTransfer: dt,
    clientX: r.left + r.width / 2,
    clientY: r.top + Math.min(r.height / 2, 80),
  }
  zone.dispatchEvent(new DragEvent('dragenter', init))
  zone.dispatchEvent(new DragEvent('dragover', init))
  zone.dispatchEvent(new DragEvent('drop', init))
}

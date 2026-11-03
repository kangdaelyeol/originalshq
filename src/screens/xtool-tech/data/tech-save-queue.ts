import { useSyncExternalStore } from 'react'
import { clearTechFiles, uploadTechFile, type UploadTarget } from './tech-files'

// 토스트와 파일 올리기 — 항목 수정·만들기·지우기·옮기기는 저장 대기열(tech-outbox.ts)이 조용히
// 보내고 실패만 여기 토스트로 알린다. 파일은 오래 걸려 진행률을 토스트로 보여 준다.

export type ToastTone = 'pending' | 'success' | 'error'

export interface Toast {
  id: number
  tone: ToastTone
  title: string
  message?: string
  action?: { label: string; run: () => void }
}

// 성공 토스트가 떠 있는 시간
const SUCCESS_MS = 2600

let toasts: readonly Toast[] = []
let pending: ReadonlySet<string> = new Set()
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const upsertToast = (toast: Toast) => {
  toasts = toasts.some((t) => t.id === toast.id) ? toasts.map((t) => (t.id === toast.id ? toast : t)) : [...toasts, toast]
  emit()
}

/** 토스트 하나 띄우기 — 성공은 잠시 뒤 저절로 사라진다. 토스트 id를 돌려준다. */
export function pushToast(toast: Omit<Toast, 'id'>): number {
  const id = nextId++
  upsertToast({ ...toast, id })
  if (toast.tone === 'success') setTimeout(() => dismissToast(id), SUCCESS_MS)
  return id
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

/** 떠 있는 토스트 바꾸기(없어졌으면 다시 띄운다) */
export const setToast = (id: number, toast: Omit<Toast, 'id'>): void => upsertToast({ ...toast, id })

export const hasToast = (id: number): boolean => toasts.some((t) => t.id === id)

/** 저장 중인 item 표시 켜고 끄기 — 유리 화면 표 줄의 저장 표시 */
export const markSaving = (itemId: string | undefined, on: boolean): void => {
  if (!itemId) return
  const next = new Set(pending)
  if (on) next.add(itemId)
  else next.delete(itemId)
  pending = next
  emit()
}

/** 파일 하나를 뒤에서 올린다 — 토스트에 진행률, 실패하면 "다시 시도". */
export function uploadInBackground(target: UploadTarget, file: File): void {
  const id = nextId++
  upsertToast({ id, tone: 'pending', title: `${file.name} 올리는 중… 0%` })
  markSaving(target.itemId, true)
  uploadTechFile(target, file, (ratio) =>
    // 다 보낸 뒤 Monday에 붙이는 동안은 99%에 머문다.
    upsertToast({ id, tone: 'pending', title: `${file.name} 올리는 중… ${Math.min(99, Math.round(ratio * 100))}%` }),
  )
    .then(() => {
      upsertToast({ id, tone: 'success', title: `${file.name} 올렸어요` })
      setTimeout(() => dismissToast(id), SUCCESS_MS)
    })
    .catch((error: unknown) => {
      upsertToast({
        id,
        tone: 'error',
        title: `${file.name} 올리기에 실패했어요`,
        message: error instanceof Error ? error.message : String(error),
        action: {
          label: '다시 시도',
          run: () => {
            dismissToast(id)
            uploadInBackground(target, file)
          },
        },
      })
    })
    .finally(() => markSaving(target.itemId, false))
}

/** 파일 칸 비우기를 뒤에서 — label은 칸 이름(예: "파일") */
export function clearFilesInBackground(target: UploadTarget, label: string): void {
  const id = nextId++
  upsertToast({ id, tone: 'pending', title: `${label} 지우는 중…` })
  markSaving(target.itemId, true)
  clearTechFiles(target)
    .then(() => {
      upsertToast({ id, tone: 'success', title: `${label} 칸을 모두 지웠어요` })
      setTimeout(() => dismissToast(id), SUCCESS_MS)
    })
    .catch((error: unknown) => {
      upsertToast({
        id,
        tone: 'error',
        title: `${label} 지우기에 실패했어요`,
        message: (error instanceof Error ? error.message : String(error)).replace(/\s*\[\d+\]$/, ''),
        action: {
          label: '다시 시도',
          run: () => {
            dismissToast(id)
            clearFilesInBackground(target, label)
          },
        },
      })
    })
    .finally(() => markSaving(target.itemId, false))
}

export const useToasts = (): readonly Toast[] => useSyncExternalStore(subscribe, () => toasts)

/** 저장 중인 item id — 표 줄에 표시한다. */
export const usePendingSaves = (): ReadonlySet<string> => useSyncExternalStore(subscribe, () => pending)

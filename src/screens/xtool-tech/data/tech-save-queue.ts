import { useSyncExternalStore } from 'react'
import { createTechItem, updateTechItem, type TechEditInput } from './tech-boards'
import { clearTechFiles, uploadTechFile, type UploadTarget } from './tech-files'

// 저장을 기다리지 않는다 — 편집 패널은 바로 닫고 요청은 뒤에서 보낸다. 진행은 토스트로
// 보여 주고(저장 중 → 저장했어요), 실패하면 오류 토스트에 "다시 시도"를 붙인다. 실패는
// 서버가 수정 기록(techEditLogs)에도 남긴다. 저장이 끝나면 바뀐 값은 실시간 구독으로 온다.

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

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

const setPending = (itemId: string | undefined, on: boolean) => {
  if (!itemId) return
  const next = new Set(pending)
  if (on) next.add(itemId)
  else next.delete(itemId)
  pending = next
  emit()
}

/** 수정·생성을 뒤에서 보낸다. label은 토스트에 보일 항목 이름. */
export function saveInBackground(kind: 'update' | 'create', input: TechEditInput, label: string): void {
  const id = nextId++
  const verb = kind === 'create' ? '만들기' : '저장'
  upsertToast({ id, tone: 'pending', title: `${label} ${verb} 중…` })
  setPending(input.itemId, true)
  const request = kind === 'create' ? createTechItem(input) : updateTechItem(input)
  request
    .then(() => {
      upsertToast({ id, tone: 'success', title: kind === 'create' ? `${label} 만들었어요` : `${label} 저장했어요` })
      setTimeout(() => dismissToast(id), SUCCESS_MS)
    })
    .catch((error: unknown) => {
      upsertToast({
        id,
        tone: 'error',
        title: `${label} ${verb}에 실패했어요`,
        // 함수 오류 문구 끝의 상태 코드 꼬리표([500])는 뗀다.
        message: (error instanceof Error ? error.message : String(error)).replace(/\s*\[\d+\]$/, ''),
        action: {
          label: '다시 시도',
          run: () => {
            dismissToast(id)
            saveInBackground(kind, input, label)
          },
        },
      })
    })
    .finally(() => setPending(input.itemId, false))
}

/** 파일 하나를 뒤에서 올린다 — 토스트에 진행률, 실패하면 "다시 시도". */
export function uploadInBackground(target: UploadTarget, file: File): void {
  const id = nextId++
  upsertToast({ id, tone: 'pending', title: `${file.name} 올리는 중… 0%` })
  setPending(target.itemId, true)
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
    .finally(() => setPending(target.itemId, false))
}

/** 파일 칸 비우기를 뒤에서 — label은 칸 이름(예: "파일") */
export function clearFilesInBackground(target: UploadTarget, label: string): void {
  const id = nextId++
  upsertToast({ id, tone: 'pending', title: `${label} 지우는 중…` })
  setPending(target.itemId, true)
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
    .finally(() => setPending(target.itemId, false))
}

export const useToasts = (): readonly Toast[] => useSyncExternalStore(subscribe, () => toasts)

/** 저장 중인 item id — 표 줄에 표시한다. */
export const usePendingSaves = (): ReadonlySet<string> => useSyncExternalStore(subscribe, () => pending)

import { errorText } from '@xtool-core/error-text'
import type { TechBoardKey } from '@xtool-core/tech-boards'
import { clearTechFiles, uploadTechFile, type TechFileLink } from './tech-files'
import { dismissToast, hasToast, markSaving, pushToast, setToast, type Toast } from '@xtool-core/tech-save-queue'

// 파일 칸의 일(올리기·비우기) — 세 레이아웃(대시보드·Monday 표·물)의 파일 칸이 같이 쓴다: 상세 서랍의 파일
// (ItemFiles·WaterItemFiles), Monday 표의 파일 모달(FilesModal), 수정 패널의 파일 칸(FileField). 칸 안의 진행·
// 다시 시도·놓을 자리는 components/board/use-file-column.ts가 같이 그린다.

/** 파일 칸 하나(항목·칸·칸 이름 — 토스트 문구에 쓴다) */
export interface TechFileTarget {
  itemId: string
  columnId: string
  label: string
}

/**
 * 파일 칸의 일 — 주면 그 일을 할 수 있는 단추·놓을 자리가 생긴다(없으면 보기만). 견본은 가짜를 넘긴다
 * (components/water/catalog/sample-files.ts). 한 번 만든 것을 계속 넘긴다(주소 받기가 다시 돌지 않게).
 */
export interface TechFileActions {
  /**
   * 파일 하나 올리기 — 보낸 비율(0~1)을 알리고, Monday에 다 붙으면 풀린다(실패면 거부). 올리기 단추·끌어다 놓기.
   * onRetry는 실패 토스트의 "다시 시도"가 부를 일 — 칸이 제자리에서 다시 올리게 넘긴다(없으면 토스트가 혼자 다시 올린다)
   */
  upload?: (
    target: TechFileTarget,
    file: File,
    onProgress: (ratio: number) => void,
    onRetry?: () => void,
  ) => Promise<void>
  /**
   * 칸 비우기 — Monday API에 파일 하나만 지우기가 없어 칸 전체를 비운다("모두 지우기"). onRetry는 올리기와 같다
   * (실패 토스트의 "다시 시도"가 칸의 지우기를 다시 부른다)
   */
  clear?: (target: TechFileTarget, onRetry?: () => void) => Promise<void>
  /** 파일 임시 주소·썸네일 — 없으면 Monday(fetchFileLinks) */
  links?: (itemId: string, assetIds: string[]) => Promise<Map<string, TechFileLink>>
}

// 성공 토스트가 떠 있는 시간 — 저장소(tech-save-queue)와 같다
const SUCCESS_MS = 2600

// 실패해서 떠 있는 토스트 — 같은 일을 다시 하면(칸의 다시 시도·토스트의 다시 시도·같은 칸 다시 비우기) 새로 띄우지
// 않고 그 토스트를 "진행 중"으로 되돌려 쓴다. 올리기는 고른 파일(File)마다, 비우기는 칸마다
const failedUploads = new WeakMap<File, number>()
const failedClears = new Map<string, number>()

const reuseToast = (old: number | undefined, toast: Omit<Toast, 'id'>): number => {
  if (old === undefined || !hasToast(old)) return pushToast(toast)
  setToast(old, toast)
  return old
}

// 저장 표시(표 줄) — 한 항목에 여러 파일을 같이 올려도(여럿 놓기) 마지막 것이 끝날 때 끈다
const running = new Map<string, number>()
const hold = (itemId: string) => {
  running.set(itemId, (running.get(itemId) ?? 0) + 1)
  markSaving(itemId, true)
}
const release = (itemId: string) => {
  const left = (running.get(itemId) ?? 1) - 1
  if (left > 0) return void running.set(itemId, left)
  running.delete(itemId)
  markSaving(itemId, false)
}

/**
 * 실제 올리기·비우기(Monday) — 토스트(문구·진행률·"다시 시도")와 저장 표시를 내고, 칸 안에도 진행을 그리게
 * 진행률과 끝을 돌려준다. 토스트 문구는 예전 uploadInBackground·clearFilesInBackground와 같다.
 */
export function techFileActions(boardKey: TechBoardKey): TechFileActions {
  const upload: NonNullable<TechFileActions['upload']> = (target, file, onProgress, onRetry) => {
    const title = (percent: number) => `${file.name} 올리는 중… ${percent}%`
    const id = reuseToast(failedUploads.get(file), { tone: 'pending', title: title(0) })
    failedUploads.delete(file)
    hold(target.itemId)
    let percent = 0
    return uploadTechFile({ boardKey, itemId: target.itemId, columnId: target.columnId }, file, (ratio) => {
      onProgress(ratio)
      // 다 보낸 뒤 Monday에 붙이는 동안은 99%에 머문다. 토스트는 1%가 바뀔 때만 다시 그린다
      const next = Math.min(99, Math.round(ratio * 100))
      if (next === percent) return
      percent = next
      setToast(id, { tone: 'pending', title: title(next) })
    })
      .then(
        () => {
          setToast(id, { tone: 'success', title: `${file.name} 올렸어요` })
          setTimeout(() => dismissToast(id), SUCCESS_MS)
        },
        (error: unknown) => {
          failedUploads.set(file, id)
          setToast(id, {
            tone: 'error',
            title: `${file.name} 올리기에 실패했어요`,
            message: errorText(error),
            action: {
              label: '다시 시도',
              run: () => (onRetry ? onRetry() : void upload(target, file, () => {}).catch(() => {})),
            },
          })
          throw error
        },
      )
      .finally(() => release(target.itemId))
  }

  const clear: NonNullable<TechFileActions['clear']> = (target, onRetry) => {
    const key = `${boardKey}:${target.itemId}:${target.columnId}`
    const id = reuseToast(failedClears.get(key), { tone: 'pending', title: `${target.label} 지우는 중…` })
    failedClears.delete(key)
    hold(target.itemId)
    return clearTechFiles({ boardKey, itemId: target.itemId, columnId: target.columnId })
      .then(
        () => {
          setToast(id, { tone: 'success', title: `${target.label} 칸을 모두 지웠어요` })
          setTimeout(() => dismissToast(id), SUCCESS_MS)
        },
        (error: unknown) => {
          failedClears.set(key, id)
          setToast(id, {
            tone: 'error',
            title: `${target.label} 지우기에 실패했어요`,
            message: errorText(error),
            action: {
              label: '다시 시도',
              run: () => (onRetry ? onRetry() : void clear(target).catch(() => {})),
            },
          })
          throw error
        },
      )
      .finally(() => release(target.itemId))
  }

  return { upload, clear }
}

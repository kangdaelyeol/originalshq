import type { TechBoardKey } from '../../../data/tech-boards'
import { clearTechFiles, uploadTechFile, type TechFileLink } from '../../../data/tech-files'
import { dismissToast, markSaving, pushToast, setToast } from '../../../data/tech-save-queue'

/** 파일 칸 하나(항목·칸·칸 이름 — 토스트 문구에 쓴다) */
export interface WaterFileTarget {
  itemId: string
  columnId: string
  label: string
}

/**
 * 물 파일 칸(WaterItemFiles)의 일 — 주면 그 일을 할 수 있는 단추·자리가 생긴다(없으면 기존 ItemFiles처럼 보기만).
 * 견본은 가짜를 넘긴다(catalog/sample-files.ts). 한 번 만든 것을 계속 넘긴다(주소 받기가 다시 돌지 않게).
 */
export interface WaterFileActions {
  /** 파일 하나 올리기 — 보낸 비율(0~1)을 알리고, Monday에 다 붙으면 풀린다(실패면 거부). 올리기 단추·끌어다 놓기 */
  upload?: (target: WaterFileTarget, file: File, onProgress: (ratio: number) => void) => Promise<void>
  /** 칸 비우기 — Monday API에 파일 하나만 지우기가 없어 칸 전체를 비운다("모두 지우기") */
  clear?: (target: WaterFileTarget) => Promise<void>
  /** 파일 임시 주소·썸네일 — 없으면 Monday(fetchFileLinks) */
  links?: (itemId: string, assetIds: string[]) => Promise<Map<string, TechFileLink>>
}

// 성공 토스트가 떠 있는 시간 — 저장소(tech-save-queue)와 같다
const SUCCESS_MS = 2600

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/**
 * 실제 올리기·비우기(Monday) — 기존 uploadInBackground·clearFilesInBackground와 같은 토스트(문구·진행률·
 * "다시 시도")와 저장 표시를 그대로 내고, 물 파일 칸이 칸 안에도 진행을 그리게 진행률과 끝을 돌려준다.
 */
export function techFileActions(boardKey: TechBoardKey): WaterFileActions {
  const upload: NonNullable<WaterFileActions['upload']> = (target, file, onProgress) => {
    const id = pushToast({ tone: 'pending', title: `${file.name} 올리는 중… 0%` })
    markSaving(target.itemId, true)
    return uploadTechFile({ boardKey, itemId: target.itemId, columnId: target.columnId }, file, (ratio) => {
      onProgress(ratio)
      // 다 보낸 뒤 Monday에 붙이는 동안은 99%에 머문다(기존 토스트와 같다)
      setToast(id, { tone: 'pending', title: `${file.name} 올리는 중… ${Math.min(99, Math.round(ratio * 100))}%` })
    })
      .then(
        () => {
          setToast(id, { tone: 'success', title: `${file.name} 올렸어요` })
          setTimeout(() => dismissToast(id), SUCCESS_MS)
        },
        (error: unknown) => {
          setToast(id, {
            tone: 'error',
            title: `${file.name} 올리기에 실패했어요`,
            message: messageOf(error),
            action: {
              label: '다시 시도',
              run: () => {
                dismissToast(id)
                void upload(target, file, () => {}).catch(() => {})
              },
            },
          })
          throw error
        },
      )
      .finally(() => markSaving(target.itemId, false))
  }

  const clear: NonNullable<WaterFileActions['clear']> = (target) => {
    const id = pushToast({ tone: 'pending', title: `${target.label} 지우는 중…` })
    markSaving(target.itemId, true)
    return clearTechFiles({ boardKey, itemId: target.itemId, columnId: target.columnId })
      .then(
        () => {
          setToast(id, { tone: 'success', title: `${target.label} 칸을 모두 지웠어요` })
          setTimeout(() => dismissToast(id), SUCCESS_MS)
        },
        (error: unknown) => {
          setToast(id, {
            tone: 'error',
            title: `${target.label} 지우기에 실패했어요`,
            message: messageOf(error).replace(/\s*\[\d+\]$/, ''),
            action: {
              label: '다시 시도',
              run: () => {
                dismissToast(id)
                void clear(target).catch(() => {})
              },
            },
          })
          throw error
        },
      )
      .finally(() => markSaving(target.itemId, false))
  }

  return { upload, clear }
}

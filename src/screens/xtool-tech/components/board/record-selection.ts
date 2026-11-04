import { useCallback, useMemo, useState } from 'react'

// 표에서 고른 줄(체크) — 대시보드·물 기록 표가 같이 쓰고, 아래 고르기 막대가 이걸 보고 이동·삭제를 한다
// (Monday 표의 줄 선택과 같은 기능). 표 하나(보드 하나)에서만 고르니 열쇠는 항목 id.

export const DELETE_CONFIRM_MESSAGE = 'Monday 휴지통으로 가요. 30일 안에는 Monday에서 되살릴 수 있어요.'

export interface RecordSelection {
  /** 고른 줄 — 지금 표에 있는 것만(지운 줄은 저절로 빠진다) */
  selected: ReadonlySet<string>
  /** 켜거나 끄기 — 여러 개를 한 번에(보이는 줄 전체) */
  set: (itemIds: readonly string[], on: boolean) => void
  clear: () => void
}

/** ids는 이 보드의 모든 항목 id — 지우거나 다른 곳에서 사라진 줄은 고른 것에서 빠진다 */
export function useRecordSelection(ids: readonly string[]): RecordSelection {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set())
  const selected = useMemo(() => {
    if (picked.size === 0) return picked
    const have = new Set(ids)
    return new Set([...picked].filter((id) => have.has(id)))
  }, [picked, ids])
  const set = useCallback((itemIds: readonly string[], on: boolean) => {
    setPicked((prev) => {
      const next = new Set(prev)
      for (const id of itemIds) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])
  const clear = useCallback(() => setPicked(new Set()), [])
  return { selected, set, clear }
}

/** 기록마다 펼치는 메모·파일의 상태 — MondayDetail이 내려주고 RecordUpdates가
 * 읽는다. 컴포넌트가 아니라 따로 둔다(빠른 새로고침 규칙). */
import { createContext } from 'react'
import type { ItemUpdatesState } from '@/screens/xtool-lead-manager/view-model'

/** 기록마다 펼치는 메모·파일 — 받아 둔 것과 받는 함수. MondayDetail이 내려준다. */
export const UpdatesContext = createContext<{
  states: Record<string, ItemUpdatesState>
  load: (itemId: string, force?: boolean) => void
} | null>(null)

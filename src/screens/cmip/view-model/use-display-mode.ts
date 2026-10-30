import { oneOf, usePersistentState } from '@/hooks/use-persistent-state'

export type DisplayMode = 'chart' | 'table'

/** 섹션마다 [그래프 | 표] — 이 브라우저에 남는다. 그래프가 기본(표는 정확한
 * 값이 필요할 때). */
export const useDisplayMode = (storageKey: string) =>
  usePersistentState<DisplayMode>(
    storageKey,
    'chart',
    oneOf<DisplayMode>(['chart', 'table']),
  )

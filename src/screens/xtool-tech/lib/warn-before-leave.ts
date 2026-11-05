import { useEffect } from 'react'
import { useSyncStatus } from '@xtool-core/tech-outbox'

const warn = (e: BeforeUnloadEvent) => e.preventDefault()

/** 안 보낸 수정이 있으면 창·탭을 닫기 전에 묻는다(저장 대기열 — xtool-core tech-outbox). */
export function useWarnBeforeLeave(): void {
  const saving = useSyncStatus().saving > 0
  useEffect(() => {
    if (!saving) return
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saving])
}

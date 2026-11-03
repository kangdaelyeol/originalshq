import { CloudCheck, LoaderCircle } from 'lucide-react'
import { useSyncStatus } from '../../data/tech-outbox'

/**
 * 저장 표시(상단바) — 고친 것은 화면에 바로 보이고 Monday에는 뒤에서 쓴다. 보내는 중이면 "저장 중 N건",
 * 다 보냈으면 "모두 저장됨". 이 탭에서 아직 고친 게 없으면 그리지 않는다. 실패는 토스트로 따로 알린다.
 */
export function SyncStatus() {
  const { saving, savedAt } = useSyncStatus()
  if (saving > 0) {
    return (
      <span className="sync-status is-saving" role="status">
        <LoaderCircle size={14} className="is-spinning" aria-hidden />
        저장 중 {saving}건
      </span>
    )
  }
  if (savedAt === null) return null
  return (
    <span className="sync-status" role="status" title="고친 것을 모두 Monday에 저장했어요">
      <CloudCheck size={15} aria-hidden />
      모두 저장됨
    </span>
  )
}

import { Outlet } from 'react-router-dom'
import { AdminGate } from '@/xtool-auth/admin-gate'

/** /cmip — xtool 관리자만 본다(AdminGate). functions-cmip도 같은 기준으로
 * 요청마다 다시 확인한다(auth.ts). */
export const CmipPage = () => {
  return (
    <AdminGate
      title="CMIP"
      lead="광고비·매출·광고 설정이 있어 xtool 관리자만 볼 수 있어요."
    >
      <Outlet />
    </AdminGate>
  )
}

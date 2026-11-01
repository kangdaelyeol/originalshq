import { KeyRound } from 'lucide-react'
import { ComingSoonPage } from './coming-soon-page'

// 샘플 영상에 없던 메뉴 자리 — 레이아웃이 정해지면 바꾼다.

export function SecurityPage() {
  return (
    <ComingSoonPage
      icon={KeyRound}
      title="보안 & 키"
      description="API 키·접근 권한 관리 화면 자리예요. 샘플 영상에 없는 화면이라 레이아웃이 정해지면 채울게요."
    />
  )
}

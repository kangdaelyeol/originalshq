import { useAppearance } from '../appearance/appearance'
import { BackgroundArt } from './background-art'

/**
 * 화면 뒤에 고정된 배경 — 외관 설정에서 고른 배경을 지금 쓰는 강조색으로 칠한다. shared(팀이 올린 사진)는 앱이
 * 주소를 찾아 photoUrl로 넘긴다(아직 없으면 기본 배경). 유리 카드가 이걸 흐려서 비추는 게 핵심이라, 여기
 * 색·빛이 곧 "유리 느낌"의 재료다.
 */
export function ScreenBackground({ photoUrl = null }: { photoUrl?: string | null }) {
  const { background, accentInUse } = useAppearance()
  return (
    <div className="app-bg" aria-hidden>
      <BackgroundArt kind={background} accent={accentInUse} photoUrl={photoUrl} />
    </div>
  )
}

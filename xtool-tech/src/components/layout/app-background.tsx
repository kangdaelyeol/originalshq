import { useSettings } from '../../settings/settings'
import { BackgroundArt } from '../backgrounds/background-art'

/** 화면 뒤에 고정된 배경 — 설정에서 고른 배경을, 지금 쓰는 강조색으로 칠한다.
 * 유리 카드가 이걸 흐려서 비추는 게 핵심이라, 여기 색·빛이 곧 "유리 느낌"의 재료다. */
export function AppBackground() {
  const { background, accentInUse } = useSettings()
  return (
    <div className="app-bg" aria-hidden>
      <BackgroundArt kind={background} accent={accentInUse} />
    </div>
  )
}

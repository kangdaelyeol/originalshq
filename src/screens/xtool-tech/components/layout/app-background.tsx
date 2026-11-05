import { useAppearance } from '@/ohq-ui/appearance/appearance'
import { BackgroundArt } from '@/ohq-ui/backgrounds/background-art'
import { ScreenBackground } from '@/ohq-ui/backgrounds/screen-background'
import { DEFAULT_ACCENT } from '@/ohq-ui/theme/accent'
import { useSharedBackgroundUrl } from '../../data/tech-backgrounds'

/**
 * 화면 배경 — 공용 배경(ScreenBackground)에, 팀이 공유한 사진을 골랐으면 그 주소를 찾아 넘긴다. Monday 표는 테마가
 * 배경을 숨기고 Monday 바탕색을 쓰는데, 배경 사진(mondayPhotoId)을 골랐으면 그 사진만 깐다.
 */
export function AppBackground() {
  const { theme, background, sharedBackgroundId, mondayPhotoId } = useAppearance()
  const monday = theme === 'monday'
  const photoUrl = useSharedBackgroundUrl(monday ? mondayPhotoId : background === 'shared' ? sharedBackgroundId : null)
  if (monday) {
    return photoUrl ? (
      <div className="app-bg app-bg--photo" aria-hidden>
        <BackgroundArt kind="shared" accent={DEFAULT_ACCENT} photoUrl={photoUrl} />
      </div>
    ) : null
  }
  return <ScreenBackground photoUrl={photoUrl} />
}

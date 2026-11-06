import { useAppearance } from '@/ohq-ui/appearance/appearance'
import { BackgroundArt } from '@/ohq-ui/backgrounds/background-art'
import { ScreenBackground } from '@/ohq-ui/backgrounds/screen-background'
import { cx } from '@/ohq-ui/lib/cx'
import { DEFAULT_ACCENT } from '@/ohq-ui/theme/accent'
import { useSharedBackgroundUrl } from '@/screens/xtool-tech/data/tech-backgrounds'
import { useWaterLayout } from '@/screens/xtool-tech/water-layout/load'

/**
 * 관리 화면 배경 — 기술팀 보드와 같은 외관 설정을 디자인대로 깐다. 유리는 공용 배경(공유 사진을 골랐으면 그 사진),
 * Monday는 바탕색(배경 사진을 골랐으면 그 사진만), 물은 타일 벽(벽 아래 사진을 골랐으면 반투명 벽 밑에 사진). 물 벽은
 * 물 부품 묶음을 받은 뒤에만 — 받기 전(로그인 화면 등)에는 유리 배경을 깐다.
 */
export function AdminBackground() {
  const { theme, background, sharedBackgroundId, mondayPhotoId, water } = useAppearance()
  const waterParts = useWaterLayout()
  const onWall = theme === 'water' && waterParts !== null
  const photoId =
    theme === 'monday' ? mondayPhotoId : onWall ? water.photoId : background === 'shared' ? sharedBackgroundId : null
  const photoUrl = useSharedBackgroundUrl(photoId)

  if (onWall) {
    return (
      <>
        {photoUrl && <div className="admin-water-photo" style={{ backgroundImage: `url("${photoUrl}")` }} aria-hidden />}
        <div className={cx('water-stage admin-water-stage', photoUrl && 'has-photo')} aria-hidden />
      </>
    )
  }
  if (theme === 'monday') {
    return photoUrl ? (
      <div className="app-bg app-bg--photo" aria-hidden>
        <BackgroundArt kind="shared" accent={DEFAULT_ACCENT} photoUrl={photoUrl} />
      </div>
    ) : null
  }
  return <ScreenBackground photoUrl={photoUrl} />
}

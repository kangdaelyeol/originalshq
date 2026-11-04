import { useAppearance } from '@/ohq-ui/appearance/appearance'
import { ScreenBackground } from '@/ohq-ui/backgrounds/screen-background'
import { useSharedBackgroundUrl } from '@/screens/xtool-tech/data/tech-backgrounds'

/** 관리 화면 배경 — 기술팀 보드와 같은 외관 설정(공용 배경)에, 팀이 공유한 사진을 골랐으면 그 주소를 찾아 넘긴다. */
export function AdminBackground() {
  const { background, sharedBackgroundId } = useAppearance()
  const photoUrl = useSharedBackgroundUrl(background === 'shared' ? sharedBackgroundId : null)
  return <ScreenBackground photoUrl={photoUrl} />
}

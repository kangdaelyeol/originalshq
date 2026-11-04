import { useAppearance } from '@/ohq-ui/appearance/appearance'
import { ScreenBackground } from '@/ohq-ui/backgrounds/screen-background'
import { useSharedBackgroundUrl } from '../../data/tech-backgrounds'

/** 화면 배경 — 공용 배경(ScreenBackground)에, 팀이 공유한 사진을 골랐으면 그 주소를 찾아 넘긴다. */
export function AppBackground() {
  const { background, sharedBackgroundId } = useAppearance()
  const photoUrl = useSharedBackgroundUrl(background === 'shared' ? sharedBackgroundId : null)
  return <ScreenBackground photoUrl={photoUrl} />
}

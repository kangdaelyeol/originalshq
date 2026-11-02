import {
  LiquidBriefcaseIcon,
  LiquidCardsIcon,
  LiquidMicIcon,
  LiquidTrendingIcon,
  LiquidUserIcon,
} from './liquid-menu-icons'
import type { LiquidMenuItem } from './liquid-menu-data'

/** 영상의 다섯 항목 — 라벨은 영상 글자 그대로(F140 Activity, F170 Cards, F200 Work, F230 Voice, F1 Profile) */
export const LIQUID_MENU_ITEMS: readonly LiquidMenuItem[] = [
  { key: 'activity', label: 'Activity', icon: LiquidTrendingIcon },
  { key: 'cards', label: 'Cards', icon: LiquidCardsIcon },
  { key: 'work', label: 'Work', icon: LiquidBriefcaseIcon },
  { key: 'voice', label: 'Voice', icon: LiquidMicIcon },
  { key: 'profile', label: 'Profile', icon: LiquidUserIcon },
]

// 견본 이름표 — 함수 이름(Icon.name)은 배포 빌드에서 줄어들어서 따로 적는다.
export const LIQUID_ICON_NAMES: Record<string, string> = {
  activity: 'LiquidTrendingIcon',
  cards: 'LiquidCardsIcon',
  work: 'LiquidBriefcaseIcon',
  voice: 'LiquidMicIcon',
  profile: 'LiquidUserIcon',
}

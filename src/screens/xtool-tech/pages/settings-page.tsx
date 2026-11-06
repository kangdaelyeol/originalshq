import { AppearanceSettings } from './settings/appearance-settings'
import { ProfilePhotoCard } from './settings/profile-photo-card'
import { VersionCard } from './settings/version-card'

/**
 * 설정 — 프로필 사진, 외관 설정(레이아웃·배경·강조색·유리 효과 — 관리 화면과 같이 쓰는 AppearanceSettings), 맨 아래
 * 버전 정보.
 */
export function SettingsPage() {
  return (
    <>
      <ProfilePhotoCard />

      <AppearanceSettings />

      <VersionCard />
    </>
  )
}

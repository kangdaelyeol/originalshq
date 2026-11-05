import { useState } from 'react'
import { useAppearance } from '@/ohq-ui/appearance/appearance'
import { uploadSharedBackground, useSharedBackgrounds, useSharedBackgroundUrl } from '../data/tech-backgrounds'
import { pushToast } from '../data/tech-save-queue'
import { errorText } from '../lib/error-text'
import { useLayoutKind } from '../lib/layout-kind'
import { useWaterLayout } from '../water-layout/load'
import { AccentCard } from './settings/accent-card'
import { BackgroundCard } from './settings/background-card'
import { GlassEffectCard } from './settings/glass-effect-card'
import { LayoutCard } from './settings/layout-card'
import { ProfilePhotoCard } from './settings/profile-photo-card'
import { VersionCard } from './settings/version-card'

/**
 * 설정 — 프로필 사진·레이아웃 카드, 유리·물 디자인이면 그 디자인의 배경·강조색·유리 효과 카드, 맨 아래 버전 정보
 * (카드는 pages/settings/, 물 카드는 components/water/settings). 카드의
 * 부품(GlassCard·Button·Avatar)은 components/layout-parts에서 받아 물 레이아웃이면 물 부품으로 바뀐다.
 */
export function SettingsPage() {
  const { background, sharedBackgroundId, setSharedBackground } = useAppearance()
  const { design } = useLayoutKind()
  // 공유 사진 목록·고른 공유 사진은 화면이 받는다 — 배경·유리 카드는 대시보드에서만 그리지만 Monday 표·물에서도
  // 미리 받아 두어, 대시보드로 바꾸면 바로 보이게
  const shared = useSharedBackgrounds()
  const sharedUrl = useSharedBackgroundUrl(background === 'shared' ? sharedBackgroundId : null)
  // 사진 올리기도 화면이 한다 — 올리는 동안 레이아웃을 바꿨다 돌아와도 "올리는 중"이 남게
  const [uploading, setUploading] = useState(false)

  const upload = (file: File) => {
    setUploading(true)
    uploadSharedBackground(file)
      .then((id) => {
        setSharedBackground(id)
        pushToast({ tone: 'success', title: '배경 사진을 공유했어요' })
      })
      .catch((error: unknown) => pushToast({ tone: 'error', title: '사진을 올리지 못했어요', message: errorText(error) }))
      .finally(() => setUploading(false))
  }

  // 배경·강조색·유리 효과 — 유리 디자인은 유리 카드, 물 디자인은 물 카드(벽 색조·강조색·깊이·테두리, 물 묶음 안).
  // Monday는 자기 판 색이라 없다.
  const glass = design === 'glass'
  const water = useWaterLayout()
  return (
    <>
      <ProfilePhotoCard />

      <LayoutCard />

      {glass && (
        <>
          <BackgroundCard shared={shared} uploading={uploading} onUpload={upload} />

          <AccentCard />

          <GlassEffectCard photoUrl={sharedUrl} />
        </>
      )}

      {water && (
        <>
          <water.WaterWallCard />

          <water.WaterAccentCard />

          <water.WaterEffectCard />
        </>
      )}

      <VersionCard />
    </>
  )
}

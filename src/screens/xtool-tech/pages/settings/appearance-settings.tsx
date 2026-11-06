import { useState } from 'react'
import { useAppearance } from '@/ohq-ui/appearance/appearance'
import { uploadSharedBackground, useSharedBackgrounds, useSharedBackgroundUrl } from '../../data/tech-backgrounds'
import { pushToast } from '@xtool-core/tech-save-queue'
import { errorText } from '@xtool-core/error-text'
import { useLayoutKind } from '../../lib/layout-kind'
import { useWaterLayout } from '../../water-layout/load'
import { AccentCard } from './accent-card'
import { BackgroundCard } from './background-card'
import { GlassEffectCard } from './glass-effect-card'
import { LayoutCard } from './layout-card'
import { MondayPhotoCard } from './monday-photo-card'

interface AppearanceSettingsProps {
  /** tech 화면에서만 쓰는 고르기(Monday 표의 개요 보드) — 관리 화면은 끈다 */
  techOptions?: boolean
}

/**
 * 외관 설정 — 레이아웃 카드와, 유리·물 디자인이면 그 디자인의 배경·강조색·유리 효과 카드, Monday면 배경 사진 카드
 * (카드는 pages/settings/, 물 카드는 components/water/settings). tech 설정 화면과 관리 화면(xtool-admin 설정 탭)이
 * 같이 쓴다 — 값도 같은 외관 설정이다. 카드의 부품(GlassCard·Button·Avatar)은 basic-parts에서 받아 물 디자인이면
 * 물 부품으로 바뀐다.
 */
export function AppearanceSettings({ techOptions = true }: AppearanceSettingsProps) {
  const { background, sharedBackgroundId, setSharedBackground, setMondayPhoto, setWater } = useAppearance()
  const { design } = useLayoutKind()
  // 공유 사진 목록·고른 공유 사진은 화면이 받는다 — 배경·유리 카드는 대시보드에서만 그리지만 Monday 표·물에서도
  // 미리 받아 두어, 대시보드로 바꾸면 바로 보이게
  const shared = useSharedBackgrounds()
  const sharedUrl = useSharedBackgroundUrl(background === 'shared' ? sharedBackgroundId : null)
  // 사진 올리기도 화면이 한다 — 올리는 동안 레이아웃을 바꿨다 돌아와도 "올리는 중"이 남게
  const [uploading, setUploading] = useState(false)

  // 올린 사진은 팀 목록에 들어가고, 올린 레이아웃(유리·Monday·물)의 배경으로 바로 고른다
  const uploadAs = (select: (id: string) => void) => (file: File) => {
    setUploading(true)
    uploadSharedBackground(file)
      .then((id) => {
        select(id)
        pushToast({ tone: 'success', title: '배경 사진을 공유했어요' })
      })
      .catch((error: unknown) => pushToast({ tone: 'error', title: '사진을 올리지 못했어요', message: errorText(error) }))
      .finally(() => setUploading(false))
  }

  // 배경·강조색·유리 효과 — 유리 디자인은 유리 카드, 물 디자인은 물 카드(벽 색조·사진·강조색·깊이·테두리, 물 묶음 안).
  // Monday는 판 색이 정해져 있어 배경 사진만 고른다. 팀이 공유한 사진은 세 디자인 모두에서 고를 수 있다(레이아웃마다 따로).
  const glass = design === 'glass'
  const water = useWaterLayout()
  return (
    <>
      <LayoutCard techOptions={techOptions} />

      {glass && (
        <>
          <BackgroundCard shared={shared} uploading={uploading} onUpload={uploadAs(setSharedBackground)} />

          <AccentCard />

          <GlassEffectCard photoUrl={sharedUrl} />
        </>
      )}

      {water && (
        <>
          <water.WaterWallCard
            shared={shared}
            uploading={uploading}
            onUpload={uploadAs((photoId) => setWater({ photoId }))}
          />

          <water.WaterAccentCard />

          <water.WaterEffectCard />
        </>
      )}

      {design === 'monday' && <MondayPhotoCard shared={shared} uploading={uploading} onUpload={uploadAs(setMondayPhoto)} />}
    </>
  )
}

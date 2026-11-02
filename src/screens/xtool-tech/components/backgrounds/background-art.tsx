import workshopPhoto from '../../assets/bg/bg-picture-1.webp'
import type { BackgroundKind } from '../../settings/settings'
import { Grunge } from './grunge'
import { SilkWaves } from './silk-waves'

/** 사진 한 장 배경 — 작업장 사진과 직원이 공유한 사진이 같이 쓴다. */
function PhotoArt({ url }: { url: string }) {
  return (
    <div className="bg-art bg-art--photo">
      <div className="bg-photo__image" style={{ backgroundImage: `url(${url})` }} />
      {/* 밝은 사진 위 유리 카드의 흰 글씨가 묻히지 않게 어둡게 누른다. */}
      <div className="bg-photo__scrim" />
      <div className="bg-art__vignette" />
    </div>
  )
}

/**
 * 배경 그림 한 장 — 부모를 꽉 채운다(position: absolute). 화면 배경(AppBackground)과
 * 설정의 미리보기 타일이 같은 컴포넌트를 쓴다. shared는 photoUrl(공유 사진)을 그리고,
 * 아직 받는 중이거나 지워졌으면 기본 배경(블랙 파편)을 그린다.
 */
export function BackgroundArt({
  kind,
  accent,
  photoUrl = null,
}: {
  kind: BackgroundKind
  accent: string
  photoUrl?: string | null
}) {
  switch (kind) {
    case 'shared':
      return photoUrl ? <PhotoArt url={photoUrl} /> : <BackgroundArt kind="shards" accent={accent} />
    case 'silk':
      return <SilkWaves accent={accent} />
    case 'grunge':
      return <Grunge accent={accent} />
    case 'photo':
      return <PhotoArt url={workshopPhoto} />
    case 'shards':
      return (
        <div className="bg-art bg-art--shards">
          <div className="bg-shards__image" />
          <div className="bg-shards__glow" />
          <div className="bg-shards__streaks" />
          <div className="bg-art__vignette" />
        </div>
      )
  }
}

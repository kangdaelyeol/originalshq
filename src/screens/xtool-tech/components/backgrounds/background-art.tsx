import photoUrl from '../../assets/bg/bg-picture-1.webp'
import type { BackgroundKind } from '../../settings/settings'
import { Grunge } from './grunge'
import { SilkWaves } from './silk-waves'

/**
 * 배경 그림 한 장 — 부모를 꽉 채운다(position: absolute). 화면 배경(AppBackground)과
 * 설정의 미리보기 타일이 같은 컴포넌트를 쓴다.
 */
export function BackgroundArt({ kind, accent }: { kind: BackgroundKind; accent: string }) {
  switch (kind) {
    case 'silk':
      return <SilkWaves accent={accent} />
    case 'grunge':
      return <Grunge accent={accent} />
    case 'photo':
      return (
        <div className="bg-art bg-art--photo">
          <div className="bg-photo__image" style={{ backgroundImage: `url(${photoUrl})` }} />
          {/* 밝은 사진 위 유리 카드의 흰 글씨가 묻히지 않게 어둡게 누른다. */}
          <div className="bg-photo__scrim" />
          <div className="bg-art__vignette" />
        </div>
      )
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

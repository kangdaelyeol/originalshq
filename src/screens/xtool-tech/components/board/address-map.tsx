import { ExternalLink, Navigation } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { kakaoMapLinks } from '@xtool-core/kakao-map'
import { cx } from '@/ohq-ui/lib/cx'
import { hasKakaoMapKey, loadKakaoMaps, type KakaoMap, type KakaoMarker } from '../../lib/kakao-maps'

// 지도를 처음 보여 줄 확대 정도(작을수록 가깝다) — 3이면 골목·건물이 보인다
const LEVEL = 3

interface AddressMapProps {
  address: string
  lat?: string
  lng?: string
  /** 물 레이아웃처럼 모양을 바꿀 때 */
  className?: string
}

/**
 * 주소 칸 아래 지도 — 좌표가 있으면 핀이 꽂힌 작은 카카오 지도(JavaScript 키가 있을 때, lib/kakao-maps)와
 * "카카오맵에서 보기"·"길찾기" 링크(키 없이 카카오맵을 연다). 좌표가 없으면 주소 글자로 찾는 링크만. 지도는 끌어
 * 옮길 수 있고 휠 확대는 끈다(편집 판·팝오버 스크롤을 빼앗지 않게). 대시보드·Monday 표·물 주소 칸이 같이 쓴다.
 */
export function AddressMap({ address, lat, lng, className }: AddressMapProps) {
  const links = kakaoMapLinks({ address, lat, lng })
  const hasCoords = Boolean(lat && lng && links?.route)
  const showMap = hasCoords && hasKakaoMapKey()
  const canvas = useRef<HTMLDivElement>(null)
  // 그린 지도 — 칸(el)이 다시 그려지면(지웠다 다시 고름 등) 새로 만든다
  const map = useRef<{ el: HTMLElement; map: KakaoMap; marker: KakaoMarker } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!showMap) return
    let cancelled = false
    loadKakaoMaps()
      .then((maps) => {
        const el = canvas.current
        if (cancelled || !el) return
        const center = new maps.LatLng(Number(lat), Number(lng))
        if (map.current?.el === el) {
          map.current.map.setCenter(center)
          map.current.marker.setPosition(center)
          return
        }
        const created = new maps.Map(el, { center, level: LEVEL, scrollwheel: false })
        map.current = { el, map: created, marker: new maps.Marker({ position: center, map: created }) }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [showMap, lat, lng])

  if (!links) return null
  return (
    <div className={cx('address-map', className)}>
      {showMap && !failed && (
        <div ref={canvas} className="address-map__canvas" role="img" aria-label={`${address} 지도`} />
      )}
      {showMap && failed && (
        <p className="address-map__failed">지도를 불러오지 못했어요 — 아래 링크로 카카오맵에서 볼 수 있어요.</p>
      )}
      <p className="address-map__links">
        <a href={links.view} target="_blank" rel="noreferrer">
          <ExternalLink size={13} aria-hidden />
          카카오맵에서 보기
        </a>
        {links.route && (
          <a href={links.route} target="_blank" rel="noreferrer">
            <Navigation size={13} aria-hidden />
            길찾기
          </a>
        )}
      </p>
    </div>
  )
}

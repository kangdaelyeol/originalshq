// 카카오 지도(JavaScript SDK) 불러오기 — 주소 칸 아래 작은 지도(components/board/address-map.tsx). 키는 카카오
// 디벨로퍼스의 JavaScript 키(주소 검색에 쓰는 REST 키와 다르다)를 .env의 VITE_KAKAO_JS_KEY로 넣는다. JavaScript
// 키는 화면 코드에 실려 보이지만 카카오 디벨로퍼스에 등록한 사이트 주소(JavaScript SDK 도메인)에서만 지도가
// 뜬다 — 개발 주소(http://localhost:5173 등)와 운영 주소를 둘 다 등록해야 한다. 키가 없으면 지도 없이 링크만.

/** 쓰는 만큼만 적은 카카오 지도 타입 */
export interface KakaoLatLng {
  getLat(): number
  getLng(): number
}

export interface KakaoMap {
  setCenter(position: KakaoLatLng): void
  relayout(): void
}

export interface KakaoMarker {
  setPosition(position: KakaoLatLng): void
}

export interface KakaoMaps {
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level?: number; scrollwheel?: boolean }) => KakaoMap
  Marker: new (options: { position: KakaoLatLng; map?: KakaoMap }) => KakaoMarker
  load(callback: () => void): void
}

declare global {
  interface Window {
    kakao?: { maps?: KakaoMaps }
  }
}

const KEY = ((import.meta.env.VITE_KAKAO_JS_KEY as string | undefined) ?? '').trim()

/** JavaScript 키가 들어 있는지 — 없으면 지도를 그리지 않는다 */
export const hasKakaoMapKey = (): boolean => KEY.length > 0

let loading: Promise<KakaoMaps> | null = null

/** SDK를 한 번만 불러 kakao.maps를 준다 — 실패하면(키·도메인 등록·연결) 다음에 다시 시도한다. */
export function loadKakaoMaps(): Promise<KakaoMaps> {
  if (!KEY) return Promise.reject(new Error('카카오 지도 키가 없어요'))
  loading ??= new Promise<KakaoMaps>((resolve, reject) => {
    const fail = (script: HTMLScriptElement) => {
      loading = null
      script.remove()
      reject(new Error('카카오 지도를 불러오지 못했어요'))
    }
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KEY)}&autoload=false`
    script.async = true
    // 등록하지 않은 사이트 주소면 스크립트는 와도 kakao.maps가 없다.
    script.onload = () => {
      const maps = window.kakao?.maps
      if (!maps) return fail(script)
      maps.load(() => resolve(maps))
    }
    script.onerror = () => fail(script)
    document.head.appendChild(script)
  })
  return loading
}

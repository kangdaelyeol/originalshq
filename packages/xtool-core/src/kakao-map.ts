// 카카오맵 링크 — 키 없이 카카오맵을 연다. 주소 칸 아래 "카카오맵에서 보기"·"길찾기"(웹 address-map.tsx, 앱
// features/address-search.ts). 좌표가 있으면 그 자리에 핀(이름은 핀에 보인다), 없으면 주소 글자로 찾는다.
// 웹 링크: https://map.kakao.com/link/map/{이름},{위도},{경도} · /link/to/{이름},{위도},{경도} · /link/search/{검색어}
// 앱 링크(폰에 카카오맵 앱이 있을 때 — 앱이 먼저 열어 보고 안 되면 웹 링크): kakaomap://look?p={위도},{경도} ·
// kakaomap://route?ep={위도},{경도}&by=CAR(출발은 지금 자리, 출장이라 차로) · kakaomap://search?q={검색어}

const BASE = 'https://map.kakao.com/link'

export interface KakaoMapPlace {
  /** 핀에 보일 이름 — 비면 주소 */
  name?: string
  address: string
  lat?: string
  lng?: string
}

export interface KakaoMapLinks {
  /** 카카오맵에서 보기 */
  view: string
  /** 길찾기(여기까지) — 좌표가 없으면 null */
  route: string | null
  /** 카카오맵 앱으로 보기 */
  appView: string
  /** 카카오맵 앱으로 길찾기 — 좌표가 없으면 null */
  appRoute: string | null
}

// 이름의 쉼표는 링크의 이름·위도·경도 구분과 겹쳐서 띄어쓰기로 바꾼다.
const pinName = (text: string) => encodeURIComponent(text.replace(/,/g, ' ').trim())

/** 주소 하나의 카카오맵 링크 — 주소도 좌표도 없으면 null */
export function kakaoMapLinks({ name, address, lat, lng }: KakaoMapPlace): KakaoMapLinks | null {
  const label = (name || address).trim()
  const hasCoords = Boolean(lat?.trim() && lng?.trim() && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)))
  if (hasCoords && label) {
    const pin = `${pinName(label)},${lat},${lng}`
    return {
      view: `${BASE}/map/${pin}`,
      route: `${BASE}/to/${pin}`,
      appView: `kakaomap://look?p=${lat},${lng}`,
      appRoute: `kakaomap://route?ep=${lat},${lng}&by=CAR`,
    }
  }
  if (!address.trim()) return null
  const query = encodeURIComponent(address.trim())
  return { view: `${BASE}/search/${query}`, route: null, appView: `kakaomap://search?q=${query}`, appRoute: null }
}

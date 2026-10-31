import { TechEditError } from './errors'

// 주소 검색(카카오 로컬 API) — Monday 주소(location) 칸은 위도·경도가 있어야 써져서,
// 화면에서 주소를 고르면 좌표까지 함께 보낸다. 주소로 먼저 찾고, 없으면 장소 이름
// (예: "국립아시아문화전당")으로 찾는다.

const KAKAO = 'https://dapi.kakao.com/v2/local/search'

export interface AddressResult {
  /** 화면에 보일 이름(장소 이름 또는 주소) */
  label: string
  /** Monday 칸에 적을 주소 — 도로명이 있으면 도로명 */
  address: string
  /** 지번 주소(참고) */
  jibun: string | null
  lat: string
  lng: string
}

interface KakaoAddressDoc {
  address_name: string
  x: string
  y: string
  road_address: { address_name: string } | null
}

interface KakaoPlaceDoc {
  place_name: string
  address_name: string
  road_address_name: string
  x: string
  y: string
}

async function kakao<T>(apiKey: string, path: string, query: string) {
  const url = `${KAKAO}/${path}?query=${encodeURIComponent(query)}&size=10`
  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  })
  if (!response.ok) {
    throw new Error(
      `카카오 주소 검색 실패(${response.status}): ${await response.text()}`,
    )
  }
  return ((await response.json()) as { documents: T[] }).documents
}

export async function searchAddress(
  apiKey: string,
  query: string,
): Promise<AddressResult[]> {
  const q = query.trim()
  if (q.length < 2) throw new TechEditError('두 글자 이상 적어 주세요')
  const addresses = await kakao<KakaoAddressDoc>(apiKey, 'address.json', q)
  if (addresses.length > 0) {
    return addresses.map((doc) => ({
      label: doc.road_address?.address_name ?? doc.address_name,
      address: doc.road_address?.address_name ?? doc.address_name,
      jibun: doc.road_address ? doc.address_name : null,
      lat: doc.y,
      lng: doc.x,
    }))
  }
  const places = await kakao<KakaoPlaceDoc>(apiKey, 'keyword.json', q)
  return places.map((doc) => ({
    label: doc.place_name,
    address: doc.road_address_name || doc.address_name,
    jibun: doc.road_address_name ? doc.address_name : null,
    lat: doc.y,
    lng: doc.x,
  }))
}

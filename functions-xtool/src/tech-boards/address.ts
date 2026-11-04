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
  /** 찾은 주소 — 도로명으로 찾으면 도로명, 지번으로 찾으면 지번 */
  address_name: string
  x: string
  y: string
  /** 지번 주소 — 도로명으로 찾아도 따로 들어 있다 */
  address: { address_name: string } | null
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
    // 시크릿을 넣을 때 섞여 들어간 앞뒤 공백·줄바꿈은 뗀다.
    headers: { Authorization: `KakaoAK ${apiKey.trim()}` },
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
    return addresses.map((doc) => {
      const main = doc.road_address?.address_name ?? doc.address_name
      // 지번은 address 쪽 — address_name은 찾은 주소라 도로명으로 찾으면 도로명이 한 번 더 나온다
      const lot = doc.address?.address_name ?? null
      return {
        label: main,
        address: main,
        jibun: lot && lot !== main ? lot : null,
        lat: doc.y,
        lng: doc.x,
      }
    })
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

import { describe, expect, it } from 'vitest'
import { kakaoMapLinks } from '@xtool-core/kakao-map'

// 카카오맵 링크(xtool-core/kakao-map) — 좌표가 있으면 핀·길찾기, 없으면 주소 글자로 찾기.

describe('카카오맵 링크', () => {
  it('좌표가 있으면 그 자리 핀과 길찾기', () => {
    const links = kakaoMapLinks({ address: '광주 동구 문화전당로 38', lat: '35.1467', lng: '126.9200' })
    const pin = `${encodeURIComponent('광주 동구 문화전당로 38')},35.1467,126.9200`
    expect(links).toEqual({
      view: `https://map.kakao.com/link/map/${pin}`,
      route: `https://map.kakao.com/link/to/${pin}`,
      appView: 'kakaomap://look?p=35.1467,126.9200',
      appRoute: 'kakaomap://route?ep=35.1467,126.9200&by=CAR',
    })
  })

  it('이름의 쉼표는 띄어쓰기로 바꾼다(링크 구분과 겹치지 않게)', () => {
    const links = kakaoMapLinks({ name: '본사, 3층', address: '주소', lat: '37.5', lng: '127' })
    expect(links?.view).toBe(`https://map.kakao.com/link/map/${encodeURIComponent('본사  3층')},37.5,127`)
  })

  it('좌표가 없으면 주소로 찾고 길찾기는 없다', () => {
    const query = encodeURIComponent('서울 중구 세종대로 110')
    expect(kakaoMapLinks({ address: ' 서울 중구 세종대로 110 ', lat: '', lng: '' })).toEqual({
      view: `https://map.kakao.com/link/search/${query}`,
      route: null,
      appView: `kakaomap://search?q=${query}`,
      appRoute: null,
    })
  })

  it('주소도 좌표도 없으면 null', () => {
    expect(kakaoMapLinks({ address: '' })).toBeNull()
  })
})

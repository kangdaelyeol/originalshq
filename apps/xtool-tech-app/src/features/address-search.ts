import { useRef, useState } from 'react';
import { Linking } from 'react-native';
import { addressErrorText } from '@xtool-core/error-text';
import { kakaoMapLinks } from '@xtool-core/kakao-map';
import { searchAddress, type AddressResult } from '@xtool-core/tech-boards';
import type { LocationState } from '@xtool-core/tech-edit';

// 주소 칸 하나의 검색·고르기 — 웹 use-address-search.ts의 폰 판. 검색은 core searchAddress(Firebase 함수가 카카오를
// 부른다 — 앱에 키가 없다), 늦게 온 옛 응답은 버리고, 오류·빈 결과·다시 찾기 규칙은 웹과 같다. 모양은 테마마다 그린다
// (Monday 편집 시트, 대시보드 수정 시트). 키보드 짚기(↑↓·Esc)는 폰에 없어 뺐다.

export type { AddressResult, LocationState };

export const EMPTY_LOCATION: LocationState = { address: '', detail: '', lat: '', lng: '' };

/** 카카오맵 열기 — 카카오맵 앱이 있으면 앱으로, 없으면(열지 못하면) 웹 카카오맵을 브라우저로 */
async function openKakaoMap(app: string | null, web: string) {
  if (app) {
    try {
      await Linking.openURL(app);
      return;
    } catch {
      // 카카오맵 앱이 없다 — 웹으로
    }
  }
  await Linking.openURL(web).catch(() => undefined);
}

/** 주소 하나의 "카카오맵에서 보기"·"길찾기"(좌표가 없으면 길찾기 없음) — 주소가 없으면 null. 웹 AddressMap 링크와 같다. */
export function kakaoMapActions(value: LocationState): { view: () => void; route: (() => void) | null } | null {
  const links = kakaoMapLinks(value);
  if (!links) return null;
  const { route, appRoute } = links;
  return {
    view: () => {
      openKakaoMap(links.appView, links.view).catch(() => undefined);
    },
    route: route
      ? () => {
          openKakaoMap(appRoute, route).catch(() => undefined);
        }
      : null,
  };
}

export function useAddressSearch(value: LocationState, onChange: (value: LocationState) => void) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressResult[] | null>(null);
  /** 결과를 찾은 말 — 빈 결과 안내에 쓴다 */
  const [searched, setSearched] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 나중에 보낸 검색만 받는다(앞의 것이 늦게 와도 덮지 않게) */
  const request = useRef(0);

  const run = async () => {
    const q = query.trim();
    if (q.length < 2) {
      setError('두 글자 이상 적어 주세요.');
      return;
    }
    const n = ++request.current;
    setSearching(true);
    setError(null);
    try {
      const list = await searchAddress(q);
      if (n !== request.current) return;
      setResults(list);
      setSearched(q);
    } catch (e) {
      if (n !== request.current) return;
      setResults(null);
      setError(addressErrorText(e));
    } finally {
      if (n === request.current) setSearching(false);
    }
  };

  const pick = (r: AddressResult) => {
    // 주소를 바꿔도 적어 둔 상세 주소는 남긴다.
    onChange({ address: r.address, detail: value.detail, lat: r.lat, lng: r.lng });
    setQuery('');
    setResults(null);
  };

  return {
    query,
    setQuery,
    /** 검색 결과 — 아직 안 찾았으면 null, 찾았는데 없으면 [] */
    results,
    searched,
    searching,
    error,
    /** Monday 주소 칸은 좌표가 있어야 써진다 */
    hasCoords: Boolean(value.lat && value.lng),
    /** 카카오맵 열기 — 주소가 없으면 null */
    maps: kakaoMapActions(value),
    run,
    pick,
    /** 주소 지우기 */
    clear: () => onChange(EMPTY_LOCATION),
    /** 상세 주소 고치기 */
    setDetail: (detail: string) => onChange({ ...value, detail }),
  };
}

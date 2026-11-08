import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makePalette, normalizeWater, WATER_DEFAULT, type WaterPalette, type WaterSettings } from './theme';

// 물 설정 — 벽 색조·강조색·깊이·테두리·판 색·농도(웹 설정 > 물 디자인과 같은 값·모양). 이 기기에 남긴다(웹은 계정의
// 외관 설정). 화면 틀(navigation/root)이 Frame 바깥에서 useChrome을 부르니 React 문맥 대신 모듈 저장소로 둔다 —
// 어디서 읽어도 같은 값이고, 바뀌면 읽는 곳만 다시 그린다.

const STORAGE_KEY = 'xtool-tech:water-settings';

let settings: WaterSettings = WATER_DEFAULT;
let palette: WaterPalette = makePalette(settings);
let loaded = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(fn => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

function apply(next: WaterSettings, save: boolean) {
  settings = next;
  palette = makePalette(next);
  emit();
  if (save) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
}

/** 저장된 설정 읽기 — 한 번만(Provider가 붙을 때) */
function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then(raw => {
      if (raw != null) apply(normalizeWater(JSON.parse(raw)), false);
    })
    .catch(() => undefined);
}

/** 설정 일부 바꾸기 — 바로 칠하고 남긴다 */
export const setWater = (patch: Partial<WaterSettings>) => apply(normalizeWater({ ...settings, ...patch }), true);
/** 물 디자인 값 전체를 처음으로 */
export const resetWater = () => apply(WATER_DEFAULT, true);

/** 저장된 설정을 불러온다(Frame이 감싼다) — 다 읽기 전엔 기본값(D7)으로 그린다 */
export function WaterProvider({ children }: { children: ReactNode }) {
  useEffect(load, []);
  return children;
}

/** 지금 설정 */
export const useWaterSettings = (): WaterSettings => useSyncExternalStore(subscribe, () => settings);

/** 지금 설정으로 푼 색·배수(팔레트) */
export const useWater = (): WaterPalette => useSyncExternalStore(subscribe, () => palette);

/** 팔레트에 따라 바뀌는 스타일 — 설정이 바뀔 때만 다시 만든다 */
export function useStyles<T extends Record<string, object>>(make: (p: WaterPalette) => T): T {
  const p = useWater();
  // make는 파일 아래의 고정 함수라 의존성에 넣지 않는다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create(make(p)) as T, [p]);
}

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  accentPalette,
  BACKGROUND_OPTIONS,
  DEFAULT_ACCENT,
  GLASS_DEFAULT,
  isHexColor,
  isPhotoBackground,
  normalizeGlass,
  type AccentPalette,
  type GlassBackground,
  type GlassSettings,
} from './theme';

// 글라스 외관 — 배경·강조색·유리 효과(웹 appearance.ts의 유리 쪽). 이 기기에 남긴다. 웹은 xtool-tech:settings 한
// 덩어리에 물·Monday 값도 같이 두지만, 앱은 물 테마가 따로 xtool-tech:water-settings를 쓰니 유리 값만 따로 둔다
// (서로 덮어쓰지 않게). 값은 모듈 저장소에 두고(테마 밖 useChrome도 읽게) Provider가 강조색 단계 등을 한 번만 계산한다.

export interface GlassAppearance {
  background: GlassBackground;
  /** 사용자가 고른 강조색 — 사진 배경에서는 쓰지 않는다(accentInUse) */
  accent: string;
  glass: GlassSettings;
}

export const DEFAULT_APPEARANCE: GlassAppearance = {
  background: 'shards',
  accent: DEFAULT_ACCENT,
  glass: GLASS_DEFAULT,
};

const STORAGE_KEY = 'xtool-tech:glass-settings';

/** 저장된 값 다듬기 — 웹 loadAppearance의 유리 쪽(배경 shared는 앱에 없어 기본으로) */
function normalizeAppearance(raw: unknown): GlassAppearance {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof GlassAppearance, unknown>>;
  return {
    background: BACKGROUND_OPTIONS.some(o => o.value === input.background)
      ? (input.background as GlassBackground)
      : DEFAULT_APPEARANCE.background,
    accent: isHexColor(input.accent) ? input.accent.toLowerCase() : DEFAULT_APPEARANCE.accent,
    glass: normalizeGlass(input.glass),
  };
}

// ── 모듈 저장소 ───────────────────────────────────────────────────────────────────────────────────────────

let current: GlassAppearance = DEFAULT_APPEARANCE;
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then(raw => {
      if (raw) current = normalizeAppearance(JSON.parse(raw));
    })
    .catch(() => undefined)
    .finally(() => {
      loaded = true;
      emit();
    });
  return loading;
}

function update(next: (a: GlassAppearance) => GlassAppearance) {
  current = next(current);
  emit();
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => undefined);
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** 저장된 외관(Provider 밖에서도) — 처음 부르면 기기에서 읽어 온다 */
export function useGlassAppearance(): { appearance: GlassAppearance; loaded: boolean } {
  useEffect(() => {
    load();
  }, []);
  const appearance = useSyncExternalStore(subscribe, () => current);
  const ready = useSyncExternalStore(subscribe, () => loaded);
  return { appearance, loaded: ready };
}

// ── Provider ─────────────────────────────────────────────────────────────────────────────────────────────

export interface GlassState extends GlassAppearance {
  /** 기기에서 읽어 왔는지 — 읽기 전엔 배경을 그리지 않는다(기본 배경이 잠깐 보였다 바뀌지 않게) */
  loaded: boolean;
  /** 지금 칠하는 강조색 — 사진 배경이면 기본색(웹 effectiveAccent) */
  accentInUse: string;
  /** accentInUse의 단계(밝은·어두운·그 위 글자) */
  a: AccentPalette;
  setBackground: (background: GlassBackground) => void;
  setAccent: (accent: string) => void;
  /** 일부 값만 넘기면 나머지는 그대로 */
  setGlass: (glass: Partial<GlassSettings>) => void;
  /** 배경 카드의 "기본값으로" — 배경·강조색·유리 효과 모두(웹 reset의 유리 쪽) */
  reset: () => void;
}

const actions = {
  setBackground: (background: GlassBackground) => update(a => ({ ...a, background })),
  setAccent: (accent: string) => update(a => ({ ...a, accent: accent.toLowerCase() })),
  setGlass: (glass: Partial<GlassSettings>) => update(a => ({ ...a, glass: { ...a.glass, ...glass } })),
  reset: () => update(() => DEFAULT_APPEARANCE),
};

function stateOf(appearance: GlassAppearance, ready: boolean): GlassState {
  const accentInUse = isPhotoBackground(appearance.background) ? DEFAULT_ACCENT : appearance.accent;
  return { ...appearance, loaded: ready, accentInUse, a: accentPalette(accentInUse), ...actions };
}

const GlassContext = createContext<GlassState | null>(null);

export function GlassProvider({ children }: { children: ReactNode }) {
  const { appearance, loaded: ready } = useGlassAppearance();
  const value = useMemo(() => stateOf(appearance, ready), [appearance, ready]);
  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>;
}

/** 지금 외관 — GlassProvider(글라스 Frame) 안에서 */
export function useGlass(): GlassState {
  const state = useContext(GlassContext);
  if (!state) throw new Error('useGlass는 GlassProvider(글라스 Frame) 안에서만 쓸 수 있어요');
  return state;
}

/** 외관에 따라 바뀌는 스타일 — 강조색·유리 값이 바뀔 때만 다시 만든다 */
export function useStyles<S extends Record<string, object>>(make: (g: GlassState) => S): S {
  const g = useGlass();
  // make는 파일 아래의 고정 함수라 의존성에 넣지 않는다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create(make(g)) as S, [g.a, g.glass]);
}

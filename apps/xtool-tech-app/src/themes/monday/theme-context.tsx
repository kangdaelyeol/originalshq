import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PALETTES, type MonPalette, type MonPaletteKey } from './theme';

// 지금 팔레트 — 앱 전체가 이것으로 칠한다. 고른 값은 이 기기에 남긴다(웹은 브라우저마다 남기는 것과 같다).

const STORAGE_KEY = 'xtool-tech:monday-palette';

interface ThemeState {
  palette: MonPalette;
  setPalette: (key: MonPaletteKey) => void;
}

const ThemeContext = createContext<ThemeState>({ palette: PALETTES.navy, setPalette: () => undefined });

export function MonThemeProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<MonPaletteKey>('navy');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => {
        if (saved === 'navy' || saved === 'light' || saved === 'black') setKey(saved);
      })
      .catch(() => undefined);
  }, []);

  const value = useMemo<ThemeState>(
    () => ({
      palette: PALETTES[key],
      setPalette: next => {
        setKey(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
      },
    }),
    [key],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** 지금 팔레트 */
export const useMon = (): MonPalette => useContext(ThemeContext).palette;
export const useSetPalette = () => useContext(ThemeContext).setPalette;

/** 팔레트에 따라 바뀌는 스타일 — 팔레트가 바뀔 때만 다시 만든다. */
export function useStyles<T extends Record<string, object>>(make: (p: MonPalette) => T): T {
  const palette = useMon();
  // make는 파일 아래의 고정 함수라 의존성에 넣지 않는다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create(make(palette)) as T, [palette]);
}

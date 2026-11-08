import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 이 기기에 남기는 화면 설정 — 웹이 브라우저(localStorage)에 남기는 것과 같은 열쇠 이름을 쓴다
// (xtool-tech:monday-collapsed:{보드}, xtool-tech:monday-view:{보드} …).

/** 남긴 값 — 처음엔 initial, 읽어 오면 그 값. 바꾸면 바로 남긴다. */
export function usePref<T>(key: string, initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key)
      .then(raw => {
        if (alive && raw != null) setValue(JSON.parse(raw) as T);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [key]);
  const set = useCallback(
    (next: T) => {
      setValue(next);
      AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => undefined);
    },
    [key],
  );
  return [value, set];
}

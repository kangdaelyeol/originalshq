import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 레이아웃 — 웹 설정 > 레이아웃과 같은 셋. 모양만 다르고 기능은 같다(데이터·저장·이동은 src/features의 공용 훅).
//   monday — Monday 표(그룹·칸 모양, 카드 목록)
//   glass  — 대시보드(유리 판 — 숫자 카드·목록·상세)
//   water  — 물(대시보드 짜임에 D7 물 부품)
// 고른 값은 이 기기에 남긴다(웹은 브라우저마다).

export type AppLayout = 'monday' | 'glass' | 'water';

export const LAYOUT_CHOICES: readonly { key: AppLayout; label: string; description: string }[] = [
  { key: 'monday', label: 'Monday 표', description: 'Monday처럼 그룹으로 — 항목을 눌러 칸을 고쳐요' },
  { key: 'glass', label: '대시보드', description: '유리 판 — 숫자 카드와 목록, 상세' },
  { key: 'water', label: '물', description: '대시보드 짜임을 물 디자인으로' },
];

const STORAGE_KEY = 'xtool-tech:app-layout';

interface LayoutState {
  layout: AppLayout;
  setLayout: (layout: AppLayout) => void;
  /** 저장된 값을 읽기 전엔 false — 첫 화면이 다른 레이아웃으로 깜빡이지 않게 */
  ready: boolean;
}

const LayoutContext = createContext<LayoutState>({ layout: 'monday', setLayout: () => undefined, ready: true });

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<AppLayout>('monday');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => {
        if (saved === 'monday' || saved === 'glass' || saved === 'water') setLayoutState(saved);
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);
  const value = useMemo<LayoutState>(
    () => ({
      layout,
      ready,
      setLayout: next => {
        setLayoutState(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
      },
    }),
    [layout, ready],
  );
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export const useLayout = () => useContext(LayoutContext);

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { PartsProvider } from '../dashboard/parts';
import { waterParts } from './parts';
import { WaterStage } from './stage';
import { useWater, WaterProvider } from './theme-context';

// 물 화면 틀(웹 water-shell.tsx) — 화면 전체에 물 무대(D7 연회색 유리 타일 벽, 붙박이)를 깔고 그 위에 화면·아래 탭을
// 얹는다. 물 설정을 불러오고(WaterProvider), 화면이 쓰는 부품을 물 부품으로 바꿔 끼운다(PartsProvider).

export function WaterFrame({ children }: { children: ReactNode }) {
  const p = useWater();
  return (
    <WaterProvider>
      <PartsProvider value={waterParts}>
        <View style={[styles.root, { backgroundColor: p.stageMid }]}>
          <WaterStage />
          {children}
        </View>
      </PartsProvider>
    </WaterProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

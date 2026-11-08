import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Canvas, Picture } from '@shopify/react-native-skia';
import { PartsProvider } from '../dashboard/parts';
import { backgroundPicture } from './backgrounds/art';
import { blurredBackdrop, usePhotoCrop } from './backgrounds/backdrop';
import { BackdropContext, SpaceProvider, useFixedSpace, type Backdrop } from './glass-surface';
import { glassParts } from './parts';
import { T } from './theme';
import { GlassProvider, useGlass } from './theme-context';

// 글라스 틀 — 화면 뒤 고정 배경(웹 ScreenBackground: 고른 배경을 지금 강조색으로 — Skia 한 판), 외관 Provider, 유리 판이
// 깔 흐린 배경(blur·saturate를 미리 한 번 건 작은 그림), 대시보드 부품(PartsProvider). 화면·탭·토스트는 모두 이 안에
// 투명하게 그려진다(navigation/root가 Frame이 있으면 화면 바탕을 투명하게 둔다).

export function GlassFrame({ children }: { children: ReactNode }) {
  return (
    <GlassProvider>
      <FrameBody>{children}</FrameBody>
    </GlassProvider>
  );
}

function FrameBody({ children }: { children: ReactNode }) {
  const g = useGlass();
  const { width, height } = useWindowDimensions();
  const photo = usePhotoCrop(g.background === 'photo' ? 'screen' : null);
  const root = useFixedSpace();

  // 배경 그림 — 저장된 외관을 읽기 전엔 그리지 않는다(기본 배경이 잠깐 보였다 바뀌지 않게). 사진은 에셋을 읽은 뒤.
  const picture = useMemo(() => {
    if (!g.loaded || (g.background === 'photo' && !photo)) return null;
    return backgroundPicture({ kind: g.background, accent: g.accentInUse, width, height, photo });
  }, [g.loaded, g.background, g.accentInUse, width, height, photo]);

  // 흐린 배경 — 처음엔 바로, 그다음부터는(슬라이더를 끄는 동안 등) 손을 멈춘 뒤 한 번 만든다(웹 강조색 고르기 120ms와 같게)
  const [backdrop, setBackdrop] = useState<Backdrop>({ uri: null, width, height });
  const made = useRef(false);
  const { blur, saturate } = g.glass;
  useEffect(() => {
    if (!picture) return;
    const id = setTimeout(
      () => {
        made.current = true;
        setBackdrop({ uri: blurredBackdrop(picture, width, height, blur, saturate), width, height });
      },
      made.current ? 120 : 0,
    );
    return () => clearTimeout(id);
  }, [picture, width, height, blur, saturate]);

  return (
    <View ref={root.ref} onLayout={root.onLayout} collapsable={false} style={styles.root}>
      {picture ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Picture picture={picture} />
        </Canvas>
      ) : null}
      <BackdropContext.Provider value={backdrop}>
        <SpaceProvider space={root.space}>
          <PartsProvider value={glassParts}>{children}</PartsProvider>
        </SpaceProvider>
      </BackdropContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
});

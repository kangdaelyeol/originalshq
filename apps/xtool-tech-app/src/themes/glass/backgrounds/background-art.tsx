import { useMemo, useState, type ReactNode } from 'react';
import { Image, PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { GlassBackground } from '../theme';
import { backgroundPicture } from './art';
import { pictureUri, usePhotoCrop } from './backdrop';

/**
 * 배경 그림 한 장(설정 미리보기 타일) — 받은 상자를 꽉 채운다. 웹 BackgroundArt와 같은 그림을 상자 크기로 그려
 * 사진(JPEG)으로 한 번 굽는다 — 타일마다 Skia 판을 띄우지 않으려고(사진 배경은 타일용 에셋).
 */
export function BackgroundArt({
  kind,
  accent,
  style,
  children,
}: {
  kind: GlassBackground;
  accent: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const photo = usePhotoCrop(kind === 'photo' ? 'tile' : null);
  const uri = useMemo(() => {
    if (!size || (kind === 'photo' && !photo)) return null;
    const picture = backgroundPicture({ kind, accent, width: size.w, height: size.h, photo });
    return pictureUri(picture, size.w, size.h, Math.min(2, PixelRatio.get()));
  }, [kind, accent, size, photo]);
  return (
    <View
      style={[styles.box, style]}
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        if (!size || size.w !== width || size.h !== height) setSize({ w: width, h: height });
      }}
    >
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="stretch" /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: '#050506' },
});

import { Text, type TextProps, type TextStyle } from 'react-native';
import { onDarkText, W, wtype, type WWeight } from '../theme';

// 물 글자 — 웹 물과 같은 시스템 글꼴(SF·한글 SD 고딕). 크기·굵기·글자 사이(em)는 웹 CSS 값 그대로 넘긴다.

export interface WTextProps extends TextProps {
  size?: number;
  weight?: WWeight;
  color?: string;
  /** 글자 사이(em, 글자 크기 배수) — 웹 letter-spacing */
  em?: number;
  /** 어두운 알약 위 흰 글자(D7 라벨 그림자) */
  onDark?: boolean;
  /** 고정폭 숫자(웹 tabular-nums) */
  tabular?: boolean;
  /** 줄 높이 배수(웹 line-height 1.4 등) */
  lh?: number;
  align?: 'left' | 'center' | 'right';
}

export function WText({
  size = 13,
  weight = '500',
  color = W.ink,
  em = 0,
  onDark = false,
  tabular = false,
  lh,
  align,
  style,
  ...rest
}: WTextProps) {
  const base: TextStyle = wtype(size, weight, em, { color });
  return (
    <Text
      {...rest}
      style={[
        base,
        lh ? { lineHeight: Math.round(size * lh * 10) / 10 } : null,
        align ? { textAlign: align } : null,
        tabular ? TABULAR : null,
        onDark ? onDarkText(size) : null,
        style,
      ]}
    />
  );
}

const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

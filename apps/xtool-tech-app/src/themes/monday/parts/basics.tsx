import { Text, View, type TextProps } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { labelColor, personColor } from '@xtool-core/monday-colors';
import { initialsOf } from '@xtool-core/session';
import { FONT } from '../theme';
import { useMon } from '../theme-context';

// 작은 공용 부품 — 글자·사람 동그라미·상태 칸·칩·개수 뱃지. 값은 웹 Monday 표(styles/monday/_table.scss)와 같다.

interface MTextProps extends TextProps {
  size?: number;
  weight?: keyof typeof FONT;
  color?: string;
}

/** 글자 — 기본은 Figtree 500, 14, 본문 색(웹 보드 안 글자가 모두 500) */
export function MText({ size = 14, weight = 'medium', color, style, ...rest }: MTextProps) {
  const p = useMon();
  return <Text {...rest} style={[{ fontFamily: FONT[weight], fontSize: size, color: color ?? p.text }, style]} />;
}

/** 이름 머리글자 동그라미 — 색은 이름으로 정한다(웹과 같은 사람은 같은 색). ring은 칸 바탕색 테두리. */
export function Avatar({
  name,
  size = 28,
  color,
  ring,
}: {
  name: string;
  size?: number;
  color?: string;
  ring?: string;
}) {
  const inner = ring ? size - 4 : size;
  const font = Math.max(8, Math.round(inner * 0.375 * 10) / 10);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: ring ?? 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: color ?? personColor(name),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: FONT.semibold, fontSize: font, color: '#ffffff', letterSpacing: -0.02 * font }}>
          {initialsOf(name, '')}
        </Text>
      </View>
    </View>
  );
}

/** 사람 칸 — 둘까지는 겹쳐 모두, 셋부터는 첫 사람 + "+N"(웹 people·담당자 칸). 비면 빈 사람 동그라미. */
export function AvatarStack({ names, size = 28 }: { names: string[]; size?: number }) {
  const p = useMon();
  if (names.length === 0) {
    const empty = size - 2;
    return (
      <View
        style={{
          width: empty,
          height: empty,
          borderRadius: empty / 2,
          borderWidth: 1.5,
          borderColor: p.personEmpty,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <UserRound size={15} strokeWidth={2.8} color={p.personEmpty} />
      </View>
    );
  }
  const shown = names.length <= 2 ? names : names.slice(0, 1);
  return (
    <View style={{ flexDirection: 'row' }}>
      {shown.map((name, i) => (
        <View key={`${name}-${i}`} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar name={name} size={size} ring={p.cell} />
        </View>
      ))}
      {names.length > 2 && (
        <View
          style={{
            marginLeft: -8,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: p.cell,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: size - 4,
              height: size - 4,
              borderRadius: (size - 4) / 2,
              backgroundColor: p.badge,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MText size={11}>+{names.length - 1}</MText>
          </View>
        </View>
      )}
    </View>
  );
}

/** 상태 칸 — 칸 전체를 라벨 색으로, 흰 글자(웹 status 칸). */
export function StatusBlock({
  label,
  height = 28,
  minWidth = 96,
  fontSize = 13,
  radius = 4,
  stretch,
}: {
  label: string;
  height?: number;
  minWidth?: number;
  fontSize?: number;
  radius?: number;
  /** 가로로 꽉 채우기(정보 목록) */
  stretch?: boolean;
}) {
  return (
    <View
      style={{
        height,
        minWidth,
        alignSelf: stretch ? 'stretch' : 'flex-start',
        borderRadius: radius,
        backgroundColor: labelColor(label),
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
      }}
    >
      <Text numberOfLines={1} style={{ fontFamily: FONT.medium, fontSize, color: '#ffffff' }}>
        {label}
      </Text>
    </View>
  );
}

/** 드롭다운·연결 칸의 칩 — 높이 24, 반경 4, --mon-chip 바탕(웹 .mon-chip) */
export function Chip({ label }: { label: string }) {
  const p = useMon();
  return (
    <View
      style={{
        height: 24,
        paddingHorizontal: 8,
        borderRadius: 4,
        backgroundColor: p.chip,
        borderWidth: 1,
        borderColor: p.bg,
        justifyContent: 'center',
        maxWidth: 180,
      }}
    >
      <MText size={13} numberOfLines={1}>
        {label}
      </MText>
    </View>
  );
}

/** 하위 아이템 수 뱃지 — 반경 3, --mon-badge(웹 이름 칸 뱃지) */
export function CountBadge({ count }: { count: number }) {
  const p = useMon();
  return (
    <View
      style={{
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        borderRadius: 3,
        backgroundColor: p.badge,
        justifyContent: 'center',
      }}
    >
      <MText size={12} style={{ textAlign: 'center' }}>
        {count}
      </MText>
    </View>
  );
}

/** 16진 색에 불투명도 — 웹의 color-mix·rgba 계산 대신 */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

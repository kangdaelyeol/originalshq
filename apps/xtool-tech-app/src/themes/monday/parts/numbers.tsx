import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ChevronDown } from 'lucide-react-native';
import type { KpiCard } from '@xtool-core/board-kpis';
import { PERIOD_OPTIONS } from '@xtool-core/period';
import type { TechBoardKey } from '@xtool-core/tech-boards';
import { useBoardKpis, usePeriod } from '../../../features/kpis';
import { usePref } from '../../../features/prefs';
import { TINT, type MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';
import { MText } from './basics';
import { SkeletonBlock, ToolTabs } from './chrome';

// 요약 줄(웹 monday-numbers.tsx) — 대시보드 숫자 카드와 같은 숫자(@xtool-core/board-kpis)를 Monday 숫자 위젯처럼.
// "요약"을 누르면 접고 편다. 처음엔 접어 두고(표가 먼저 보이게), 편 보드는 편 채로 이 기기에 남긴다(웹과 같은 열쇠).
// 펴면 오른쪽에 기간(오늘·7일·30일·1년) — "… 완료" 같은 칸이 이 기간을 센다(앱 전체에 하나).

export function MondayNumbers({ boardKey }: { boardKey: TechBoardKey }) {
  const p = useMon();
  const s = useStyles(styles);
  const [collapsed, setCollapsed] = usePref<boolean>(`xtool-tech:monday-numbers:${boardKey}`, true);
  const cards = useBoardKpis(boardKey);
  const { period, setPeriod } = usePeriod();
  const turn = useSharedValue(collapsed ? -90 : 0);
  useEffect(() => {
    turn.value = withTiming(collapsed ? -90 : 0, { duration: 150 });
  }, [collapsed, turn]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Pressable
          onPress={() => setCollapsed(!collapsed)}
          style={({ pressed }) => [s.toggle, pressed && { backgroundColor: p.overlay }]}
          accessibilityRole="button"
          accessibilityState={{ expanded: !collapsed }}
        >
          <Animated.View style={chevron}>
            <ChevronDown size={16} color={p.text2} />
          </Animated.View>
          <MText size={15}>요약</MText>
        </Pressable>
        {collapsed ? (
          cards ? (
            <Brief cards={cards} />
          ) : (
            <SkeletonBlock width={180} height={10} />
          )
        ) : (
          <ToolTabs tabs={PERIOD_OPTIONS} value={period} onChange={setPeriod} style={s.period} />
        )}
      </View>
      {!collapsed && (
        <View style={s.grid}>
          {(cards ?? GHOSTS).map((card, i) => (
            <NumberCard key={card?.key ?? i} card={card} />
          ))}
        </View>
      )}
    </View>
  );
}

// 불러오는 중 — 같은 높이의 빈 칸 넷(다 불러온 순간 아래가 밀리지 않게)
const GHOSTS: (KpiCard | null)[] = [null, null, null, null];

/** 접었을 때 — "이름 값 · 이름 값 …" 한 줄(넘치면 말줄임) */
function Brief({ cards }: { cards: KpiCard[] }) {
  const p = useMon();
  return (
    <MText size={13} color={p.text2} numberOfLines={1} style={{ flex: 1 }}>
      {cards.map((card, i) => (
        <MText key={card.key} size={13} color={p.text2}>
          {i > 0 && <MText color={p.text4}>{'  ·  '}</MText>}
          {card.title} <MText color={p.text}>{card.value}</MText>
        </MText>
      ))}
    </MText>
  );
}

/** 숫자 칸 — 이름(13, 앞에 8px 색 점) · 값 28 · 설명 12(없어도 줄 자리는 둔다) */
function NumberCard({ card }: { card: KpiCard | null }) {
  const p = useMon();
  const s = useStyles(styles);
  return (
    <View style={s.card}>
      <View style={s.label}>
        {card ? (
          <>
            <View style={[s.dot, { backgroundColor: TINT[card.tint] }]} />
            <MText size={13} color={p.text2} numberOfLines={1} style={s.flex}>
              {card.title}
            </MText>
          </>
        ) : (
          <SkeletonBlock width={72} height={10} style={s.ghostLabel} />
        )}
      </View>
      {card ? (
        <MText size={28} style={s.value} numberOfLines={1} adjustsFontSizeToFit>
          {card.value}
        </MText>
      ) : (
        <SkeletonBlock width={56} height={22} radius={6} style={s.ghostValue} />
      )}
      <MText size={12} color={p.text2} numberOfLines={1}>
        {card?.caption || ' '}
      </MText>
    </View>
  );
}

const styles = (p: MonPalette) => ({
  wrap: { paddingHorizontal: 16, paddingTop: 12 },
  head: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, height: 32 },
  toggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    height: 28,
    paddingLeft: 4,
    paddingRight: 8,
    borderRadius: 4,
  },
  period: { marginLeft: 'auto' as const },
  grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12, marginTop: 8 },
  card: {
    flexBasis: '45%' as const,
    flexGrow: 1,
    gap: 2,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 8,
    backgroundColor: p.cell,
  },
  label: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, height: 19 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  flex: { flex: 1 },
  value: { lineHeight: 35, letterSpacing: -0.28, fontVariant: ['tabular-nums' as const] },
  ghostLabel: { marginVertical: 4 },
  ghostValue: { marginVertical: 6.5 },
});

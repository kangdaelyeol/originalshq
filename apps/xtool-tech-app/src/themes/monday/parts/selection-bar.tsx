import { Pressable, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { ArrowRight, Trash2, X, type LucideIcon } from 'lucide-react-native';
import { INK, type MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';
import { MText } from './basics';

// 고르기 막대(웹 monday-selection-bar) — 줄을 고르면 화면 아래 가운데에 뜬다: 수 알약, "{noun} 선택", 이동(한 보드만)·
// 삭제, 닫기. 웹처럼 0.2초 동안 아래 16에서 떠오른다.

// 떠오르기 — y 16 → 0, 흐림 → 또렷(웹 cubic-bezier(.33,1,.68,1))
const RISE = FadeInDown.duration(200)
  .easing(Easing.bezier(0.33, 1, 0.68, 1))
  .withInitialValues({ opacity: 0, transform: [{ translateY: 16 }] });

export function SelectionBar({
  count,
  noun,
  bottom,
  onMove,
  onDelete,
  onClose,
}: {
  count: number;
  /** "고객 선택" — 여러 보드면 "항목" */
  noun: string;
  /** 화면 아래에서 띄울 거리 */
  bottom: number;
  /** 이동 — 한 보드에서만 골랐을 때(없으면 단추를 뺀다) */
  onMove?: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const p = useMon();
  const s = useStyles(styles);
  return (
    <View pointerEvents="box-none" style={[s.dock, { bottom }]}>
      <Animated.View entering={RISE} style={s.bar} accessibilityLabel={`${count}개 선택됨`}>
        <View style={s.count}>
          <MText size={13} color={INK}>
            {count}
          </MText>
        </View>
        <MText size={15} numberOfLines={1} style={s.label}>
          {noun} 선택
        </MText>
        <View style={s.actions}>
          {onMove && <Action icon={ArrowRight} label="이동" onPress={onMove} />}
          <Action icon={Trash2} label="삭제" onPress={onDelete} />
        </View>
        <View style={s.divider} />
        <Pressable
          onPress={onClose}
          hitSlop={6}
          accessibilityLabel="선택 해제"
          style={({ pressed }) => [s.close, pressed && { backgroundColor: p.overlay }]}
        >
          <X size={18} color={p.text} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** 막대 단추 — 아이콘 18 위, 글 12 아래(최소 56) */
function Action({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const p = useMon();
  const s = useStyles(styles);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.action, pressed && { backgroundColor: p.overlay }]}>
      <Icon size={18} color={p.text} />
      <MText size={12}>{label}</MText>
    </Pressable>
  );
}

const styles = (p: MonPalette) => ({
  dock: { position: 'absolute' as const, left: 12, right: 12, alignItems: 'center' as const },
  bar: {
    minHeight: 60,
    maxWidth: '100%' as const,
    paddingVertical: 8,
    paddingLeft: 18,
    paddingRight: 10,
    gap: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 10,
    backgroundColor: p.pop,
    boxShadow: `0 12px 40px ${p.shadow}`,
  },
  count: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: p.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  label: { flexShrink: 1, marginRight: 4 },
  actions: { flexDirection: 'row' as const, gap: 2 },
  action: {
    minWidth: 56,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center' as const,
    gap: 2,
  },
  divider: { width: 1, alignSelf: 'stretch' as const, backgroundColor: p.line },
  close: { width: 36, height: 36, borderRadius: 4, alignItems: 'center' as const, justifyContent: 'center' as const },
});

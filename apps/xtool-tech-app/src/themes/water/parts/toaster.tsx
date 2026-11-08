import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CircleAlert, CircleCheck, LoaderCircle, X } from 'lucide-react-native';
import { dismissToast, useToasts, type Toast } from '@xtool-core/tech-save-queue';
import { smooth } from '../motion';
import { springArrival, springConfig, W, WATER_REVEAL, WATER_SPRING } from '../theme';
import { useWater } from '../theme-context';
import { RippleLayer, useRippleFx } from './fx';
import { glassLayer } from './glass';
import { WText } from './text';

// 토스트(웹 components/water/board/toaster.tsx·toast-engine.ts) — 백그라운드 저장의 진행·결과. 불투명 유리 알약
// (wb-panel 0.9·0.55, 둥글기 23)이 오른쪽 끝 동그라미에서 extend 스프링(ζ0.5·ω34, 15% 넘침)으로 왼쪽으로 뻗고, 처음 다
// 뻗는 0.071s부터 아이콘·글·닫기가 21ms 간격으로 55ms씩 나타난다. 사라질 때는 내용이 곧바로(0.015 → 0.045s) 걷히고
// 0.188s부터 먼 끝이 동그라미 쪽으로 빨려 들며 0.17 → 0.30s에 유리가 걷힌다. 성공하면 아이콘에서 작은 물결이 알약
// 안으로 퍼진다. 위아래 자리가 바뀌면 move 스프링으로 옮긴다. 폰에서는 아래 탭 바로 위에 쌓는다.

const ICON = { pending: LoaderCircle, success: CircleCheck, error: CircleAlert } as const;
const REVEAL_AT = springArrival(WATER_SPRING.extend);
/** 접힘 1단계(D7 CLOSE_GATHER) */
const EXIT_HOLD = 0.188;
const RADIUS = 23;
const MOVE = springConfig(WATER_SPRING.move);

interface Item {
  toast: Toast;
  leaving: boolean;
}

/** 목록이 바뀌면 — 새 것은 더하고, 없어진 것은 나가는 중으로 남긴다(사라지는 움직임이 끝나면 뺀다) */
function merge(items: readonly Item[], toasts: readonly Toast[]): Item[] {
  const next = new Map(toasts.map(t => [t.id, t]));
  const out: Item[] = items.map(it => {
    const t = next.get(it.toast.id);
    return t ? { toast: t, leaving: false } : { toast: it.toast, leaving: true };
  });
  const known = new Set(items.map(it => it.toast.id));
  for (const t of toasts) if (!known.has(t.id)) out.push({ toast: t, leaving: false });
  return out;
}

export function WaterToaster({ bottom }: { bottom: number }) {
  const toasts = useToasts();
  const [items, setItems] = useState<Item[]>(() => toasts.map(toast => ({ toast, leaving: false })));
  const [seen, setSeen] = useState(toasts);
  if (seen !== toasts) {
    setSeen(toasts);
    setItems(cur => merge(cur, toasts));
  }
  const remove = (id: number) => setItems(cur => cur.filter(it => it.toast.id !== id || !it.leaving));
  if (items.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[styles.toaster, { bottom }]}>
      {items.map(it => (
        <ToastItem key={it.toast.id} toast={it.toast} leaving={it.leaving} onGone={remove} />
      ))}
    </View>
  );
}

function ToastItem({ toast, leaving, onGone }: { toast: Toast; leaving: boolean; onGone: (id: number) => void }) {
  const p = useWater();
  const reduced = useReducedMotion();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  /** 알약이 뻗은 정도 0(동그라미) → 1(다 뻗음) */
  const extend = useSharedValue(0);
  /** 나갈 때 유리가 걷히는 진행 0 → 1(smooth) */
  const fade = useSharedValue(0);
  /** 동작 줄이기 — 통째로 흐리게 */
  const plain = useSharedValue(reduced ? 0 : 1);
  const content = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const spin = useSharedValue(0);
  const enteredAt = useRef(0);
  const ripple = useRippleFx();
  const width = useSharedValue(0);
  const height = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    width.value = w;
    height.value = h;
    if (!box || Math.abs(box.w - w) > 0.5 || Math.abs(box.h - h) > 0.5) setBox({ w, h });
  };

  // 나타나기 — 처음 잰 뒤 한 번
  const entered = box !== null;
  useEffect(() => {
    if (!entered) return;
    enteredAt.current = Date.now();
    if (reduced) {
      plain.value = withTiming(1, { duration: 100 });
      extend.value = 1;
      content.forEach(c => (c.value = 1));
      return;
    }
    extend.value = withSpring(1, springConfig(WATER_SPRING.extend));
    content.forEach((c, i) => {
      c.value = withDelay(
        (REVEAL_AT + i * WATER_REVEAL.stagger) * 1000,
        withTiming(1, { duration: WATER_REVEAL.fade * 1000, easing: Easing.linear }),
      );
    });
    // 공유 값은 처음 만든 그대로다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered]);

  // 사라지기 — 다 걷히면 뺀다
  useEffect(() => {
    if (!leaving) return;
    const gone = () => onGone(toast.id);
    if (reduced) {
      plain.value = withTiming(0, { duration: 100 }, done => {
        if (done) runOnJS(gone)();
      });
      return;
    }
    content.forEach(c => {
      c.value = withDelay(15, withTiming(0, { duration: WATER_REVEAL.out * 1000, easing: Easing.linear }));
    });
    extend.value = withDelay(EXIT_HOLD * 1000, withSpring(0, springConfig(WATER_SPRING.extend)));
    fade.value = withDelay(
      (EXIT_HOLD + 0.17) * 1000,
      withTiming(1, { duration: 130, easing: Easing.linear }, done => {
        if (done) runOnJS(gone)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  // 진행 중 — 아이콘이 돈다(0.9초)
  useEffect(() => {
    if (toast.tone !== 'pending') return;
    spin.value = 0;
    spin.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.tone]);

  // 성공하면 아이콘 가운데에서 물결 — 알약이 아직 뻗는 중이면 아이콘이 나올 때(0.071s)까지 기다린다
  useEffect(() => {
    if (toast.tone !== 'success' || leaving || reduced || !box) return;
    const play = () => {
      const h = box.h;
      ripple.play({
        // 아이콘 칸(24px) 가운데 — 왼쪽 여백 13 + 12, 위 여백 11 + 12
        x: 13 + 12,
        y: 11 + 12,
        k: h / 50.5,
        clip: { x: 0, y: 0, width: box.w, height: h, radius: Math.min(h / 2, 22) },
      });
    };
    const wait = REVEAL_AT * 1000 - (Date.now() - enteredAt.current);
    if (wait <= 0) {
      play();
      return;
    }
    const timer = setTimeout(play, wait);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.tone, box !== null]);

  const glassStyle = useAnimatedStyle(() => {
    const h = height.value;
    const span = Math.max(0, width.value - h);
    return { width: Math.max(h, h + span * extend.value) };
  });
  const itemStyle = useAnimatedStyle(() => ({ opacity: plain.value * (1 - smooth(fade.value)) }));
  const c0 = useAnimatedStyle(() => ({ opacity: content[0].value }));
  const c1 = useAnimatedStyle(() => ({ opacity: content[1].value }));
  const c2 = useAnimatedStyle(() => ({ opacity: content[2].value }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

  const Icon = ICON[toast.tone];
  const iconColor = toast.tone === 'success' ? W.ok : toast.tone === 'error' ? W.crit : W.ink2;
  return (
    <Animated.View
      layout={
        reduced
          ? undefined
          : LinearTransition.springify().mass(MOVE.mass).stiffness(MOVE.stiffness).damping(MOVE.damping)
      }
      onLayout={onLayout}
      pointerEvents={leaving ? 'none' : 'auto'}
      accessibilityRole={toast.tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.toast, itemStyle]}
    >
      <Animated.View pointerEvents="none" style={[styles.glass, glassStyle]}>
        <View style={glassLayer(p, 0.9, 0.55, RADIUS, 'pane')} />
      </Animated.View>
      <RippleLayer fx={ripple} style={styles.fx} />
      <Animated.View style={[styles.icon, c0]}>
        <Animated.View style={toast.tone === 'pending' ? spinStyle : null}>
          <Icon size={16} color={iconColor} strokeWidth={2} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.body, c1]}>
        <WText size={13} weight="600" lh={1.4}>
          {toast.title}
        </WText>
        {toast.message ? (
          <WText size={12} weight="500" color={W.ink2} lh={1.5} style={styles.message}>
            {toast.message}
          </WText>
        ) : null}
        {toast.action && (
          <Pressable
            hitSlop={6}
            style={styles.action}
            onPress={() => {
              toast.action?.run();
              dismissToast(toast.id);
            }}
          >
            <WText size={12.5} weight="700" style={styles.actionText}>
              {toast.action.label}
            </WText>
          </Pressable>
        )}
      </Animated.View>
      {toast.tone !== 'pending' ? (
        <Animated.View style={c2}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            hitSlop={8}
            onPress={() => dismissToast(toast.id)}
            style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
          >
            <X size={14} color={W.ink3} />
          </Pressable>
        </Animated.View>
      ) : (
        <View style={styles.closeSpace} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toaster: { position: 'absolute', left: 12, right: 12, alignItems: 'flex-end', gap: 10 },
  toast: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 46,
    paddingTop: 11,
    paddingBottom: 11,
    paddingLeft: 13,
    paddingRight: 11,
  },
  glass: { position: 'absolute', top: 0, right: 0, bottom: 0, borderRadius: RADIUS },
  fx: { borderRadius: RADIUS },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, paddingTop: 3 },
  message: { marginTop: 3 },
  action: { marginTop: 6, alignSelf: 'flex-start' },
  actionText: { textDecorationLine: 'underline', textDecorationColor: W.linkLineStrong },
  close: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  closePressed: { backgroundColor: W.pressFill },
  closeSpace: { width: 24, height: 24 },
});

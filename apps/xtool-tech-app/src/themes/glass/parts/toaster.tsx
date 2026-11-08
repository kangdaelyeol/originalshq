import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import Animated, {
  LinearTransition,
  withSpring,
  type EntryAnimationsValues,
  type ExitAnimationsValues,
  type LayoutAnimation,
} from 'react-native-reanimated';
import { CircleAlert, CircleCheck, X } from 'lucide-react-native';
import { dismissToast, useToasts, type Toast } from '@xtool-core/tech-save-queue';
import { font, RADIUS, T } from '../theme';
import { useGlass } from '../theme-context';
import { GlassSurface } from '../glass-surface';
import { SpinIcon } from './text';

// 저장 알림 — 웹 components/layout/toaster.tsx(.toast: 유리 + 바탕 농도+0.3, r14, 오류는 빨간 테두리 .35). 웹은 오른쪽
// 아래, 폰은 아래 탭 위 가운데 폭(좌우 20 — 웹 calc(100vw − 40px)). 들어올 때 y16·0.98 → spring 420/34, 나갈 때 x24.

const SPRING = { stiffness: 420, damping: 34, mass: 1 };

function toastIn(_values: EntryAnimationsValues): LayoutAnimation {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.98 }] },
    animations: {
      opacity: withSpring(1, SPRING),
      transform: [{ translateY: withSpring(0, SPRING) }, { scale: withSpring(1, SPRING) }],
    },
  };
}

function toastOut(_values: ExitAnimationsValues): LayoutAnimation {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
    animations: { opacity: withSpring(0, SPRING), transform: [{ translateX: withSpring(24, SPRING) }] },
  };
}

const MOVE = LinearTransition.springify().stiffness(420).damping(34);

export function Toaster({ bottom }: { bottom: number }) {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[styles.stack, { bottom }]}>
      {toasts.map(toast => (
        <Animated.View key={toast.id} entering={toastIn} exiting={toastOut} layout={MOVE} collapsable={false}>
          <ToastCard toast={toast} />
        </Animated.View>
      ))}
    </View>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const { a } = useGlass();
  const error = toast.tone === 'error';
  return (
    <GlassSurface
      radius={RADIUS.toast}
      tint="strong"
      borderColor={error ? 'rgba(248, 113, 113, 0.35)' : undefined}
      style={styles.toast}
    >
      <View style={styles.icon} accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite">
        {toast.tone === 'pending' ? (
          <SpinIcon size={16} color={T.text3} />
        ) : toast.tone === 'success' ? (
          <CircleCheck size={16} strokeWidth={2} color={T.good} />
        ) : (
          <CircleAlert size={16} strokeWidth={2} color={T.crit} />
        )}
      </View>
      <View style={styles.body}>
        <RNText style={styles.title}>{toast.title}</RNText>
        {toast.message ? <RNText style={styles.message}>{toast.message}</RNText> : null}
        {toast.action ? (
          <Pressable
            onPress={() => {
              toast.action?.run();
              dismissToast(toast.id);
            }}
            hitSlop={6}
            accessibilityRole="button"
            style={styles.action}
          >
            {({ pressed }) => (
              <RNText style={[styles.actionText, { color: a.hi }, pressed && styles.pressed]}>
                {toast.action?.label}
              </RNText>
            )}
          </Pressable>
        ) : null}
      </View>
      {toast.tone !== 'pending' ? (
        <Pressable
          onPress={() => dismissToast(toast.id)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          style={({ pressed }) => [styles.close, pressed && styles.closeOn]}
        >
          {({ pressed }) => <X size={14} strokeWidth={2} color={pressed ? T.text1 : T.text4} />}
        </Pressable>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', left: 20, right: 20, gap: 8 },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 12,
    paddingRight: 12,
    paddingBottom: 12,
    paddingLeft: 14,
  },
  icon: { marginTop: 1 },
  body: { flex: 1, minWidth: 0 },
  title: { ...font(13, 600, { lh: 1.45 }), color: T.text1 },
  message: { ...font(12, 400, { lh: 1.5 }), color: T.text3, marginTop: 3 },
  action: { marginTop: 6, alignSelf: 'flex-start' },
  actionText: font(12, 700),
  pressed: { opacity: 0.7 },
  close: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  closeOn: { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
});

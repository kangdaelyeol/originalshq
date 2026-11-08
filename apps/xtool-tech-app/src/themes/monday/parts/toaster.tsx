import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutRight } from 'react-native-reanimated';
import { CircleAlert, CircleCheck, X } from 'lucide-react-native';
import { dismissToast, useToasts, type Toast } from '@xtool-core/tech-save-queue';
import { TOAST } from '../theme';
import { useMon } from '../theme-context';
import { MText } from './basics';

// 토스트 — 저장 대기열이 알리는 실패·성공(웹 toaster.tsx: 성공 #00854d, 실패 #d83a52, 진행은 --mon-surface).
// 폰에서는 아래 탭 바로 위에 쌓는다. 들어올 때 아래 16에서 스프링(420/34), 나갈 때 오른쪽으로 흐려진다(웹과 같다).

const ENTER = FadeInDown.springify()
  .stiffness(420)
  .damping(34)
  .withInitialValues({ opacity: 0, transform: [{ translateY: 16 }] });

export function Toaster({ bottom }: { bottom: number }) {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, bottom, gap: 8 }}>
      {toasts.map(toast => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const p = useMon();
  const filled = toast.tone !== 'pending';
  const ink = filled ? '#ffffff' : p.text;
  const Icon = toast.tone === 'success' ? CircleCheck : CircleAlert;
  return (
    <Animated.View
      entering={ENTER}
      exiting={FadeOutRight.duration(160)}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingVertical: 12,
        paddingLeft: 14,
        paddingRight: 12,
        borderRadius: 6,
        backgroundColor: toast.tone === 'success' ? TOAST.success : toast.tone === 'error' ? TOAST.error : p.surface,
        borderWidth: filled ? 0 : 1,
        borderColor: p.line,
        boxShadow: `0 8px 24px ${p.shadow}`,
      }}
    >
      <View style={{ paddingTop: 1 }}>
        {toast.tone === 'pending' ? <ActivityIndicator size="small" color={ink} /> : <Icon size={16} color={ink} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <MText size={13} weight="semibold" color={ink}>
          {toast.title}
        </MText>
        {toast.message ? (
          <MText size={12} color={ink} style={{ lineHeight: 18 }}>
            {toast.message}
          </MText>
        ) : null}
        {toast.action && (
          <Pressable
            onPress={() => {
              toast.action?.run();
              dismissToast(toast.id);
            }}
            hitSlop={6}
          >
            <MText size={12} color={ink} style={{ textDecorationLine: 'underline', marginTop: 4 }}>
              {toast.action.label}
            </MText>
          </Pressable>
        )}
      </View>
      {toast.tone !== 'pending' && (
        <Pressable
          onPress={() => dismissToast(toast.id)}
          hitSlop={8}
          style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={14} color={ink} />
        </Pressable>
      )}
    </Animated.View>
  );
}

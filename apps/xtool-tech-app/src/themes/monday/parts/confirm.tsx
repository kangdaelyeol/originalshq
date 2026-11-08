import { Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { TriangleAlert } from 'lucide-react-native';
import { INK, STATE, TOAST, type MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';
import { MText, withAlpha } from './basics';

// 확인 창(웹 ohq-ui confirm-dialog의 Monday 모양) — 가운데 카드, 둥근 위험 아이콘, 제목 16/700, 13 글, 취소 · 위험 단추.

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const p = useMon();
  const s = useStyles(styles);
  return (
    // 모달 자체 애니메이션은 끈다(시트와 같은 까닭 — 닫히는 중인 모달이 새 모달을 막지 않게), 나타날 때만 0.14초 흐려짐
    <Modal transparent visible={open} animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(140)} style={s.fill}>
        <Pressable style={s.scrim} onPress={onCancel} accessibilityLabel="닫기">
          <View style={s.card} onStartShouldSetResponder={() => true}>
            <View style={s.icon}>
              <TriangleAlert size={18} color={STATE.crit} />
            </View>
            <MText size={16} weight="bold">
              {title}
            </MText>
            <MText size={13} color={p.textSoft} style={s.message}>
              {message}
            </MText>
            <View style={s.actions}>
              <Pressable
                onPress={onCancel}
                style={({ pressed }) => [s.ghost, pressed && { backgroundColor: p.overlay }]}
              >
                <MText size={13}>취소</MText>
              </Pressable>
              <Pressable onPress={onConfirm} style={({ pressed }) => [s.danger, pressed && { opacity: 0.85 }]}>
                <MText size={13} color={INK}>
                  {confirmLabel}
                </MText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = (p: MonPalette) => ({
  fill: { flex: 1 },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 24,
  },
  card: {
    width: '100%' as const,
    maxWidth: 420,
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 18,
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: p.line,
    backgroundColor: p.pop,
    boxShadow: `0 20px 60px ${p.shadow}`,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: withAlpha(STATE.crit, 0.14),
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  message: { lineHeight: 21 },
  actions: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 8, marginTop: 8 },
  ghost: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: p.control,
    justifyContent: 'center' as const,
  },
  danger: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 4,
    backgroundColor: TOAST.error,
    justifyContent: 'center' as const,
  },
});

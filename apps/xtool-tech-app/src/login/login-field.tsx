import { useState, type Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import { CircleAlert, Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { alpha, C } from './theme';

interface LoginFieldProps extends Omit<TextInputProps, 'secureTextEntry' | 'style'> {
  label: string;
  icon: LucideIcon;
  password?: boolean;
  /** 있으면 칸이 빨갛게 바뀌고 아래에 문구가 뜬다. */
  error?: string | null;
  inputRef?: Ref<TextInputInstance>;
}

/**
 * 아이콘이 붙은 입력칸 — 웹 ohq-ui/auth/login-field.tsx·_auth.scss와 같은 모양. 비밀번호면 오른쪽에 보기/숨기기.
 *
 * ⚠️ 입력칸을 바로 감싼 줄(styles.row)의 스타일은 절대 바꾸지 않는다. 포커스 때 그 줄의 테두리·배경·그림자를
 * 바꾸면 iOS(Fabric)에서 입력칸이 포커스를 잃어 키보드가 바로 내려갔다. 포커스 빛·오류 빨강은 뒤에 깔린 판의
 * 투명도로만 켠다.
 */
export function LoginField({
  label,
  icon: Icon,
  password,
  error,
  inputRef,
  onFocus,
  onBlur,
  ...rest
}: LoginFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const iconColor = error ? C.crit : focused ? C.accentHi : C.text3;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.control}>
        {/* 상태 판 — 평소 · 포커스(강조색 빛) · 오류(빨강) · 오류 중 포커스(빨간 빛) */}
        <View style={[styles.layer, styles.rest]} pointerEvents="none" />
        <View style={[styles.layer, styles.focused, !(focused && !error) && styles.hidden]} pointerEvents="none" />
        <View style={[styles.layer, styles.error, !(error && !focused) && styles.hidden]} pointerEvents="none" />
        <View style={[styles.layer, styles.errorFocused, !(error && focused) && styles.hidden]} pointerEvents="none" />
        <View style={styles.row}>
          <Icon size={16} color={iconColor} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholderTextColor={C.text4}
            selectionColor={C.accentHi}
            keyboardAppearance="dark"
            secureTextEntry={password && !revealed}
            onFocus={e => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={e => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...rest}
          />
          {password && (
            <Pressable
              style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
              onPress={() => setRevealed(v => !v)}
              accessibilityRole="button"
              accessibilityLabel={revealed ? '비밀번호 숨기기' : '비밀번호 보기'}
              hitSlop={6}
            >
              {revealed ? <EyeOff size={16} color={C.text3} /> : <Eye size={16} color={C.text3} />}
            </Pressable>
          )}
        </View>
      </View>
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <CircleAlert size={13} color={C.crit} style={styles.errorIcon} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 12.5, fontWeight: '600', color: C.text2 },
  control: { height: 46 },
  layer: { ...StyleSheet.absoluteFill, borderRadius: 12, borderWidth: 1 },
  hidden: { opacity: 0 },
  rest: { borderColor: 'rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(0, 0, 0, 0.26)' },
  // 웹 :focus-within — 강조색 테두리와 바깥으로 번지는 빛(배경은 평소 판 위에 겹쳐 0.32 정도가 되게)
  focused: {
    borderColor: alpha(C.accent, 0.6),
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: C.accent,
    shadowOpacity: 0.6,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 0 },
  },
  error: { borderColor: 'rgba(248, 113, 113, 0.55)', backgroundColor: 'rgba(127, 29, 29, 0.2)' },
  errorFocused: {
    borderColor: 'rgba(248, 113, 113, 0.8)',
    backgroundColor: 'rgba(127, 29, 29, 0.2)',
    shadowColor: '#ef4444',
    shadowOpacity: 0.6,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 0 },
  },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  input: { flex: 1, height: '100%', padding: 0, fontSize: 14, color: C.text1 },
  toggle: { width: 30, height: 30, marginRight: -6, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  togglePressed: { backgroundColor: 'rgba(255, 255, 255, 0.07)' },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  errorIcon: { marginTop: 2 },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, color: C.crit },
});

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { ArrowRight, CircleCheck, Info } from 'lucide-react-native';
import { C } from './theme';

// 로그인 카드 안 작은 부품 — 웹 ohq-ui/styles/_auth.scss의 .login-note·.login-submit·.login-divider·.social-button·
// .text-link·.login-switch와 같은 모양.

export type NoteTone = 'good' | 'info';

/** 안내 상자 — good(초록, 체크)·info(파랑, i). */
export function LoginNote({ tone, text }: { tone: NoteTone; text: string }) {
  const color = tone === 'good' ? C.good : C.info;
  const Icon = tone === 'good' ? CircleCheck : Info;
  return (
    <View
      style={[styles.note, tone === 'good' ? styles.noteGood : styles.noteInfo]}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
    >
      <Icon size={15} color={color} style={styles.noteIcon} />
      <Text style={[styles.noteText, { color }]}>{text}</Text>
    </View>
  );
}

/** 강조색 큰 버튼 — 위에서 아래로 밝은 → 어두운 강조색, 아래로 번지는 빛. */
export function SubmitButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.submit, pressed && styles.pressedDown]}
      accessibilityRole="button"
    >
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="submit" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.accentHi} />
            <Stop offset="1" stopColor={C.accentLo} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={12} fill="url(#submit)" />
      </Svg>
      {/* 위 가장자리 안쪽 빛(웹 inset 0 1px 0) */}
      <View style={styles.submitHighlight} />
      <Text style={styles.submitText}>{label}</Text>
      <ArrowRight size={16} strokeWidth={2.4} color={C.accentInk} />
    </Pressable>
  );
}

/** 가운데 글자 양옆으로 가운데가 밝은 가는 선 */
export function Divider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <FadeLine />
      <Text style={styles.dividerText}>{label}</Text>
      <FadeLine />
    </View>
  );
}

function FadeLine() {
  return (
    <Svg style={styles.dividerLine} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="line" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#fff" stopOpacity={0} />
          <Stop offset="0.5" stopColor="#fff" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#fff" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="1" fill="url(#line)" />
    </Svg>
  );
}

/** 소셜 로그인 버튼 */
export function SocialButton({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.social, pressed && styles.socialPressed]}
      accessibilityRole="button"
    >
      {icon}
      <Text style={styles.socialText}>{label}</Text>
    </Pressable>
  );
}

/** Google 로고 — 웹 ohq-ui/brand/google-mark.tsx와 같은 경로. */
export function GoogleMark({ size = 17 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <Path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </Svg>
  );
}

/** 글자 버튼 — accent면 강조색 굵게. */
export function TextLink({ label, onPress, accent }: { label: string; onPress: () => void; accent?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      {({ pressed }) => (
        <Text style={[styles.link, accent && styles.linkAccent, pressed && styles.linkPressed]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** 카드 맨 아래 안내 줄(가운데 정렬) */
export function SwitchLine({ children }: { children: ReactNode }) {
  return <View style={styles.switch}>{children}</View>;
}

export function SwitchText({ text }: { text: string }) {
  return <Text style={styles.switchText}>{text}</Text>;
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  noteGood: { backgroundColor: 'rgba(74, 222, 128, 0.08)', borderColor: 'rgba(74, 222, 128, 0.24)' },
  noteInfo: { backgroundColor: 'rgba(96, 165, 250, 0.08)', borderColor: 'rgba(96, 165, 250, 0.24)' },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: C.accent,
    shadowOpacity: 0.9,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 14 },
  },
  submitHighlight: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
  submitText: { fontSize: 14.5, fontWeight: '700', color: C.accentInk },
  pressedDown: { transform: [{ translateY: 1 }], opacity: 0.94 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22, marginBottom: 14 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 11, letterSpacing: 0.44, color: C.text4 },
  social: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  socialPressed: { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.18)' },
  socialText: { fontSize: 13, fontWeight: '600', color: C.text1 },
  link: { fontSize: 12.5, fontWeight: '500', color: C.text2 },
  linkAccent: { color: C.accentHi, fontWeight: '700' },
  linkPressed: { color: '#ffffff', textDecorationLine: 'underline' },
  switch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  switchText: { fontSize: 12.5, color: C.text3, textAlign: 'center' },
});

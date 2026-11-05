import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { signInWithEmail } from '@xtool-core/auth';

/** 로그인 — 이메일·비밀번호(웹과 같은 권한 확인). Google 로그인은 콘솔 설정(OAuth 클라이언트)이 끝나면 붙인다. */
export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError(null);
    // 성공하면 로그인 상태(useXtoolSession)가 바뀌어 다음 화면으로 간다.
    const outcome = await signInWithEmail(email, password, 'tech');
    if (!outcome.ok && outcome.message) setError(outcome.message);
    setBusy(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>xtool tech</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="이메일"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="비밀번호"
        secureTextEntry
        textContentType="password"
        onSubmitEditing={submit}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.button, busy && styles.busy]} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>로그인</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#323338', marginBottom: 12 },
  input: { height: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: '#c3c6d4', borderRadius: 4, fontSize: 15 },
  error: { color: '#d83a52', fontSize: 13 },
  button: { height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: '#0073ea' },
  busy: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

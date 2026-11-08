// 웹과 같이 쓰는 데이터 코드(xtool-core)에 앱의 Firebase 초기화를 먼저 끼운다 — 다른 import보다 앞에.
import './src/firebase';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DENIED_MESSAGE } from '@xtool-core/access';
import { signOutXtool } from '@xtool-core/auth';
import { MemberContext } from '@xtool-core/member-context';
import { useXtoolSession } from '@xtool-core/session';
import { LoginScreen } from './src/screens/login-screen';
import { MText } from './src/themes/monday/parts/basics';
import { MonThemeProvider, useMon } from './src/themes/monday/theme-context';
import { LayoutProvider } from './src/features/layout';
import { MainApp } from './src/navigation/root';

/**
 * 앱 — 로그인 상태(웹과 같은 useXtoolSession·권한 규칙)에 따라 로그인 화면 → 기술팀 화면(웹 Monday 테마를 폰에
 * 맞춘 것: 아래 탭 내 업무·보드·팀원·설정).
 */
function App() {
  return (
    <SafeAreaProvider>
      <LayoutProvider>
        <MonThemeProvider>
          <Gate />
        </MonThemeProvider>
      </LayoutProvider>
    </SafeAreaProvider>
  );
}

function Gate() {
  const session = useXtoolSession('tech');
  // 로그인 화면이 연출 중이면(검증 → 성공 로고 → 사라지기) 로그인 상태가 바뀌어도 화면을 붙잡아 둔다.
  const [holding, setHolding] = useState(false);
  // 임시 비밀번호로 들어와 있다 — 로그인 화면이 비밀번호 설정 폼으로 연다.
  const setupPending = session.status === 'denied' && session.reason === 'password-setup';
  if (holding || session.status === 'signedOut' || setupPending) {
    // 로그인 화면은 화면 끝까지(바탕이 어둡다) — 안전 영역은 화면이 스스로 비운다.
    return <LoginScreen setupPending={setupPending} onHold={setHolding} />;
  }
  return <SignedInGate session={session} />;
}

function SignedInGate({ session }: { session: ReturnType<typeof useXtoolSession> }) {
  const p = useMon();
  switch (session.status) {
    case 'unconfigured':
      return <Message text="Firebase 설정이 비어 있어요(src/firebase-config.ts)." />;
    case 'loading':
      return (
        <View style={[styles.center, { backgroundColor: p.bg }]}>
          <StatusBar barStyle={p.scheme === 'dark' ? 'light-content' : 'dark-content'} />
          <ActivityIndicator color={p.text2} />
        </View>
      );
    case 'signedOut':
      return null;
    case 'denied':
      return <Message text={DENIED_MESSAGE[session.reason]} action={{ label: '로그아웃', run: signOutXtool }} />;
    case 'ready':
      return (
        <MemberContext.Provider value={session.member}>
          <MainApp />
        </MemberContext.Provider>
      );
  }
}

function Message({ text, action }: { text: string; action?: { label: string; run: () => void } }) {
  const p = useMon();
  return (
    <View style={[styles.center, { backgroundColor: p.bg }]}>
      <MText size={15} style={styles.message}>
        {text}
      </MText>
      {action && (
        <Pressable style={[styles.button, { backgroundColor: p.primary }]} onPress={action.run}>
          <MText color="#ffffff">{action.label}</MText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  message: { textAlign: 'center' },
  button: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 4 },
});

export default App;

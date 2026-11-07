// 웹과 같이 쓰는 데이터 코드(xtool-core)에 앱의 Firebase 초기화를 먼저 끼운다 — 다른 import보다 앞에.
import './src/firebase';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DENIED_MESSAGE } from '@xtool-core/access';
import { signOutXtool } from '@xtool-core/auth';
import { MemberContext } from '@xtool-core/member-context';
import { useXtoolSession } from '@xtool-core/session';
import { BoardPreviewScreen } from './src/screens/board-preview-screen';
import { LoginScreen } from './src/screens/login-screen';

/**
 * 앱 뼈대 — 로그인 상태(웹과 같은 useXtoolSession·권한 규칙)에 따라 로그인 → 보드 미리보기. 화면(UI)은 앞으로
 * 정해지는 대로 바꾼다. 지금은 공용 코드로 실제 보드를 읽는지 확인하는 자리.
 */
function App() {
  return (
    <SafeAreaProvider>
      <Gate />
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
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <SignedInGate session={session} />
    </SafeAreaView>
  );
}

function SignedInGate({ session }: { session: ReturnType<typeof useXtoolSession> }) {
  switch (session.status) {
    case 'unconfigured':
      return <Message text="Firebase 설정이 비어 있어요(src/firebase-config.ts)." />;
    case 'loading':
      return (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      );
    case 'signedOut':
      return null;
    case 'denied':
      return <Message text={DENIED_MESSAGE[session.reason]} action={{ label: '로그아웃', run: signOutXtool }} />;
    case 'ready':
      return (
        <MemberContext.Provider value={session.member}>
          <BoardPreviewScreen />
        </MemberContext.Provider>
      );
  }
}

function Message({ text, action }: { text: string; action?: { label: string; run: () => void } }) {
  return (
    <View style={styles.center}>
      <Text style={styles.message}>{text}</Text>
      {action && (
        <Pressable style={styles.button} onPress={action.run}>
          <Text style={styles.buttonText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  message: { fontSize: 15, color: '#323338', textAlign: 'center' },
  button: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 4, backgroundColor: '#0073ea' },
  buttonText: { color: '#fff', fontWeight: '600' },
});

export default App;

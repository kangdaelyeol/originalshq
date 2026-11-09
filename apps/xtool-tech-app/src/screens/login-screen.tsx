import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type TextInputInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SkPicture } from '@shopify/react-native-skia';
import { ChevronsRight, KeyRound, Lock, Mail } from 'lucide-react-native';
import { DENIED_MESSAGE } from '@xtool-core/access';
import {
  completePasswordSetup,
  sendPasswordReset,
  signInWithEmail,
  signOutXtool,
  type AuthOutcome,
} from '@xtool-core/auth';
import { MIN_PASSWORD, normalizeEmail } from '@xtool-core/members';
import { signInWithGoogle } from '../google-sign-in';
import { LoginField } from '../login/login-field';
import {
  Divider,
  GoogleMark,
  LoginNote,
  SocialButton,
  SubmitButton,
  SwitchLine,
  SwitchText,
  TextLink,
  type NoteTone,
} from '../login/login-parts';
import { LoginScene, type CardFrame } from '../login/login-scene';
import { ParticleField, type SlotRect } from '../login/particles/particle-field';
import { ACCENT, C } from '../login/theme';
import { useLoginChoreography, type CardSize } from '../login/use-login-choreography';

// setup — 관리자가 발급한 임시 비밀번호로 처음 들어온 사람이 자기 비밀번호를 정한다.
type Mode = 'login' | 'setup' | 'reset';
type Note = { tone: NoteTone; text: string };

const SETUP_NOTE: Note = { tone: 'info', text: DENIED_MESSAGE['password-setup'] };
const LOGO = require('../assets/xtool-logo-text.png');

// 로고가 뜨고 링이 퍼지는 걸 잠깐 보여준 뒤 다음 단계로.
const RING_HOLD_MS = 460;
const LOGIN_HOLD_MS = 520;
const YEAR = new Date().getFullYear();
// 카드 위 로고 자리(웹 .login__hero) — 폭 min(380, 80%), 높이 108.
const HERO_HEIGHT = 108;
const STAGE_GAP = 14;

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

interface LoginScreenProps {
  /** 임시 비밀번호로 이미 로그인돼 있다 — 비밀번호 설정 폼부터. */
  setupPending: boolean;
  /**
   * 로그인 연출 중엔 true — 그동안 로그인 상태가 바뀌어도 이 화면을 붙잡아 둔다(성공 연출이 끝나면 false로 놓아
   * 보드로 넘어간다).
   */
  onHold: (holding: boolean) => void;
}

/**
 * 로그인 — 웹 기술팀 로그인(src/screens/xtool-tech/pages/login-page.tsx)과 같은 화면·흐름. 입자가 X로 피었다가
 * 흩어져 xTool 워드마크로 모이고, 카드 위로 옮겨 가면 유리 카드가 떠오른다. 누르면 모서리 조각이 가운데로 모이는
 * 동안 검증하고, 성공이면 로고가 뜬 뒤 보드로, 실패면 조각이 빨갛게 떨리고 카드가 흔들린 뒤 폼으로 돌아온다.
 * 비밀번호 설정·재설정으로 바꿀 때도 같은 연출로 폼이 갈아끼워진다.
 */
export function LoginScreen({ setupPending, onHold }: LoginScreenProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const [mode, setMode] = useState<Mode>(setupPending ? 'setup' : 'login');
  const [note, setNote] = useState<Note | null>(setupPending ? SETUP_NOTE : null);
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [fields, setFields] = useState({ email: '', password: '', confirm: '' });
  const set = (key: keyof typeof fields) => (value: string) => setFields(f => ({ ...f, [key]: value }));

  // 입자 인트로 — 글자가 카드 위 자리로 옮겨 가기 시작하면 카드를 보여 준다.
  const [introDone, setIntroDone] = useState(false);
  const pictureSink = useRef<((picture: SkPicture) => void) | null>(null);
  const engineRef = useRef<ParticleField | null>(null);

  // 자리 — 무대(stage)·로고 자리·카드 내용의 화면 좌표. 키보드가 올라오면 무대 전체를 lift만큼 올린다.
  const stageRef = useRef({ x: 0, y: 0 });
  const heroRef = useRef<SlotRect | null>(null);
  const [cardLocal, setCardLocal] = useState<CardFrame | null>(null);
  const [cardSize, setCardSize] = useState<CardSize>({ width: 0, height: 0 });
  const lift = useSharedValue(0);
  const layoutWaiters = useRef<((size: CardSize) => void)[]>([]);

  const reveal = useSharedValue(0);
  const choreo = useLoginChoreography(cardSize);
  const inputs = useRef<Record<string, TextInputInstance | null>>({});

  // ── 입자 엔진 ──────────────────────────────────────────────────────────
  useEffect(() => {
    const engine = new ParticleField({
      width: screenW,
      height: screenH,
      slot: () => {
        const hero = heroRef.current;
        return hero ? { ...hero, y: hero.y - lift.value } : null;
      },
      logo: LOGO,
      fallbackText: 'xTool',
      subtitle: 'TECH TEAM',
      accentColor: ACCENT,
      reducedMotion: reduceMotion,
      onSettle: () => setIntroDone(true),
      onFrame: picture => pictureSink.current?.(picture),
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [screenW, screenH, reduceMotion, lift]);

  // 카드 떠오르기 — 0.8초, 웹 ease [0.22, 1, 0.36, 1].
  useEffect(() => {
    if (!introDone) return;
    reveal.value = reduceMotion ? 1 : withTiming(1, { duration: 800, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [introDone, reduceMotion, reveal]);

  // 키보드 — 카드 아래가 키보드에 가리면 무대를 그만큼 올린다(카드 위쪽은 화면 안에 남게).
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', e => {
      const card = cardLocal;
      if (!card) return;
      const bottom = stageRef.current.y + card.y + card.height;
      const top = stageRef.current.y + card.y;
      const need = Math.max(0, bottom + 12 - e.endCoordinates.screenY);
      const room = Math.max(0, top - insets.top - 8);
      lift.value = withTiming(Math.min(need, room), { duration: e.duration || 250 });
    });
    const hide = Keyboard.addListener('keyboardWillHide', e => {
      lift.value = withTiming(0, { duration: e.duration || 250 });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [cardLocal, insets.top, lift]);

  const onStageLayout = (e: LayoutChangeEvent) => {
    const { x, y } = e.nativeEvent.layout;
    stageRef.current = { x, y };
    engineRef.current?.redrawStatic();
  };
  const onHeroLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    heroRef.current = { x: stageRef.current.x + x, y: stageRef.current.y + y, width, height };
    engineRef.current?.redrawStatic();
  };
  const onCardLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setCardLocal({ x, y, width, height });
    setCardSize({ width, height });
    const waiters = layoutWaiters.current;
    layoutWaiters.current = [];
    waiters.forEach(resolve => resolve({ width, height }));
  };
  /** 폼을 바꾼 뒤 새 크기 — 다음 onLayout까지(크기가 그대로면 안 불리니 잠깐만) 기다린다. */
  const nextLayout = () =>
    Promise.race([
      new Promise<CardSize>(resolve => layoutWaiters.current.push(resolve)),
      wait(120).then(() => undefined),
    ]);

  // Skia 카드는 화면 좌표 — 무대 자리 + 카드 내용 자리 − 키보드로 올린 만큼(Skia 쪽은 lift를 따로 더한다).
  const card: CardFrame | null = cardLocal
    ? { ...cardLocal, x: stageRef.current.x + cardLocal.x, y: stageRef.current.y + cardLocal.y }
    : null;

  // RN 폼 — Skia 카드와 같이 흔들리고 떠오르고, 연출 중엔 흐려진다.
  const contentStyle = useAnimatedStyle(() => {
    const p = reveal.value;
    return {
      opacity: p > 0 ? Math.min(1, p * 2) * choreo.values.content.value * (1 - choreo.values.leave.value) : 0,
      transform: [
        { translateX: choreo.values.shakeX.value },
        { translateY: 28 * (1 - p) },
        { scale: (0.97 + 0.03 * p) * choreo.values.contentScale.value },
      ],
    };
  });
  const stageStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value }] }));

  const focusField = (name?: string) => {
    const input = name ? inputs.current[name] : Object.values(inputs.current).find(Boolean);
    input?.focus();
  };

  // ── 흐름(웹 login-page.tsx와 같다) ───────────────────────────────────────

  const runSignIn = useCallback(
    async (verifying: Promise<AuthOutcome>) => {
      onHold(true);
      setNote(null);
      setLoginError(null);
      Keyboard.dismiss();

      if (reduceMotion) {
        const outcome = await verifying;
        if (outcome.ok) {
          onHold(false);
          return;
        }
        onHold(false);
        if (outcome.setup || outcome.setupDone) {
          setMode(outcome.setup ? 'setup' : 'login');
          setNote(outcome.setup ? SETUP_NOTE : { tone: 'good', text: outcome.message });
          return;
        }
        if (!outcome.cancelled) setLoginError(outcome.message);
        return;
      }

      setBusy(true);
      await choreo.gather();
      const outcome = await verifying;
      if (outcome.ok) {
        choreo.celebrate();
        await wait(LOGIN_HOLD_MS);
        await choreo.exit();
        onHold(false);
        return;
      }

      onHold(false);
      // 임시 비밀번호로 들어왔다 — 흔들지 않고 모인 조각이 갈라지며 비밀번호 설정 폼으로. 첫 비밀번호는 정했는데
      // 다시 로그인만 실패했으면 로그인 폼으로(새 비밀번호로 다시 로그인).
      if (outcome.setup || outcome.setupDone) {
        setMode(outcome.setup ? 'setup' : 'login');
        setNote(outcome.setup ? SETUP_NOTE : { tone: 'good', text: outcome.message });
        setFields({ email: fields.email, password: '', confirm: '' });
        await choreo.split(await nextLayout());
        setBusy(false);
        return;
      }
      // Google 창을 닫은 거면 흔들지 않고 조용히 폼으로 돌아온다.
      if (outcome.cancelled) {
        await choreo.split();
        setBusy(false);
        return;
      }
      await choreo.reject();
      setLoginError(outcome.message);
      await choreo.split(await nextLayout());
      setBusy(false);
      focusField('password');
    },
    [choreo, onHold, reduceMotion, fields.email],
  );

  const switchTo = async (next: Mode, requestedNote: Note | null = null) => {
    setMismatch(false);
    setLoginError(null);
    setFormError(null);
    Keyboard.dismiss();
    if (reduceMotion) {
      setMode(next);
      setNote(requestedNote);
      return;
    }
    setBusy(true);
    setNote(null);
    await choreo.merge();
    await wait(RING_HOLD_MS);
    // 내용이 가려진 동안 폼을 바꾼다.
    setMode(next);
    setNote(requestedNote);
    await choreo.split(await nextLayout());
    setBusy(false);
  };

  /** 재설정 메일 보내기 — 성공하면 로그인 폼으로 돌아가 안내를, 실패하면 이 폼에 오류를. */
  const runRequest = async (request: Promise<AuthOutcome>, successNote: Note) => {
    setBusy(true);
    setSending(true);
    setFormError(null);
    const outcome = await request;
    setSending(false);
    if (outcome.ok) {
      await switchTo('login', successNote);
      return;
    }
    setFormError(outcome.message);
    setBusy(false);
    focusField('email');
  };

  const onLogin = () => {
    if (busy) return;
    if (!fields.email.trim() || !fields.password) {
      focusField(fields.email.trim() ? 'password' : 'email');
      return;
    }
    void runSignIn(signInWithEmail(fields.email, fields.password, 'tech'));
  };

  const onGoogle = () => {
    if (busy) return;
    void runSignIn(signInWithGoogle('tech'));
  };

  const onSetup = () => {
    if (busy) return;
    if (fields.password.length < MIN_PASSWORD) {
      setLoginError(`${MIN_PASSWORD}자 이상으로 정해 주세요.`);
      focusField('password');
      return;
    }
    if (fields.password !== fields.confirm) {
      setMismatch(true);
      return;
    }
    void runSignIn(completePasswordSetup(fields.password, 'tech'));
  };

  /** 비밀번호 설정을 그만두고 다른 계정으로 — 임시 비밀번호 로그인을 끊고 로그인 폼으로. */
  const leaveSetup = async () => {
    await signOutXtool();
    setFields({ email: '', password: '', confirm: '' });
    await switchTo('login');
  };

  const onReset = () => {
    if (busy) return;
    const email = normalizeEmail(fields.email);
    if (!email) {
      focusField('email');
      return;
    }
    // 계정이 있는지는 알려 주지 않는다 — 있으면 메일이 가고, 없으면 아무 일도 없다.
    void runRequest(sendPasswordReset(email), {
      tone: 'good',
      text: `등록된 계정이면 비밀번호 재설정 메일이 갔어요(${email}). 메일의 링크로 새 비밀번호를 정해 주세요.`,
    });
  };

  // 손가락으로 화면을 누르고 끄는 동안 입자를 밀어낸다(웹은 마우스).
  const pointer = (e: { nativeEvent: { pageX: number; pageY: number } } | null) =>
    engineRef.current?.setPointer(e ? { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY } : null);

  const cardWidth = Math.min(460, screenW - 32);
  const heroWidth = Math.min(380, screenW * 0.8);

  return (
    <View
      style={styles.root}
      onTouchStart={pointer}
      onTouchMove={pointer}
      onTouchEnd={() => pointer(null)}
      onTouchCancel={() => pointer(null)}
    >
      <StatusBar barStyle="light-content" />
      <LoginScene
        width={screenW}
        height={screenH}
        pictureSink={pictureSink}
        card={card}
        lift={lift}
        revealed={introDone}
        choreo={choreo.values}
        reveal={reveal}
        reducedMotion={reduceMotion}
      />

      {/*
        collapsable={false} — 움직임(transform·opacity)이 0 ↔ 값으로 바뀌면 Fabric이 이 뷰가 자식을 품을지 다시 정해 입력칸을
        다른 부모로 옮겨 달 수 있다(옮겨지면 키보드가 내려간다 — login-field.tsx 주석). 늘 품게 고정해 둔다.
      */}
      <Animated.View
        style={[styles.stage, { paddingTop: insets.top + 32 }, stageStyle]}
        onLayout={onStageLayout}
        collapsable={false}
      >
        {/* 입자 'xTool'이 자리 잡는 곳 — 글자는 뒤 판에 그려지고, 이 자리는 위치와 누르기만 맡는다. */}
        <Pressable
          style={{ width: heroWidth, height: HERO_HEIGHT }}
          onLayout={onHeroLayout}
          onPress={() => engineRef.current?.replay()}
          disabled={!introDone}
          accessibilityLabel="xTool TECH TEAM — 눌러서 입자를 다시 모으기"
        />

        <Animated.View
          style={[styles.card, { width: cardWidth }, contentStyle]}
          onLayout={onCardLayout}
          pointerEvents={busy || !introDone ? 'none' : 'auto'}
          collapsable={false}
        >
          {mode === 'login' ? (
            <View key="login">
              <Text style={styles.title}>환영합니다</Text>
              {note && <LoginNote tone={note.tone} text={note.text} />}
              <View style={styles.form}>
                <LoginField
                  inputRef={el => {
                    inputs.current.email = el;
                  }}
                  label="아이디(이메일)"
                  icon={Mail}
                  value={fields.email}
                  onChangeText={set('email')}
                  placeholder="name@xtool.co.kr"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => focusField('password')}
                  submitBehavior="submit"
                />
                <LoginField
                  inputRef={el => {
                    inputs.current.password = el;
                  }}
                  label="비밀번호"
                  icon={Lock}
                  password
                  value={fields.password}
                  onChangeText={v => {
                    set('password')(v);
                    setLoginError(null);
                  }}
                  placeholder="비밀번호 입력"
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={onLogin}
                  error={loginError}
                />
                <View style={styles.rowEnd}>
                  <TextLink label="비밀번호를 잊으셨나요?" onPress={() => void switchTo('reset')} />
                </View>
                <SubmitButton label="로그인" onPress={onLogin} />
              </View>

              <Divider label="또는 다음 계정으로 계속" />
              <SocialButton icon={<GoogleMark />} label="Google 계정으로 로그인" onPress={onGoogle} />

              <SwitchLine>
                <SwitchText text="처음이면 관리자에게 받은 임시 비밀번호로 로그인하세요." />
              </SwitchLine>
            </View>
          ) : mode === 'setup' ? (
            <View key="setup">
              <Text style={styles.title}>
                비밀번호 <Text style={styles.titleEm}>설정</Text>
              </Text>
              {note && <LoginNote tone={note.tone} text={note.text} />}
              <View style={styles.form}>
                <LoginField
                  inputRef={el => {
                    inputs.current.password = el;
                  }}
                  label="새 비밀번호"
                  icon={KeyRound}
                  password
                  value={fields.password}
                  onChangeText={v => {
                    set('password')(v);
                    setMismatch(false);
                    setLoginError(null);
                  }}
                  placeholder={`${MIN_PASSWORD}자 이상`}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="next"
                  onSubmitEditing={() => focusField('confirm')}
                  submitBehavior="submit"
                  error={loginError}
                />
                <LoginField
                  inputRef={el => {
                    inputs.current.confirm = el;
                  }}
                  label="새 비밀번호 확인"
                  icon={Lock}
                  password
                  value={fields.confirm}
                  onChangeText={v => {
                    set('confirm')(v);
                    setMismatch(false);
                  }}
                  placeholder="한 번 더"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={onSetup}
                />
                {mismatch && (
                  <Text style={styles.error} accessibilityLiveRegion="assertive">
                    비밀번호가 서로 달라요
                  </Text>
                )}
                <SubmitButton label="비밀번호 정하고 시작하기" onPress={onSetup} />
              </View>
              <SwitchLine>
                <SwitchText text="내 계정이 아닌가요?" />
                <TextLink label="다른 계정으로 로그인" accent onPress={() => void leaveSetup()} />
              </SwitchLine>
            </View>
          ) : (
            <View key="reset">
              <Text style={styles.title}>
                비밀번호 <Text style={styles.titleEm}>재설정</Text>
              </Text>
              <LoginNote
                tone="info"
                text="로그인 이메일을 넣으면 새 비밀번호를 정하는 링크를 보내 드려요. 메일이 안 오면 관리자에게 비밀번호 재발급을 요청하세요."
              />
              <View style={styles.form}>
                <LoginField
                  inputRef={el => {
                    inputs.current.email = el;
                  }}
                  label="이메일"
                  icon={Mail}
                  value={fields.email}
                  onChangeText={v => {
                    set('email')(v);
                    setFormError(null);
                  }}
                  placeholder="name@xtool.co.kr"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="username"
                  returnKeyType="send"
                  onSubmitEditing={onReset}
                  error={formError}
                />
                <SubmitButton label={sending ? '보내는 중…' : '재설정 메일 보내기'} onPress={onReset} />
              </View>
              <SwitchLine>
                <SwitchText text="비밀번호가 생각났나요?" />
                <TextLink label="로그인" accent onPress={() => void switchTo('login')} />
              </SwitchLine>
            </View>
          )}
        </Animated.View>
      </Animated.View>

      {!introDone && (
        <Animated.View
          entering={FadeIn.delay(600).duration(600)}
          style={[styles.skipWrap, { bottom: insets.bottom + 24 }]}
        >
          <Pressable
            style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
            onPress={() => engineRef.current?.skip()}
            accessibilityRole="button"
          >
            <Text style={styles.skipText}>건너뛰기</Text>
            <ChevronsRight size={15} color={C.text2} />
          </Pressable>
        </Animated.View>
      )}

      {introDone && (
        <Animated.Text entering={FadeIn.duration(800)} style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          © {YEAR} Originals Inc. · 사내 전용 서비스
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.page },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: STAGE_GAP,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  // 웹 .login-content(좁은 화면) — 위 44 · 옆 22 · 아래 26
  card: { paddingTop: 44, paddingHorizontal: 22, paddingBottom: 26 },
  title: { fontSize: 26, fontWeight: '800', lineHeight: 32, letterSpacing: -0.78, color: C.text1 },
  titleEm: { color: C.accentHi },
  form: { gap: 16, marginTop: 28 },
  rowEnd: { flexDirection: 'row', justifyContent: 'flex-end' },
  error: { marginTop: -6, fontSize: 12, color: C.crit },
  skipWrap: { position: 'absolute', right: 28 },
  skip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  skipPressed: { backgroundColor: 'rgba(255, 255, 255, 0.12)' },
  skipText: { fontSize: 12.5, fontWeight: '600', color: C.text2 },
  footer: { textAlign: 'center', fontSize: 11.5, color: C.text4, paddingHorizontal: 16 },
});

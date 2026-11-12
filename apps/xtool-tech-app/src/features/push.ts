import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { httpsCallable } from 'firebase/functions';
import { signOutXtool } from '@xtool-core/auth';
import { errorText } from '@xtool-core/error-text';
import { xtoolFirebase } from '@xtool-core/firebase';
import { pushToast } from '@xtool-core/tech-save-queue';
import { XtoolPush, type PushDevice } from '../../modules/xtool-push/src';
import { XTOOL_FIREBASE_CONFIG } from '../firebase-config';

// 신규 문의 알림(앱 푸시) — 아톡문의에 새 문의가 오면, 그리고 신규 문의인 채 10분을 넘기면(관리 화면 지연 알림 스위치·
// 평일 9~17시 — inquiry-delay.ts) 이 폰에 알림, 알림을 길게 눌러 "내가 맡기"(담당자 = 나, 상태 =
// 1차 안내 — 서버 functions-xtool tech-boards/push.ts). 기술팀 전원이 받고 각자 설정에서 끈다(이 기기에 남김, 처음엔 켬).
// - 로그인 뒤(startPush): 켜 두었으면 권한을 묻고(처음 한 번) 이 기기를 등록한다 — 앱을 켤 때마다 다시 등록해
//   토큰이 바뀌어도 맞춘다.
// - 끄기·로그아웃: 서버 등록을 풀고 기기 비밀 값을 지운다(로그아웃은 로그인 토큰이 있을 때 먼저 푼다).
// - 알림 본문을 누르면 그 문의 상세를 연다(usePushOpen).
// 테마 셋(Monday 표·대시보드·물)의 설정 화면은 usePushSetting 하나로 같은 기능을 그린다.

const ENABLED_KEY = 'xtool-tech:push-inquiry';
const DEVICE_KEY = 'xtool-tech:push-device';
/** 알림 단추가 부르는 주소 — 앱이 꺼져 있어도 Swift가 바로 부른다 */
const ACTION_URL = `https://us-central1-${XTOOL_FIREBASE_CONFIG.projectId}.cloudfunctions.net/techPushAction`;

/** unsupported 이 기기에서 못 받음 · off 꺼 둠 · working 켜는 중/끄는 중 · on 받는 중 · denied iPhone 설정에서 꺼짐 · error */
export type PushStatus = 'unsupported' | 'off' | 'working' | 'on' | 'denied' | 'error';

interface PushState {
  status: PushStatus;
  /** 켜 두었는지(사용자 선택) */
  enabled: boolean;
  error: string | null;
}

let state: PushState = { status: XtoolPush ? 'off' : 'unsupported', enabled: true, error: null };
const listeners = new Set<() => void>();

function update(next: Partial<PushState>) {
  state = { ...state, ...next };
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

async function readEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(ENABLED_KEY).catch(() => null);
  return raw == null ? true : raw === 'true';
}

const call = <I, O = unknown>(name: string) => httpsCallable<I, O>(xtoolFirebase().functions, name);

/** 권한을 묻고 이 기기를 등록한다 */
async function turnOn(): Promise<void> {
  if (!XtoolPush) return;
  update({ status: 'working', error: null });
  try {
    const device = await XtoolPush.enable(ACTION_URL);
    if (!device) {
      update({ status: 'denied' });
      return;
    }
    await call<PushDevice>('techRegisterPush')(device);
    await AsyncStorage.setItem(DEVICE_KEY, device.deviceId).catch(() => undefined);
    update({ status: 'on' });
  } catch (error) {
    update({ status: 'error', error: errorText(error, { fallback: '알림을 켜지 못했어요' }) });
  }
}

/** 서버 등록을 풀고 기기 비밀 값을 지운다 — 서버가 안 되더라도 기기 쪽은 지운다(그러면 단추가 거절된다) */
async function turnOff(): Promise<void> {
  if (!XtoolPush) return;
  update({ status: 'working', error: null });
  const deviceId = await AsyncStorage.getItem(DEVICE_KEY).catch(() => null);
  if (deviceId) await call<{ deviceId: string }>('techUnregisterPush')({ deviceId }).catch(() => undefined);
  await XtoolPush.disable().catch(() => undefined);
  await AsyncStorage.removeItem(DEVICE_KEY).catch(() => undefined);
  update({ status: 'off' });
}

/** 로그인 뒤 한 번 — 켜 두었으면 등록 */
export async function startPush(): Promise<void> {
  if (!XtoolPush) return;
  const enabled = await readEnabled();
  update({ enabled });
  if (enabled) await turnOn();
  else update({ status: 'off' });
}

/** 설정에서 켜고 끄기 */
export async function setPushEnabled(next: boolean): Promise<void> {
  update({ enabled: next });
  await AsyncStorage.setItem(ENABLED_KEY, String(next)).catch(() => undefined);
  if (next) await turnOn();
  else await turnOff();
}

/** 로그아웃 — 이 기기 알림 등록을 먼저 푼다(켜고 끄기 선택은 그대로 — 다시 로그인하면 다시 등록) */
export async function signOutWithPush(): Promise<void> {
  if (XtoolPush && state.status !== 'unsupported') await turnOff().catch(() => undefined);
  await signOutXtool();
}

/** 테스트 알림 — 내 기기들에 예시 알림 */
async function sendTest(): Promise<void> {
  try {
    const { data } = await call<void, { sent: number }>('techPushTest')();
    pushToast({
      tone: data.sent > 0 ? 'success' : 'error',
      title: data.sent > 0 ? '테스트 알림을 보냈어요' : '테스트 알림을 보내지 못했어요',
      message: data.sent > 0 ? '잠시 뒤 알림이 와요 — 길게 누르면 "내가 맡기" 단추가 보여요' : undefined,
    });
  } catch (error) {
    pushToast({ tone: 'error', title: '테스트 알림을 보내지 못했어요', message: errorText(error) });
  }
}

/** 상태 줄 문구 */
function describe(s: PushState): string {
  switch (s.status) {
    case 'unsupported':
      return '이 기기에서는 알림을 받을 수 없어요';
    case 'off':
      return '꺼져 있어요 — 새 문의 알림이 오지 않아요';
    case 'working':
      return s.enabled ? '알림을 켜는 중…' : '알림을 끄는 중…';
    case 'on':
      return '새 문의와 10분 지연(평일 9~17시)을 알려요 · 알림을 길게 누르면 "내가 맡기"(담당자 나 · 1차 안내)';
    case 'denied':
      return 'iPhone 설정에서 이 앱의 알림이 꺼져 있어요';
    case 'error':
      return s.error ?? '알림을 켜지 못했어요';
  }
}

const runTest = () => {
  sendTest().catch(() => undefined);
};
const openAppSettings = () => {
  Linking.openSettings().catch(() => undefined);
};
const retryOn = () => {
  turnOn().catch(() => undefined);
};

/** 로그아웃 단추 */
export const signOutPressed = () => {
  signOutWithPush().catch(() => undefined);
};

/** 설정 화면 알림 카드 — 테마 셋이 같이 쓴다 */
export function usePushSetting() {
  const s = useSyncExternalStore(subscribe, () => state);
  return {
    supported: s.status !== 'unsupported',
    enabled: s.enabled,
    status: s.status,
    busy: s.status === 'working',
    text: describe(s),
    setEnabled: (next: boolean) => {
      setPushEnabled(next).catch(() => undefined);
    },
    /** 받는 중일 때만 */
    test: s.status === 'on' ? runTest : undefined,
    /** iPhone 설정에서 꺼졌을 때 — 설정 앱 열기 */
    openSettings: s.status === 'denied' ? openAppSettings : undefined,
    /** 오류면 다시 해 보기 */
    retry: s.status === 'error' ? retryOn : undefined,
  };
}

/** 로그인한 동안 — 앱을 켤 때 등록 */
export function usePushRegistration() {
  useEffect(() => {
    startPush().catch(() => undefined);
  }, []);
}

/**
 * 알림 본문을 눌러 열렸으면 그 문의 상세로 — open이 null이면(화면 이동이 아직 준비 전) 기다린다. 꺼져 있다 켜질 때,
 * 앱으로 돌아올 때, 켜진 채로 누를 때(onOpened) 가져간다.
 */
export function usePushOpen(open: ((itemId: string) => void) | null) {
  useEffect(() => {
    const push = XtoolPush;
    if (!push || !open) return;
    const take = () => {
      push
        .takeOpened()
        .then(itemId => {
          if (itemId) open(itemId);
        })
        .catch(() => undefined);
    };
    take();
    const opened = push.onOpened(take);
    const app = AppState.addEventListener('change', next => {
      if (next === 'active') take();
    });
    return () => {
      opened.remove();
      app.remove();
    };
  }, [open]);
}

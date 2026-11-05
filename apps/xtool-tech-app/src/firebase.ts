import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, initializeAuth, type Auth } from 'firebase/auth';
// RN 전용 저장 방식은 firebase/auth(묶음 패키지)의 타입에 없어서 그 안의 @firebase/auth(react-native 조건)에서
// 가져온다 — 런타임에는 firebase/auth가 쓰는 것과 같은 모듈이다.
import { getReactNativePersistence } from '@firebase/auth';
import { connectFirestoreEmulator, getFirestore, initializeFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { provideXtoolFirebase, type XtoolFirebase } from '@xtool-core/firebase';
import { USE_EMULATOR } from './dev-settings';
import { XTOOL_FIREBASE_CONFIG } from './firebase-config';

// 앱의 Firebase — 웹(src/xtool-auth/firebase.ts)과 같은 프로젝트·데이터베이스·함수 지역. RN이라 다른 것:
// - 로그인은 AsyncStorage에 남긴다(앱을 껐다 켜도 로그인 그대로).
// - Firestore는 롱 폴링을 자동으로 고른다(RN에서 기본 연결(WebChannel)이 끊기는 일이 있다).

const APP_NAME = 'xtool';
const DATABASE_ID = 'xtool-read';

const useEmulator = __DEV__ && USE_EMULATOR;
const EMULATOR_HOST = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const EMULATOR_PORTS = { auth: 9199, firestore: 8188, functions: 5199 };
const EMULATOR_CONFIG = {
  apiKey: 'demo-key',
  authDomain: 'demo-xtool.firebaseapp.com',
  projectId: 'demo-xtool',
  appId: 'demo-app',
};

let instance: XtoolFirebase | null = null;

function xtoolFirebase(): XtoolFirebase {
  if (instance) return instance;
  const existing = getApps().some(each => each.name === APP_NAME);
  const app = existing
    ? getApp(APP_NAME)
    : initializeApp(useEmulator ? EMULATOR_CONFIG : XTOOL_FIREBASE_CONFIG, APP_NAME);
  // initialize…는 앱마다 한 번만 — 빠른 새로고침으로 다시 불리면 만든 것을 쓴다.
  const auth: Auth = existing
    ? getAuth(app)
    : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  const db = existing
    ? getFirestore(app, DATABASE_ID)
    : initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, DATABASE_ID);
  const functions = getFunctions(app, 'us-central1');
  if (useEmulator && !existing) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
    connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORTS.firestore);
    connectFunctionsEmulator(functions, EMULATOR_HOST, EMULATOR_PORTS.functions);
  }
  instance = { auth, db, functions };
  return instance;
}

provideXtoolFirebase(xtoolFirebase);

import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { provideXtoolFirebase, type XtoolFirebase } from '@xtool-core/firebase'
import { XTOOL_FIREBASE_CONFIG } from './firebase-config'

// 다른 화면(parke 등)이 다른 Firebase 프로젝트를 써도 섞이지 않게 이름 붙인 앱으로 만든다.
const APP_NAME = 'xtool'
// functions-xtool·functions-cmip이 쓰는 것과 같은 Firestore 데이터베이스.
const DATABASE_ID = 'xtool-read'

function readEmulatorFlag(): boolean {
  try {
    return window.localStorage.getItem('xtool-emulator') === '1'
  } catch {
    return false
  }
}

// 로컬 확인용 — 개발 서버에서 localStorage 'xtool-emulator'를 '1'로 두면 실제 프로젝트 대신
// Firebase 에뮬레이터(가짜 프로젝트 demo-xtool)에 붙는다. 기본 포트(9099·8080)는 다른 도구와
// 잘 겹쳐서 따로 정했다 — 에뮬레이터도 이 포트(auth 9199 · firestore 8188 · functions 5199)로
// 띄운다. 배포 빌드에서는 이 분기가 통째로 빠진다.
const useEmulator = import.meta.env.DEV && readEmulatorFlag()

const EMULATOR_PORTS = { auth: 9199, firestore: 8188, functions: 5199 }

const EMULATOR_CONFIG = {
  apiKey: 'demo-key',
  authDomain: 'demo-xtool.firebaseapp.com',
  projectId: 'demo-xtool',
  appId: 'demo-app',
}

/** 웹 앱 설정이 채워졌는지 — 비어 있으면 Firebase를 부르지 않고 안내만 띄운다. */
export const isXtoolFirebaseConfigured =
  useEmulator || Boolean(XTOOL_FIREBASE_CONFIG.apiKey && XTOOL_FIREBASE_CONFIG.appId)

let instance: XtoolFirebase | null = null

/** 처음 부를 때 초기화한다(설정이 비어 있을 때 import만으로 깨지지 않게). */
export function xtoolFirebase(): XtoolFirebase {
  if (instance) return instance
  if (!isXtoolFirebaseConfigured) {
    throw new Error('xtool Firebase 웹 앱 설정(src/xtool-auth/firebase-config.ts)이 비어 있어요')
  }
  const app = getApps().some((each) => each.name === APP_NAME)
    ? getApp(APP_NAME)
    : initializeApp(useEmulator ? EMULATOR_CONFIG : XTOOL_FIREBASE_CONFIG, APP_NAME)
  const auth = getAuth(app)
  const db = getFirestore(app, DATABASE_ID)
  const functions = getFunctions(app, 'us-central1')
  if (useEmulator) {
    connectAuthEmulator(auth, `http://127.0.0.1:${EMULATOR_PORTS.auth}`, { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', EMULATOR_PORTS.firestore)
    connectFunctionsEmulator(functions, '127.0.0.1', EMULATOR_PORTS.functions)
    // 에뮬레이터에서는 Google 팝업 대신 가짜 Google 계정으로 로그인한다.
    Object.assign(window, {
      __xtoolEmulatorGoogle: (email: string) =>
        signInWithCredential(
          auth,
          GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })),
        ),
    })
  }
  instance = { auth, db, functions }
  return instance
}

// 공용 데이터 코드(xtool-core)가 이 초기화를 쓴다
provideXtoolFirebase(xtoolFirebase)

export const googleProvider = new GoogleAuthProvider()
// 계정이 여러 개인 브라우저에서 매번 고를 수 있게.
googleProvider.setCustomParameters({ prompt: 'select_account' })

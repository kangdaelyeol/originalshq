import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth'
import { connectDatabaseEmulator, getDatabase } from 'firebase/database'
import { PARKE_FIREBASE_CONFIG } from './firebase-config'

function readEmulatorFlag() {
  try {
    return window.localStorage.getItem('parke-emulator') === '1'
  } catch {
    return false
  }
}

// 다른 화면이 다른 Firebase 프로젝트를 쓰게 되어도 섞이지 않도록 이름을
// 붙인 앱으로 만든다.
const APP_NAME = 'parke-admin'

const app = getApps().some((each) => each.name === APP_NAME)
  ? getApp(APP_NAME)
  : initializeApp(PARKE_FIREBASE_CONFIG, APP_NAME)

export const parkeAuth = getAuth(app)
export const parkeDb = getDatabase(app)

// 로컬 확인용 — 개발 서버에서 localStorage 'parke-emulator'를 '1'로 두면
// 운영 DB 대신 Firebase 에뮬레이터(인증 9099, DB 9000)에 붙는다. 배포
// 빌드에서는 이 분기가 통째로 빠진다.
if (import.meta.env.DEV && readEmulatorFlag()) {
  connectAuthEmulator(parkeAuth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  })
  connectDatabaseEmulator(parkeDb, '127.0.0.1', 9000)
  // 에뮬레이터에서는 Google 팝업 대신 가짜 Google 계정으로 로그인한다.
  Object.assign(window, {
    __parkeEmulatorSignIn: (email: string, verified = true) =>
      signInWithCredential(
        parkeAuth,
        GoogleAuthProvider.credential(
          JSON.stringify({ sub: email, email, email_verified: verified }),
        ),
      ),
  })
}

export const googleProvider = new GoogleAuthProvider()
// 계정이 여러 개인 브라우저에서 매번 고를 수 있게.
googleProvider.setCustomParameters({ prompt: 'select_account' })

/** 관리자 목록(admin/{key})의 키 — RTDB 키에는 "."를 못 써서 ","로 바꾼다.
 * 보안 규칙도 같은 방식(auth.token.email.toLowerCase().replace('.', ','))으로
 * 비교한다. */
export const adminKeyOf = (email: string) =>
  email.trim().toLowerCase().replace(/\./g, ',')

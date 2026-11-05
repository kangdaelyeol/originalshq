import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import type { Functions } from 'firebase/functions'

// xtool-core — 웹(src/screens/xtool-tech)과 앱이 같이 쓰는 기술팀 보드 데이터 코드. 화면(UI)·브라우저 기능
// (사진 줄이기·파일 올리기·저장소 등)은 넣지 않고, 플랫폼마다 다른 Firebase 초기화는 여기에 끼워 받는다.
// 웹은 src/xtool-auth/firebase.ts가, 앱은 앱의 초기화 파일이 시작할 때 provideXtoolFirebase를 부른다.

export interface XtoolFirebase {
  auth: Auth
  /** xtool-read 데이터베이스 */
  db: Firestore
  /** functions-xtool의 호출 함수(onCall) — 로그인 토큰이 저절로 실려 간다. */
  functions: Functions
}

let provider: (() => XtoolFirebase) | null = null

/** 플랫폼의 Firebase 초기화를 끼운다 — 처음 부를 때 초기화하는 함수를 넘긴다. */
export function provideXtoolFirebase(get: () => XtoolFirebase): void {
  provider = get
}

/** 지금 플랫폼의 Firebase — provideXtoolFirebase 전에 부르면 오류 */
export function xtoolFirebase(): XtoolFirebase {
  if (!provider) throw new Error('xtool Firebase가 아직 준비되지 않았어요(provideXtoolFirebase를 먼저 불러야 해요)')
  return provider()
}

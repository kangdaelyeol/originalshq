// 개발 빌드에서만 보는 설정 — 커밋할 때는 늘 끈 채로 둔다.

/**
 * 실제 프로젝트 대신 Firebase 에뮬레이터(가짜 프로젝트 demo-xtool)에 붙는다. 웹 개발 서버의 'xtool-emulator'와 같은
 * 포트(auth 9199 · firestore 8188 · functions 5199). iOS 시뮬레이터는 127.0.0.1로, Android 에뮬레이터는 10.0.2.2로
 * 맥에 닿는다.
 */
export const USE_EMULATOR = false;

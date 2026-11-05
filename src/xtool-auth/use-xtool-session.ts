// 로그인 상태·권한 — 기술팀 보드 웹·앱 공용 코드(xtool-core)로 옮겼다. 다른 화면의 import는 그대로 둔다.
// 이 경로로 쓰는 화면도 웹 Firebase 초기화가 xtool-core에 끼워지게(provideXtoolFirebase)
import './firebase'

export * from '@xtool-core/session'

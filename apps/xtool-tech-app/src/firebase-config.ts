// xtool 팀 페이지(기술팀 — 앞으로 영업팀·콜백팀)와 관리자(/admin/xtool)가 함께 쓰는 Firebase 프로젝트.
// 앱도 Firebase JS SDK라 웹 앱 'xtool-web' 설정을 그대로 쓴다(src/xtool-auth/firebase-config.ts와 같은 값 — 바꾸면 둘 다).
// 실제 보호는 Firestore 보안 규칙(firestore.rules의 xtoolMembers)이 한다.
export const XTOOL_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDA4zturkSUzdXZgIQNWTgvGxokz4nLJnU',
  authDomain: 'xtool-63b29.firebaseapp.com',
  projectId: 'xtool-63b29',
  storageBucket: 'xtool-63b29.firebasestorage.app',
  messagingSenderId: '225759276300',
  appId: '1:225759276300:web:37657c3c6c0d4b0879ed29',
}

// Google 로그인용 iOS OAuth 클라이언트 ID — Firebase 콘솔에 iOS 앱(번들 ID com.originalshq.xtooltech)을 등록하고 받은
// GoogleService-Info.plist의 CLIENT_ID. 넣을 때 Info.plist의 URL 스킴(REVERSED_CLIENT_ID)도 함께 넣는다. 비어 있으면
// 로그인 화면이 Google 버튼을 누를 때 "설정이 아직"이라고 알린다.
export const GOOGLE_IOS_CLIENT_ID: string = '225759276300-ejff7egpvjvg9jmfcpfei0ga5r45lvl8.apps.googleusercontent.com';

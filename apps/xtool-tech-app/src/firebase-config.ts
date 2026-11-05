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

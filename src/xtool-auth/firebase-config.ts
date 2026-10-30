// xtool 팀 페이지(기술팀 — 앞으로 영업팀·콜백팀)와 관리자(/admin/xtool)가 함께 쓰는 Firebase 프로젝트.
// 웹 앱 'xtool-web'(2026-10-31 등록) — 값은 Firebase 콘솔 > 프로젝트 설정 > 내 앱에 있다. 웹 설정은 비밀 값이 아니다 —
// 실제 보호는 Firestore 보안 규칙(firestore.rules의 xtoolMembers)이 한다.
// apiKey·appId가 비어 있으면 로그인 화면이 "설정이 필요해요" 안내만 띄운다.
export const XTOOL_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDA4zturkSUzdXZgIQNWTgvGxokz4nLJnU',
  authDomain: 'xtool-63b29.firebaseapp.com',
  projectId: 'xtool-63b29',
  storageBucket: 'xtool-63b29.firebasestorage.app',
  messagingSenderId: '225759276300',
  appId: '1:225759276300:web:37657c3c6c0d4b0879ed29',
}

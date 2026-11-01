# xtool 로그인·권한 — 구조와 보안 정리

xtool 팀 페이지(`/xtool-tech`, 앞으로 영업팀·콜백팀)와 관리자 화면(`/admin/xtool`)의 로그인을 어떻게
만들었는지, 어디서 무엇을 막는지 정리한 문서. Firebase Auth 공부용으로도 읽을 수 있게 개념부터 적었다.

---

## 1. 먼저 알아둘 개념 세 가지

### 1-1. 인증(Authentication)과 인가(Authorization)는 다르다

|                    | 질문               | 여기서 담당                                       |
| ------------------ | ------------------ | ------------------------------------------------- |
| **Authentication** | "너 누구야?"       | Firebase Auth — 이메일·비밀번호, Google           |
| **Autorization**   | "너 이거 해도 돼?" | 구성원 명단(`xtoolMembers`) + Firestore 보안 규칙 |

Firebase Auth는 **누구든** 계정을 만들 수 있게 열려 있다(웹 설정값이 공개라서). 그래서 "로그인 성공 =
들어와도 됨"이 아니다. 로그인한 사람이 **명단에 있는지**를 따로 확인해야 하고, 그 확인을 서버(보안 규칙)가
해야 진짜 보호가 된다.

### 1-2. ID 토큰 — 로그인하면 받는 "출입증"

로그인에 성공하면 SDK가 **ID 토큰**(JWT)을 받는다. 안에 들어 있는 것(claims):

| claim                       | 뜻                        | 규칙에서 쓰는 이름                  |
| --------------------------- | ------------------------- | ----------------------------------- |
| `sub`                       | 사용자 고유 id(uid)       | `request.auth.uid`                  |
| `email`                     | 이메일                    | `request.auth.token.email`          |
| `email_verified`            | 메일 인증을 마쳤는지      | `request.auth.token.email_verified` |
| `firebase.sign_in_provider` | `password` / `google.com` | (안 씀)                             |

- 토큰은 Google이 서명한다 → 브라우저에서 내용을 위조할 수 없다. 규칙은 이 값을 믿고 판단한다.
- 유효시간 1시간. SDK가 **refresh token**으로 알아서 새로 받아 온다.
- Firestore에 요청할 때마다 토큰이 같이 가고, 규칙이 `request.auth`로 읽는다.

### 1-3. 웹 설정값(apiKey 등)은 비밀이 아니다

[firebase-config.ts](./firebase-config.ts)의 `apiKey`는 "어느 프로젝트에 붙을지" 알려 주는 식별자일 뿐이고,
브라우저 번들에 그대로 들어간다. 이걸 숨긴다고 안전해지지 않는다. **보호는 보안 규칙이 한다.**
→ 그래서 규칙을 고치면 반드시 배포해야 하고, 규칙이 허술하면 누구나 데이터를 만질 수 있다.

---

## 2. 보안 레이어 — 바깥에서 안쪽으로

```
 브라우저                                          Google 서버
┌───────────────────────────────┐      ┌──────────────────────────────────────┐
│ ④ 화면 잠금(가드)               │      │ ① Firebase Auth                       │
│   AppLayout · AdminScreen      │      │   계정·비밀번호·Google·메일 인증·토큰 발급 │
│   → 보기 좋게 막을 뿐, 보호 X    │      │                                        │
│                               │ 토큰  │ ③ Firestore 보안 규칙  ← 진짜 문지기     │
│ SDK (firebase/auth, firestore) ├─────▶│   요청마다 토큰 + 명단 문서를 보고 판단    │
└───────────────────────────────┘      │                                        │
                                       │ ② 구성원 명단 xtoolMembers/{이메일}       │
                                       │   isAdmin · teams · status             │
                                       └──────────────────────────────────────┘
 ⑤ 규칙을 안 거치는 길: Firebase 콘솔, functions(관리자 SDK) — 사람이 아니라 우리 서버·관리자용
```

| #   | 레이어                         | 하는 일                                                   | 뚫리면?                                            |
| --- | ------------------------------ | --------------------------------------------------------- | -------------------------------------------------- |
| ①   | **Firebase Auth**              | 본인 확인, 메일 인증, 토큰 발급                           | — (Google이 운영)                                  |
| ②   | **구성원 명단** `xtoolMembers` | 누가 어느 팀 페이지·관리 화면에 들어오는지 적어 둔 데이터 | 규칙이 명단 쓰기를 관리자에게만 허락               |
| ③   | **Firestore 보안 규칙**        | 요청마다 "이 토큰의 주인이 이 문서를 읽고/써도 되나" 판단 | **유일한 서버 쪽 방어선**                          |
| ④   | **화면 잠금(가드)**            | 권한 없으면 로그인 화면으로 보내고 이유 안내              | 개발자 도구로 우회 가능 → 그래도 ③이 데이터를 막음 |
| ⑤   | **콘솔·관리자 SDK**            | 규칙을 무시하고 읽고 씀                                   | 콘솔 접근 권한(Google 계정) 관리가 곧 보안         |

> 핵심: **④는 사용자 경험, ③이 보안.** 화면 코드에서 `if (!isAdmin)`으로 막는 건 "문 앞 안내판"이고,
> 규칙이 "잠긴 문"이다.

---

## 3. 구성원 명단 — `xtoolMembers/{소문자 이메일}`

Firestore 데이터베이스 **`xtool-read`** 안.

```ts
{
  email: 'doyun@xtool.co.kr',   // 문서 id와 같아야 함(규칙이 검사)
  name: '김도윤',
  isAdmin: false,               // /admin/xtool 사용 가능
  teams: { tech: true, sales: false, callback: false },  // 팀 페이지별 권한
  status: 'active',             // 'disabled'면 정지
  createdAt, createdBy, updatedAt,   // 서버 시각(규칙이 request.time과 같은지 검사)
  uid, lastSignInAt             // 본인이 첫 로그인 때 남김 → 관리 화면의 "가입 전/활성"
}
```

**문서 id를 이메일로 한 이유**: 아직 로그인한 적 없는 사람(uid가 없는 사람)도 미리 등록할 수 있어야 해서.
로그인하면 토큰의 `email`로 자기 문서를 바로 찾는다. 대소문자 차이로 못 찾는 일이 없게 항상 소문자로
저장·비교한다(`normalizeEmail`, 규칙의 `.lower()`).

---

## 4. 보안 규칙 한 줄씩 — [firestore.rules](../../firestore.rules)의 `xtoolMembers`

### 도우미 함수

```
signedInEmail()  토큰의 email을 소문자로 (로그인 안 했으면 '')
emailVerified()  토큰의 email_verified == true
isXtoolAdmin()   메일 인증 + 내 명단 문서가 있음 + isAdmin == true + status == 'active'
validMemberFields(data)  name 1~60자, isAdmin 불리언, teams 맵, status는 active/disabled
```

### 누가 무엇을 할 수 있나

| 동작               | 허용 조건                                             | 왜                                                                                                                      |
| ------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **읽기**           | 내 이메일 문서 **또는** 관리자                        | 로그인·가입할 때 "내가 명단에 있나" 확인해야 해서 메일 인증 전에도 자기 문서는 읽게 함. 남의 문서·목록은 관리자만       |
| **만들기**(등록)   | 관리자                                                | 칸은 정해진 것만(`hasOnly`), id == email, `createdAt == request.time`, `createdBy == 내 이메일` → 시각·등록자 위조 불가 |
| **고치기**(관리자) | 관리자, `name·isAdmin·teams·status·updatedAt`만       | **자기 문서면** isAdmin은 true, status는 active로 유지해야 함 → 마지막 관리자가 스스로 잠기는 사고 방지                 |
| **고치기**(본인)   | 메일 인증 + 내 문서 + 활성 상태, `uid·lastSignInAt`만 | 로그인 기록만 남길 수 있음. 스스로 관리자 되기·팀 권한 추가 불가                                                        |
| **지우기**         | 관리자, 단 자기 문서는 불가                           | 스스로 잠김 방지                                                                                                        |

### 규칙에서 쓴 기능들 (공부 포인트)

- `request.auth` — 요청에 실린 토큰. `null`이면 로그인 안 함.
- `get()` / `exists()` — 규칙 안에서 다른 문서를 읽음(여기선 "내 명단 문서"). **읽기 1회로 과금**된다.
- `request.resource.data` — 쓰려는 **후** 모습, `resource.data` — 지금 저장된 **전** 모습.
- `diff(...).affectedKeys().hasOnly([...])` — "바뀐 칸이 이것들뿐인가". 권한 상승을 막는 핵심 패턴.
- `keys().hasOnly([...])` — 만들 때 이상한 칸(예: `uid`)을 끼워 넣지 못하게.
- `request.time` — 서버 시각. `serverTimestamp()`로 보낸 값과 비교해서 시각 위조를 막음.
- 여러 `allow update`는 **하나라도 참이면 허용**(OR). 그래서 "관리자용"과 "본인용"을 나눠 썼다.
- 규칙 계산 중 오류(없는 칸 읽기 등)는 **거부**로 처리된다 — 안전한 쪽으로 실패.

> 맨 아래 `match /{document=**}`의 기존 규칙은 2026-09-06에 만료돼 지금은 아무것도 허락하지 않는다.
> 즉 **`xtoolMembers` 말고 다른 컬렉션은 브라우저에서 전부 막혀 있다**(functions는 관리자 SDK라 상관없음).

---

## 5. 절차별 흐름

코드: [auth-actions.ts](./auth-actions.ts), [access.ts](./access.ts), [use-xtool-session.ts](./use-xtool-session.ts)

### 5-1. 이메일·비밀번호 로그인

```
1. setPersistence      "로그인 상태 유지" 체크 → local(브라우저 닫아도 유지) / 해제 → session(탭 닫으면 로그아웃)
2. signInWithEmailAndPassword   Firebase Auth가 비밀번호 확인 → 토큰 발급
3. checkAccess         내 명단 문서 읽기(규칙: 본인 문서 허용)
                       ├ 문서 없음        → not-registered
                       ├ status 정지      → disabled
                       ├ 팀 권한 없음     → no-access
                       └ 메일 미인증      → unverified (인증 메일 다시 보냄)
4. 거부면 signOut      로그인은 됐지만 바로 내보내고 이유를 화면에
5. 통과면 recordSignIn 내 문서에 uid·lastSignInAt 기록(규칙: 본인은 이 두 칸만)
```

틀린 이메일과 틀린 비밀번호는 **같은 문구**로 보여 준다 → "이 이메일이 가입돼 있나"를 알아내지 못하게
(email enumeration 방지).

### 5-2. Google 로그인

```
1. signInWithPopup     Google 창 → Google이 본인 확인. Google 계정은 email_verified가 처음부터 true
2. checkAccess         위와 같음
3. 미등록인데 처음 만들어진 계정이면 user.delete() — 아무나 눌러 본 Google 계정이 Auth 목록에 쌓이지 않게
4. 창을 닫으면 오류 없이 폼으로 돌아옴(cancelled)
```

팝업은 **클릭 처리 안에서 곧바로** 열어야 브라우저가 막지 않는다 → 연출(애니메이션)보다 먼저 호출한다.

### 5-3. 회원가입 (등록된 이메일만)

```
1. createUserWithEmailAndPassword   계정 먼저 생성(가입 전엔 명단을 볼 권한이 없어서 순서가 이렇다)
2. 내 명단 문서 확인
   ├ 없음·정지 → 방금 만든 계정 delete() + "등록되지 않은 계정"
   └ 있음      → sendEmailVerification → signOut → "인증 메일을 보냈어요"
3. 메일 링크 클릭 → email_verified = true → 그때부터 로그인 가능
```

**왜 메일 인증이 필수인가 — 막는 공격 시나리오**

> 관리자가 `doyun@xtool.co.kr`을 등록해 둠. 도윤 씨가 가입하기 전에 **다른 사람이** 그 이메일로
> 비밀번호 가입을 먼저 해 버리면? 메일 인증이 없다면 그 사람이 도윤 씨 자리로 들어온다.
> → 인증 메일은 진짜 메일함 주인만 받으므로, `email_verified`를 요구하면 이 공격이 막힌다.
> (Google 계정은 Google이 이미 소유를 확인했으므로 처음부터 verified.)

### 5-4. 비밀번호 재설정

`sendPasswordResetEmail` → 메일 링크에서 새 비밀번호 설정(Firebase가 제공하는 페이지).
가입 여부와 상관없이 같은 안내를 보여 준다(역시 이메일 존재 여부 노출 방지).

### 5-5. 화면 잠금과 실시간 반영

- `useXtoolSession(target)` — `onAuthStateChanged`로 로그인 상태를 지켜보다가 바뀌면 `checkAccess`를 다시 한다.
  결과: `loading / signedOut / denied / ready / unconfigured`.
- `/xtool-tech` 레이아웃: `ready`가 아니면 로그인 화면으로. `denied`면 로그아웃시키고 이유(정지 등)를 안내.
- 정지·권한 해제는 **페이지를 새로 열거나 다시 로그인할 때** 화면에 반영된다. 하지만 Firestore 규칙은
  **요청마다** 명단을 보므로, 관리자 권한을 뺀 순간부터 그 사람의 관리 요청은 바로 거부된다.

### 5-6. 관리자 작업 (`/admin/xtool`)

등록·권한 칩·정지·삭제 → 모두 Firestore 쓰기 → 규칙의 `isXtoolAdmin()` 통과해야 함.
명단에서 **지워도 Auth 계정은 남는다**(로그인은 되지만 명단에 없어 바로 쫓겨남). 계정까지 없애려면
콘솔 Authentication에서 삭제.

---

## 6. 지금 막지 못하는 것 / 알아둘 한계

| 항목                    | 현재                                                      | 언제 신경 쓸까                                                                                                                      |
| ----------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **보드 데이터**         | 기술지원팀 Monday 캐시(techItems·techBoardMeta·techMeta)는 규칙으로 **기술팀 활성 구성원만** 읽고, 수정은 로그인 확인하는 함수(techUpdateItem 등)만 한다. 개요 등 나머지 화면은 아직 목업 | 새 컬렉션을 화면에서 읽게 되면 같은 규칙(`isXtoolTeamMember`)을 꼭 붙인다. 화면 잠금(④)만으로는 안 된다 |
| **정지의 즉시성(화면)** | 열려 있는 화면은 새로고침 전까지 그대로 보임              | 실데이터가 붙으면 규칙이 즉시 막으므로 데이터 노출은 없음                                                                           |
| **Auth 계정 생성 자체** | 누구나 Google로 계정 생성 시도 가능(미등록이면 즉시 삭제) | 필요하면 Identity Platform의 **차단 함수(blocking function)**로 "명단에 없으면 가입 자체 거부" 가능                                 |
| **App Check**           | 안 씀                                                     | 봇이 우리 앱인 척 요청하는 걸 줄이고 싶을 때                                                                                        |
| **로그인 시도 제한**    | Firebase 기본 보호(`auth/too-many-requests`)만            | 대부분 충분                                                                                                                         |
| **콘솔 권한**           | 콘솔에 들어올 수 있는 사람은 규칙 무시                    | GCP/Firebase IAM 구성원 관리                                                                                                        |

---

## 7. 운영 체크리스트

- [ ] Authentication 켜기 → 로그인 방법: **이메일/비밀번호**, **Google**
- [ ] 승인된 도메인에 배포 도메인 추가(없으면 Google 팝업이 `auth/unauthorized-domain`)
- [ ] `firebase deploy --only firestore:rules` — 규칙 고칠 때마다
- [ ] 첫 관리자 문서는 콘솔에서 직접(콘솔은 규칙을 안 거침) — 이후는 `/admin/xtool`에서
- [ ] (선택) Authentication > 설정 > **이메일 열거 보호** 켜져 있는지 확인

## 8. 로컬 실험(에뮬레이터)

실제 계정·데이터를 건드리지 않고 규칙과 흐름을 시험할 수 있다.

```bash
# 포트: auth 9199 · firestore 8188 (8080은 다른 도구와 겹쳐서)
firebase emulators:start --only auth,firestore --project demo-xtool   # emulators 포트 설정이 있는 firebase.json에서
```

개발 서버에서 `localStorage.setItem('xtool-emulator', '1')` 후 새로고침 → 에뮬레이터에 붙는다.
Google 로그인은 개발자 도구에서 `__xtoolEmulatorGoogle('admin@xtool.test')`.
배포 빌드에는 이 코드가 들어가지 않는다(`import.meta.env.DEV`).

## 9. 더 공부할 거리 (공식 문서 키워드)

- "Firebase Auth ID tokens", "verify ID tokens" — 토큰 구조와 서버에서 검증하는 법
- "Firestore Security Rules: conditions / rules language / writing conditions" — `get`, `diff`, `hasOnly`
- "Firebase Auth email enumeration protection"
- "Auth state persistence" — local / session / none
- "Custom claims" — 명단 대신 토큰 자체에 권한을 넣는 방법(관리자 SDK 필요, 반영에 토큰 갱신이 필요한 대신 규칙에서 `get()` 비용이 없음)
- "Identity Platform blocking functions" — 가입·로그인 전에 서버에서 거부
- "Firebase App Check"

// 구성원 — 기술팀 보드 웹·앱 공용 코드(xtool-core)로 옮겼다. 다른 화면(리드 관리자·/log 등)의 import는 그대로 둔다.
// 이 경로로 쓰는 화면도 웹 Firebase 초기화가 xtool-core에 끼워지게(provideXtoolFirebase)
import './firebase'

export * from '@xtool-core/members'

// 임시 비밀번호 만들기는 관리자 화면(웹)만 쓴다 — 브라우저 crypto라 공용 코드에서 뺐다.
// 헷갈리는 글자(0·O·1·l·I)는 뺀다 — 직원에게 말로·메신저로 옮겨 적기 쉽게.
const PASSWORD_CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** 임시 비밀번호 — 10자, 글자·숫자 섞어서 */
export function generateTempPassword(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint32Array(length))
  let out = ''
  for (const b of bytes) out += PASSWORD_CHARS[b % PASSWORD_CHARS.length]
  // 숫자가 하나도 없으면 마지막 자리를 숫자로
  return /\d/.test(out) ? out : out.slice(0, -1) + String(2 + (bytes[0] % 8))
}

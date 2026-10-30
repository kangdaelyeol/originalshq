// 목업 인증 — 실제 로그인 API가 붙기 전까지 화면 확인용.

// 서버 왕복처럼 보이게 기다리는 시간 — 조각이 가운데로 모이는 연출(~0.6초)과 비슷하게.
const LATENCY_MS = 650

/** 실패 화면을 보려고 정한 임시 규칙: 비밀번호에 '!'가 들어가면 실패한다. */
export async function verifyLogin({ password }: { email: string; password: string }): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS))
  return !password.includes('!')
}

export const LOGIN_FAILED_MESSAGE = '이메일 또는 비밀번호가 올바르지 않아요. 다시 확인해 주세요.'

import { createHash } from 'crypto'

export type ActionSource = 'physical_store' | 'phone_call'

export const generateExternalId = (ph: string): string =>
  createHash('sha256').update(ph).digest('hex')

/**
 * 국제 표기(국가번호 82, 맨 앞 0 생략)로 들어온 전화번호를 국내 표기(0으로
 * 시작)로 되돌린다 — 예: "8210xxxxxxxx" → "010xxxxxxxx". 폼 연동 등에서
 * "+82 10-..." 같은 국제 표기가 숫자만 남긴 뒤에도 "82..."로 그대로 들어오는
 * 경우가 있다. 국내 번호 체계엔 82로 시작하는 지역/이동통신 코드가 없어서, 이미
 * 0으로 시작하는 국내 표기는 건드리지 않고 그대로 안전하게 변환할 수 있다.
 * 반드시 숫자만 남긴(digits-only) 문자열을 넣을 것.
 */
export const normalizeDomesticPhone = (digitsOnlyPhone: string): string =>
  digitsOnlyPhone.startsWith('82')
    ? `0${digitsOnlyPhone.slice(2)}`
    : digitsOnlyPhone

export const getActionSource = (eventTimeSec: number): ActionSource => {
  const SEVEN_DAYS_SEC = 3600 * 24 * 7

  const nowSec = Math.floor(Date.now() / 1000)

  return nowSec - eventTimeSec < SEVEN_DAYS_SEC
    ? 'physical_store'
    : 'physical_store'
}

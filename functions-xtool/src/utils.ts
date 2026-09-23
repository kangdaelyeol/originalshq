import { createHash, randomUUID } from 'crypto'

/** 상담/구매 배열 원소의 고유 id — 개별 항목 수정·삭제를 이 id로 지정한다. */
export const generateRecordId = (): string => randomUUID()

/** Meta CAPI data[].event_id — 같은 개념(무작위 UUID)이지만 레코드 id와
 * 용도가 다르다는 걸 호출부에서 명확히 하려고 별도 이름으로 뺐다. 재전송
 * (resendConsultation)마다 새로 발급한다 — 재전송은 브라우저 픽셀과 짝지어
 * 중복 제거할 이벤트가 아니라 매번 "새 CAPI 호출"이라서다. */
export const generateEventId = (): string => randomUUID()

export type ActionSource = 'website' | 'physical_store' | 'phone_call'

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

/** Meta CAPI의 action_source: website 이벤트는 event_time이 전송 시점 기준
 * 7일을 넘으면 API가 거부한다 — 그 안이면 실제 웹 출처(fbc/fbp 매칭)로 인정
 * 받을 수 있는 'website'로, 넘으면 API가 받아줄 수 있는 'physical_store'로
 * 내려보낸다. 상담(Contact)의 대상 캠페인이 "Website" conversion location +
 * "Contact" 전환 이벤트로 설정돼 있어서, 이 값이 'website'가 아니면 광고
 * 성과 측정·최적화에 안 잡힌다(physical_store는 별도 Offline 트랙 없이는
 * 이벤트 매니저 집계용으로만 남는다). */
export const getActionSource = (eventTimeSec: number): ActionSource => {
  const SEVEN_DAYS_SEC = 3600 * 24 * 7

  const nowSec = Math.floor(Date.now() / 1000)

  return nowSec - eventTimeSec < SEVEN_DAYS_SEC ? 'website' : 'physical_store'
}

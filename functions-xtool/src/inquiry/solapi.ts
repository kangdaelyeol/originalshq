// SOLAPI 문자 발송 — 상담 신청 고객에게 접수 안내 문자를 보낸다.
//
// 인증은 HMAC-SHA256: 매 요청마다 date(ISO)와 salt를 만들어 date+salt를 API
// Secret으로 서명한다. 문자 종류(SMS/LMS)는 지정하지 않아 SOLAPI가 길이로
// 고른다(90byte 넘으면 LMS, 제목이 있어도 LMS).
import * as crypto from 'crypto'
import {
  fetchWithTimeout,
  isTransientStatus,
  TransientError,
  withRetry,
} from './retry'

const SOLAPI_SEND_URL = 'https://api.solapi.com/messages/v4/send'

/** 문자 길이(byte) — 한글 등은 2byte로 센다(통신사 기준). */
export const smsBytes = (text: string) =>
  [...text].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 127 ? 2 : 1), 0)

/** 이보다 길면 장문(LMS)으로 나간다. */
export const SMS_MAX_BYTES = 90

/** 장문(LMS) 제목 최대 길이. */
export const LMS_SUBJECT_MAX_BYTES = 40

const authorization = (apiKey: string, apiSecret: string) => {
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString('hex')
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex')
  return (
    `HMAC-SHA256 apiKey=${apiKey}, date=${date}, ` +
    `salt=${salt}, signature=${signature}`
  )
}

/** 문자 한 건을 보낸다(한 번). 접수가 거부되면 던진다. */
const sendOnce = async ({
  apiKey,
  apiSecret,
  to,
  from,
  text,
  subject,
}: {
  apiKey: string
  apiSecret: string
  to: string
  from: string
  text: string
  /** 장문(LMS) 제목 — 있으면 SOLAPI가 LMS로 보낸다. */
  subject?: string
}): Promise<string> => {
  const response = await fetchWithTimeout(
    SOLAPI_SEND_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "Authorization": authorization(apiKey, apiSecret),
      },
      body: JSON.stringify({
        message: subject ? { to, from, text, subject } : { to, from, text },
      }),
    },
    'SOLAPI',
  )
  const body = (await response.json().catch(() => ({}))) as {
    messageId?: string
    statusCode?: string
    statusMessage?: string
    errorCode?: string
    errorMessage?: string
  }
  if (!response.ok || body.errorCode) {
    const reason =
      body.errorMessage ?? body.statusMessage ?? `HTTP ${response.status}`
    const code = body.errorCode ? ` (${body.errorCode})` : ''
    const message = `SOLAPI 오류: ${reason}${code}`
    // 429는 접수 전에 거절된 것이다. 5xx는 접수됐는지 알 수 없다.
    if (isTransientStatus(response.status)) {
      throw new TransientError(message, response.status !== 429)
    }
    throw new Error(message)
  }
  // 2000 = 접수 성공. 그 밖의 상태는 발송이 거부된 것이다.
  if (body.statusCode && body.statusCode !== '2000') {
    const reason = body.statusMessage ?? body.statusCode
    throw new Error(`SOLAPI 접수 실패: ${reason} (${body.statusCode})`)
  }
  return body.messageId ?? ''
}

/**
 * 문자 한 건을 보내고 SOLAPI 메시지 id와 시도 횟수를 돌려준다. 같은 문자가
 * 두 번 가지 않도록, 요청이 SOLAPI에 닿지 않은 게 확실한 오류(연결 실패·
 * 429)만 다시 시도한다. 타임아웃·5xx는 이미 접수됐을 수 있어 그대로 실패로
 * 남긴다(화면에서 확인 후 다시 보낸다).
 */
export const sendSms = async (
  params: Parameters<typeof sendOnce>[0],
): Promise<{ messageId: string; attempts: number }> => {
  const { value, attempts } = await withRetry(
    () => sendOnce(params),
    (error) => !error.sent,
  )
  return { messageId: value, attempts }
}

// SOLAPI 문자 발송 — 상담 신청 고객에게 접수 안내 문자를 보낸다.
//
// 인증은 HMAC-SHA256: 매 요청마다 date(ISO)와 salt를 만들어 date+salt를 API
// Secret으로 서명한다. 문자 종류(SMS/LMS)는 지정하지 않아 SOLAPI가 길이로
// 고른다(90byte 넘으면 LMS).
import * as crypto from 'crypto'

const SOLAPI_SEND_URL = 'https://api.solapi.com/messages/v4/send'

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

/** 문자 한 건을 보내고 SOLAPI 메시지 id를 돌려준다. 접수가 거부되면 던진다. */
export const sendSms = async ({
  apiKey,
  apiSecret,
  to,
  from,
  text,
}: {
  apiKey: string
  apiSecret: string
  to: string
  from: string
  text: string
}): Promise<string> => {
  const response = await fetch(SOLAPI_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      "Authorization": authorization(apiKey, apiSecret),
    },
    body: JSON.stringify({ message: { to, from, text } }),
  })
  const body = (await response.json()) as {
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
    throw new Error(`SOLAPI 오류: ${reason}${code}`)
  }
  // 2000 = 접수 성공. 그 밖의 상태는 발송이 거부된 것이다.
  if (body.statusCode && body.statusCode !== '2000') {
    const reason = body.statusMessage ?? body.statusCode
    throw new Error(`SOLAPI 접수 실패: ${reason} (${body.statusCode})`)
  }
  return body.messageId ?? ''
}

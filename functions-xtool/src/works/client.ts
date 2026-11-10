import { createSign } from 'crypto'
import { defineSecret } from 'firebase-functions/params'

// 네이버 웍스 봇 — 채팅방에 메시지 보내기(API 2.0). 웍스 Developer Console의
// 앱(Client ID·Secret)과 Service Account·Private Key로 JWT를 만들어 Access
// Token을 받고(24시간 — 인스턴스 메모리에 두고 다시 쓴다), 봇이 초대된
// 채팅방(channelId)에 글을 보낸다. 비밀 값은 사용자가
// `firebase functions:secrets:set`으로 넣는다 — 값을 코드·로그에 남기지 않는다.
// 옛 Lightsail 서버(works_bot.send_channel)를 대신한다.

export const worksClientId = defineSecret('WORKS_CLIENT_ID')
export const worksClientSecret = defineSecret('WORKS_CLIENT_SECRET')
export const worksServiceAccount = defineSecret('WORKS_SERVICE_ACCOUNT')
export const worksBotId = defineSecret('WORKS_BOT_ID')
export const worksPrivateKey = defineSecret('WORKS_PRIVATE_KEY')

/** 웍스 봇을 쓰는 함수의 secrets에 펼친다 */
export const WORKS_SECRETS = [
  worksClientId,
  worksClientSecret,
  worksServiceAccount,
  worksBotId,
  worksPrivateKey,
]

const TOKEN_URL = 'https://auth.worksmobile.com/oauth2/v2.0/token'
const API = 'https://www.worksapis.com/v1.0'
// 봇 메시지 보내기 권한(Developer Console 앱의 OAuth Scopes에 bot을 켠다)
const SCOPE = 'bot'
// 만료 5분 전에 새로 받는다
const EARLY_MS = 5 * 60_000
// 오류에 붙일 웍스 응답 길이
const DETAIL = 300

/** 웍스 연결·보내기 실패 — 화면에 그대로 보여도 되는 글(비밀 값 없음) */
export class WorksError extends Error {}

let cached: { token: string; expiresAt: number } | null = null

const b64url = (input: string | Buffer) =>
  Buffer.from(input).toString('base64url')

/**
 * Private Key를 PEM으로 — .key 파일 내용 그대로, 줄바꿈이 "\n" 글자로 들어간 것, 한
 * 줄로 이어 붙은 것, 머리·꼬리(-----BEGIN …-----) 없이 키 값만 넣은 것 모두 받는다.
 * 머리·꼬리와 빈칸을 떼고 64자마다 줄을 바꿔 다시 싼다.
 */
function privateKeyPem(raw: string): { pem: string; length: number } {
  const text = raw.replace(/\\n/g, '\n').trim()
  const label = /-----BEGIN ([A-Z ]+)-----/.exec(text)?.[1] ?? 'PRIVATE KEY'
  const body = text
    .replace(/-----(BEGIN|END) [A-Z ]+-----/g, '')
    .replace(/\s+/g, '')
  const lines = body.match(/.{1,64}/g) ?? []
  const pem = [`-----BEGIN ${label}-----`, ...lines, `-----END ${label}-----`]
  return { pem: `${pem.join('\n')}\n`, length: body.length }
}

/** Access Token을 받을 JWT — iss: Client ID, sub: Service Account, RS256 */
function assertion(): string {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(
    JSON.stringify({
      iss: worksClientId.value().trim(),
      sub: worksServiceAccount.value().trim(),
      iat: now,
      exp: now + 3600,
    }),
  )
  const body = `${header}.${claims}`
  const key = privateKeyPem(worksPrivateKey.value())
  let signature: Buffer
  try {
    signature = createSign('RSA-SHA256').update(body).sign(key.pem)
  } catch {
    // 읽은 키 길이만 알린다(값은 남기지 않는다) — 수십 자면 첫 줄만 들어간 것이다.
    throw new WorksError(
      'WORKS_PRIVATE_KEY를 읽지 못했어요(읽은 키 길이 ' +
        `${key.length}자 — 보통 1,500자가 넘어요). .key 파일을 --data-file로 ` +
        '넣어 주세요',
    )
  }
  return `${body}.${b64url(signature)}`
}

async function accessToken(fresh = false): Promise<string> {
  if (!fresh && cached && cached.expiresAt - EARLY_MS > Date.now()) {
    return cached.token
  }
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      assertion: assertion(),
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      client_id: worksClientId.value().trim(),
      client_secret: worksClientSecret.value().trim(),
      scope: SCOPE,
    }),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new WorksError(
      `웍스 토큰을 받지 못했어요(${response.status}): ${text.slice(0, DETAIL)}`,
    )
  }
  const data = JSON.parse(text) as {
    access_token: string
    expires_in: number | string
  }
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  }
  return cached.token
}

/** 봇이 초대된 채팅방에 글 하나 */
export const sendChannelText = (channelId: string, text: string) =>
  postText(`channels/${encodeURIComponent(channelId)}`, text)

/** 구성원 한 명에게 봇 1:1 글 — userId는 웍스 아이디(로그인 아이디, 예: name@회사도메인) */
export const sendUserText = (userId: string, text: string) =>
  postText(`users/${encodeURIComponent(userId)}`, text)

/** 글 보내기 — 토큰이 막 만료됐으면(401) 새로 받아 한 번 더 보낸다. */
async function postText(target: string, text: string): Promise<void> {
  const bot = encodeURIComponent(worksBotId.value().trim())
  const url = `${API}/bots/${bot}/${target}/messages`
  const send = (token: string) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: { type: 'text', text } }),
    })
  let response = await send(await accessToken())
  if (response.status === 401) response = await send(await accessToken(true))
  if (!response.ok) {
    const detail = (await response.text()).slice(0, DETAIL)
    throw new WorksError(
      `웍스 메시지를 보내지 못했어요(${response.status}): ${detail}`,
    )
  }
}

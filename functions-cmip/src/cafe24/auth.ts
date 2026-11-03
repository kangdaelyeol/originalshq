// Cafe24 OAuth 인증 — 토큰 발급/저장/갱신. client.ts(주문 API 호출)가
// getCafe24AccessToken/apiBase를 가져다 쓰고, index.ts는 이 파일과
// client.ts/firestore.ts/helper.ts를 조합한 오케스트레이션만 담당한다
// (monday-crm과 같은 계층 구조 — client/firestore/helper를 index가 묶는다).
//
// Cafe24 OAuth는 Google Ads와 같은 "인증 코드 → 토큰 교환 → 리프레시" 흐름
// 이지만 중요한 차이가 있다: refresh_token이 갱신될 때마다 완전히 새 값으로
// "교체"되고 기존 값은 그 즉시 무효화된다(Google은 최초 발급받은
// refresh_token을 계속 재사용). 그래서 access_token을 갱신할 때마다 같이
// 내려오는 새 refresh_token을 반드시 다시 저장해야 한다 — 안 그러면 바로
// 다음 갱신 때 이미 무효화된 refresh_token으로 실패한다. access_token은
// 2시간, refresh_token은 2주짜리라 최소 2주에 한 번은 뭐든 호출이 있어야
// 연동이 안 끊긴다(공식 문서 기준, 정책 변경 가능).
import { db } from '../data'
import { cafe24Fetch } from './request'

// 매출(주문) 데이터 조회에 필요한 최소 권한. Cafe24 앱 생성 시 이 권한을
// 미리 선택해둬야 인증 화면에 나타난다 — 여기서 요청한다고 없던 권한이
// 새로 생기지 않는다.
const CAFE24_SCOPES = ['mall.read_order']

interface Cafe24TokenResponse {
  access_token: string
  expires_at: string
  refresh_token: string
  refresh_token_expires_at: string
  client_id: string
  mall_id: string
  user_id?: string
  scopes: string[]
  issued_at: string
}

/** integrations/cafe24 문서 스키마 — 몰이 하나로 고정돼 있어(brandId 같은
 * 구분자 없이) 문서 하나에 항상 최신 토큰만 덮어쓴다. */
interface Cafe24TokenDoc {
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
  refreshTokenExpiresAt: string
  updatedAt: string
}

const cafe24TokenDoc = () => db.collection('integrations').doc('cafe24')

export const apiBase = (mallId: string): string =>
  `https://${mallId}.cafe24api.com/api/v2`

/** client_id:client_secret을 Basic 인증 헤더용으로 인코딩. */
const basicAuthHeader = (clientId: string, clientSecret: string): string =>
  `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`

/** 사용자를 Cafe24 로그인/동의 화면으로 보낼 URL — 프론트가 이 URL을 새
 * 탭으로 연다. mallId는 로그인 화면 자체의 도메인(cafe24.com)이라 API
 * 베이스(cafe24api.com)와 호스트가 다르다. */
export function buildCafe24AuthUrl(
  mallId: string,
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    state,
    redirect_uri: redirectUri,
    scope: CAFE24_SCOPES.join(','),
  })
  return `https://${mallId}.cafe24.com/api/v2/oauth/authorize?${params.toString()}`
}

async function requestCafe24Token(
  mallId: string,
  body: Record<string, string>,
  clientId: string,
  clientSecret: string,
): Promise<Cafe24TokenResponse> {
  // 다시 부르지 않고(request.ts 참고), 끊기 전에 조금 더 기다린다 — 처리된
  // 응답을 놓치면 새 refresh_token을 저장하지 못한다.
  const res = await cafe24Fetch(
    `${apiBase(mallId)}/oauth/token`,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(clientId, clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body).toString(),
    },
    { retry: false, timeoutMs: 60_000 },
  )

  const data = (await res.json()) as Cafe24TokenResponse & {
    error?: string
    error_description?: string
  }

  if (!res.ok) {
    throw new Error(
      `Cafe24 토큰 발급 실패: ${data.error_description || data.error || res.statusText}`,
    )
  }

  return data
}

async function saveCafe24Tokens(token: Cafe24TokenResponse): Promise<void> {
  const doc: Cafe24TokenDoc = {
    accessToken: token.access_token,
    accessTokenExpiresAt: token.expires_at,
    refreshToken: token.refresh_token,
    refreshTokenExpiresAt: token.refresh_token_expires_at,
    updatedAt: new Date().toISOString(),
  }
  await cafe24TokenDoc().set(doc, { merge: true })
}

/** 인증 코드 → 최초 토큰 교환 + 저장. cafe24OauthCallback이 code를 받으면 호출한다. */
export async function exchangeAndSaveCafe24Tokens(
  code: string,
  mallId: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<void> {
  const token = await requestCafe24Token(
    mallId,
    { grant_type: 'authorization_code', code, redirect_uri: redirectUri },
    clientId,
    clientSecret,
  )
  await saveCafe24Tokens(token)
}

export async function checkCafe24AuthStatus(): Promise<{
  connected: boolean
  updatedAt: string | null
}> {
  const snap = await cafe24TokenDoc().get()
  const data = snap.data() as Cafe24TokenDoc | undefined
  return {
    connected: Boolean(data?.refreshToken),
    updatedAt: data?.updatedAt ?? null,
  }
}

/** 저장된 access_token이 아직 안 만료됐으면 그대로 쓰고, 만료(또는 임박)면
 * refresh_token으로 새로 받아서 저장한 뒤 돌려준다 — 이때 Cafe24가 새
 * refresh_token도 같이 내려주므로 반드시 그것도 같이 저장한다(기존 값은
 * 이 시점에 이미 무효화됨). 앞으로 만들 주문 데이터 조회 함수가 API를
 * 부르기 직전에 항상 이 함수부터 거친다.
 *
 * forceRefresh=true면 저장된 만료 시각을 아예 안 보고 무조건 새로 받는다 —
 * 저장된 accessTokenExpiresAt이 실제 만료 시각과 어긋나 있어도(예: 여러
 * 인스턴스가 동시에 갱신하면서 서로 다른 토큰 쌍을 저장한 경우) Cafe24가
 * "access_token time expired"를 돌려줄 수 있는데, 그 경우 호출부가 이
 * 옵션으로 한 번 더 시도한다(isCafe24InvalidTokenError 참고). */
export async function getCafe24AccessToken(
  mallId: string,
  clientId: string,
  clientSecret: string,
  forceRefresh = false,
): Promise<string> {
  const snap = await cafe24TokenDoc().get()
  const data = snap.data() as Cafe24TokenDoc | undefined

  if (!data?.refreshToken) {
    throw new Error('Cafe24 연동 정보가 없습니다. 먼저 OAuth 인증을 완료해주세요.')
  }

  // 만료 1분 전부터는 미리 갱신 — 호출 도중 경계에서 만료되는 상황을 피한다.
  const expiresInMs = new Date(data.accessTokenExpiresAt).getTime() - Date.now()
  if (!forceRefresh && expiresInMs > 60_000) {
    return data.accessToken
  }

  const token = await requestCafe24Token(
    mallId,
    { grant_type: 'refresh_token', refresh_token: data.refreshToken },
    clientId,
    clientSecret,
  )
  await saveCafe24Tokens(token)
  return token.access_token
}

/** Cafe24 주문 API가 access_token 만료로 실패했을 때의 에러 메시지 패턴 —
 * client.ts가 이 에러를 잡으면 저장된
 * 만료 시각을 무시하고(getCafe24AccessToken의 forceRefresh) 한 번만 다시
 * 시도한다. */
export function isCafe24InvalidTokenError(err: unknown): boolean {
  return (
    err instanceof Error &&
    /invalid_token|access_token time expired/i.test(err.message)
  )
}

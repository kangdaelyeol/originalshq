import * as crypto from 'crypto'
import * as logger from 'firebase-functions/logger'
import { Lead, Device } from './types'
import { getActionSource, type ActionSource } from './utils'

export const DEVICE_EXPECTED_VALUE: Record<Device, number> = {
  F2Ultra: 104500,
  F2UltraUV: 195000,
  P3: 89000,
  DTF: 152000,
  Metalfab: 492000,
  F2: 800000,
  M2: 570000,
  o1: 800000,
  WonderPress: 150000,
  B2G: 1000000,
  기타: 200000,
}

export const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')

export const normalizePhoneForMeta = (digitsOnlyPhone: string) => {
  const withoutLeadingZero = digitsOnlyPhone.replace(/^0/, '').replace(/-/g, '')
  return `82${withoutLeadingZero}`
}

const hashPhoneVariants = (digitsOnlyPhone: string): string[] => {
  const withCountryCode = sha256(normalizePhoneForMeta(digitsOnlyPhone))
  const raw = sha256(digitsOnlyPhone)

  return Array.from(new Set([withCountryCode, raw]))
}

// 한국 성 가운데 두 글자인 것 — 이 목록에 없으면 첫 글자를 성으로 본다.
// ("남궁민" → 남궁 + 민, "김민수" → 김 + 민수)
const TWO_CHAR_SURNAMES = new Set([
  '남궁',
  '황보',
  '제갈',
  '선우',
  '독고',
  '사공',
  '서문',
  '동방',
  '어금',
  '망절',
  '장곡',
])

/** 값에서 한글 이름(2~4자)만 뽑는다 — 아니면 null.
 *   "김민수", "김 민수"(성과 이름을 띄운 것) → "김민수"
 *   "홍길동 대리", "김민수 님"(이름 뒤에 직함·호칭) → 앞 단어만
 *   "삼성전자서비스", "부산대학교(김재영)" → null
 * 5자 이상은 회사·기관명일 가능성이 커서 이름으로 보지 않는다. */
const koreanNameOf = (name: string): string | null => {
  const words = name.split(/\s+/).filter(Boolean)
  if (!words.every((word) => /^[가-힣]+$/.test(word))) return null

  const [first, ...rest] = words
  // 첫 단어가 성뿐이면("김 민수", "박 서 준") 나머지를 이어 붙이고, 아니면
  // 첫 단어만 이름이고 뒤는 직함·호칭이다("홍길동 대리").
  const isSurname = first.length === 1 || TWO_CHAR_SURNAMES.has(first)
  const candidate = isSurname ? first + rest.join('') : first
  return /^[가-힣]{2,4}$/.test(candidate) ? candidate : null
}

/**
 * 리드에 저장된 이름(성+이름 한 덩어리)을 Meta CAPI의 fn(이름)·ln(성)으로
 * 나눈다. 저장 형식은 그대로 두고 전송할 때만 나눈다.
 *
 * Meta는 fn·ln을 따로 받아 각각 해시해 대조하므로, 한 칸에 성+이름을 통째로
 * 넣으면 어느 쪽과도 맞지 않는다. 그래서 확실히 사람 이름으로 보이는 것만
 * 나누고, 그 밖의 값("부산대학교(김재영)", "주식회사 OO" 등)은 아예 보내지
 * 않는다 — 틀린 값을 보내느니 빼는 편이 매칭에 해가 없다.
 *
 *   · 한글 이름 2~4자(koreanNameOf): 앞 1자(두 글자 성이면 2자)가 성.
 *     "김민수" → ln 김, fn 민수 / "남궁 민" → ln 남궁, fn 민 /
 *     "홍길동 대리" → ln 홍, fn 길동
 *   · 영문 이름(글자와 띄어쓰기만): 서양식 순서로 첫 단어가 이름, 마지막
 *     단어가 성. "John Smith" → fn john, ln smith / 한 단어면 fn만.
 */
export const splitNameForMeta = (
  fullName: string | undefined,
): { fn?: string; ln?: string } => {
  const name = (fullName ?? '').trim()
  if (!name) return {}

  const hangul = koreanNameOf(name)
  if (hangul) {
    const surnameLength =
      hangul.length >= 3 && TWO_CHAR_SURNAMES.has(hangul.slice(0, 2)) ? 2 : 1
    return {
      ln: hangul.slice(0, surnameLength),
      fn: hangul.slice(surnameLength),
    }
  }

  if (/^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/.test(name)) {
    // Meta 정규화 — 소문자, 문장부호 없이.
    const words = name
      .toLowerCase()
      .replace(/['-]/g, '')
      .split(/\s+/)
      .filter(Boolean)
    return words.length === 1
      ? { fn: words[0] }
      : { fn: words[0], ln: words[words.length - 1] }
  }

  return {}
}

type MetaEventName = 'Contact' | 'Purchase'

/** website 이벤트의 event_source_url — Meta가 이벤트가 어느 사이트에서 났는지
 * (도메인 확인·웹 전환 위치) 보는 값이라, 빠지면 이벤트 관리자에 "누락" 경고가
 * 뜨고 기여·최적화에 덜 쓰인다. 상담·구매 이벤트는 CS가 등록할 때 서버에서
 * 보내 특정 페이지와 묶이지 않으므로 사이트 대표 주소를 고정으로 쓴다(고객
 * 연결은 fbc/fbp·해시 값이 한다). */
const EVENT_SOURCE_URL = 'https://www.xtool.co.kr/'

type SendMetaEventParams = {
  pixelId: string
  accessToken: string
  eventName: MetaEventName
  lead: Omit<Lead, 'id'>
  customData?: Record<string, unknown>
  eventTimeMs: number
  /** Meta 이벤트 관리자에서 테스트 이벤트로 확인할 때 쓰는 코드 — 테스트
   * 이벤트마다 값이 달라서 호출부에서 그때그때 받아온다. 최상위(data와 형제)
   * 필드라 event 객체 안이 아니라 payload 바로 아래 넣어야 한다. */
  testEventCode?: string
  /** data[].event_id — 넘기면 그대로 실어 보낸다(호출부가 utils.generateEventId로
   * 미리 발급) — 호출부가 그 값을 응답 후 레코드에 저장해 "이 이벤트가 실제로
   * 뭘로 잡혔는지" 나중에 이벤트 매니저와 대조할 수 있게 한다. */
  eventId?: string
}

type SendMetaEventResult =
  | { ok: true; result: unknown; actionSource: ActionSource; eventId?: string }
  | { ok: false; result: unknown; actionSource: ActionSource }

export const sendMetaEvent = async ({
  pixelId,
  accessToken,
  eventName,
  lead,
  customData,
  eventTimeMs,
  testEventCode,
  eventId,
}: SendMetaEventParams): Promise<SendMetaEventResult> => {
  const eventTime = Math.floor(eventTimeMs / 1000)
  const { fn, ln } = splitNameForMeta(lead.fn)

  const actionSource = getActionSource(eventTime)

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        action_source: actionSource,
        // physical_store(7일 지난 이벤트)는 웹 이벤트가 아니라 넣지 않는다.
        ...(actionSource === 'website'
          ? { event_source_url: EVENT_SOURCE_URL }
          : {}),
        ...(eventId ? { event_id: eventId } : {}),
        ...(customData ? { custom_data: customData } : {}),
        user_data: {
          ph: hashPhoneVariants(lead.ph),
          // em은 "공백 제거 + 소문자" 후 SHA-256 — sha256()이 그 정규화를
          // 이미 한다. 이메일이 없는 리드는 키 자체를 빼야 한다(빈 문자열을
          // 해시해 보내면 모든 무이메일 고객이 같은 해시로 묶인다).
          ...(lead.em ? { em: [sha256(lead.em)] } : {}),
          // 이름은 성과 이름을 나눠 각각 해시한다(splitNameForMeta 참고) —
          // 사람 이름으로 확실하지 않으면 둘 다 빠진다.
          ...(fn ? { fn: sha256(fn) } : {}),
          ...(ln ? { ln: sha256(ln) } : {}),
          external_id: lead.externalId,
          client_ip_address: lead.ip || undefined,
          client_user_agent: lead.user_agent || undefined,
          fbc: lead.fbc || undefined,
          fbp: lead.fbp || undefined,
        },
      },
    ],
    // data와 같은 레벨(최상위)에 있어야 Meta 이벤트 관리자의 테스트 이벤트로
    // 잡힌다 — event 객체 안에 넣으면 무시된다.
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  }

  const response = await fetch(
    `https://graph.facebook.com/v26.0/${pixelId}/events?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )

  const result = await response.json()

  if (!response.ok) {
    logger.error(`Meta CAPI(${eventName}) 전송 실패:`, result)
    return { ok: false, result, actionSource }
  }

  logger.info(`Meta CAPI(${eventName}) 전송 성공:`, result)
  return { ok: true, result, actionSource, eventId }
}

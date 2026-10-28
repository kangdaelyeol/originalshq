// Parké 카드 — Firebase Realtime Database `card/{cardId}`. cardId는 관리자
// 화면의 시리얼(QR 주소 마지막 부분)과 같다. 표시 규칙은 카드 웹 페이지
// (/parke/{cardId})와 같게 맞춘다.

export const CARD_THEMES = ['dark', 'light', 'amber', 'mint'] as const
export type CardTheme = (typeof CARD_THEMES)[number]

export const CARD_LAYOUTS = ['a', 'b', 'c', 'd'] as const
export type CardLayout = (typeof CARD_LAYOUTS)[number]

export const DEFAULT_ACCENT = '#383bf9'
export const SCALE_MIN = 0.85
export const SCALE_MAX = 1.3
export const MESSAGE_MAX = 40

/** DB에 저장된 모양 그대로 — 예전 카드나 잘못 저장된 값이 있을 수 있어
 * 전부 unknown으로 받는다. */
export interface CardRecord {
  title?: unknown
  phone?: unknown
  theme?: unknown
  layout?: unknown
  custom?: { accent?: unknown; scale?: unknown; message?: unknown }
  /** 예전 카드는 메시지가 custom.message가 아니라 최상위에 있다. */
  message?: unknown
  updatedAt?: unknown
  deviceId?: unknown
  ownerList?: unknown
}

/** 표시 규칙을 적용한 값. raw*는 저장값이 규칙에 맞지 않아 바꿔 보여줄 때만
 * 들어 있다(관리자 화면에서 데이터 문제를 보이려고). */
export interface ParkeCard {
  cardId: string
  title: string
  /** 숫자만. */
  phone: string
  message: string
  /** 예전 카드처럼 최상위 message를 쓴 경우. */
  legacyMessage: boolean
  theme: CardTheme
  rawTheme: string | null
  layout: CardLayout
  rawLayout: string | null
  accent: string
  rawAccent: string | null
  scale: number
  rawScale: number | null
  updatedAt: number | null
  deviceId: string | null
  owners: string[]
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')

/** 저장값이 있는데 기본값으로 바뀐 경우만 그 저장값(문자열)을 남긴다. */
const rawIfReplaced = (value: unknown, used: string) =>
  value === undefined || value === null || String(value) === used
    ? null
    : String(value)

const oneOf = <T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T,
): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback

/** 마지막 수정 시각 — ms 숫자나 날짜 문자열 모두 받는다. */
const toTime = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    return Number.isNaN(ms) ? null : ms
  }
  return null
}

/** 소유자 목록 — { uid: true } 맵이나 배열 모두 받는다. */
const toOwners = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  if (value && typeof value === 'object') return Object.keys(value)
  return []
}

export const normalizeCard = (
  cardId: string,
  record: CardRecord,
): ParkeCard => {
  const custom = record.custom ?? {}

  const theme = oneOf(CARD_THEMES, record.theme, 'dark')
  const layout = oneOf(CARD_LAYOUTS, record.layout, 'a')

  const accentText = text(custom.accent)
  const accent = /^#[0-9a-fA-F]{6}$/.test(accentText)
    ? accentText
    : DEFAULT_ACCENT

  const scaleValue =
    typeof custom.scale === 'number' && Number.isFinite(custom.scale)
      ? custom.scale
      : null
  const scale =
    scaleValue === null
      ? 1
      : Math.min(SCALE_MAX, Math.max(SCALE_MIN, scaleValue))

  const legacyMessage =
    custom.message === undefined && typeof record.message === 'string'

  return {
    cardId,
    title: text(record.title),
    phone: text(record.phone).replace(/\D/g, ''),
    message: legacyMessage ? text(record.message) : text(custom.message),
    legacyMessage,
    theme,
    rawTheme: rawIfReplaced(record.theme, theme),
    layout,
    rawLayout: rawIfReplaced(record.layout, layout),
    accent,
    rawAccent: rawIfReplaced(custom.accent, accent),
    scale,
    rawScale: scaleValue !== null && scaleValue !== scale ? scaleValue : null,
    updatedAt: toTime(record.updatedAt),
    deviceId: typeof record.deviceId === 'string' ? record.deviceId : null,
    owners: toOwners(record.ownerList),
  }
}

/** 010-1234-5678 / 02-123-4567 형식. 모르는 길이는 숫자 그대로. */
export const formatCardPhone = (digits: string) => {
  if (digits.startsWith('02')) {
    if (digits.length === 9)
      return digits.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3')
    if (digits.length === 10)
      return digits.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3')
  }
  if (digits.length === 11)
    return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  if (digits.length === 10)
    return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  return digits
}

export const THEME_LABEL: Record<CardTheme, string> = {
  dark: '다크',
  light: '라이트',
  amber: '앰버',
  mint: '민트',
}

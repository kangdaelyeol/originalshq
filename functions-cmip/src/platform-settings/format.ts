// 매체 설정을 글자 한 줄로 — 바뀌었는지 견주는 값이라 같은 설정이면 늘 같은
// 글자가 나와야 한다(목록은 정렬하고, 객체는 키 순으로).
import type { AdBudget } from '../ad-settings/types'
import type { PlatformReading } from './types'

export const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

/** 빈 조각을 빼고 ' · '로 잇는다. */
export const join = (parts: readonly (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' · ')

/** 모양을 확실히 모르는 값(OpenAI 타기팅 등)을 글자로 — 글자는 그대로, 목록은
 * 정렬해 쉼표로, 객체는 키 순으로 "키 값". */
export const plain = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  if (Array.isArray(value))
    return value.map(plain).filter(Boolean).sort().join(', ')
  return Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const text = plain(v)
      return text ? `${key} ${text}` : ''
    })
    .filter(Boolean)
    .join(' · ')
}

/** 0·없음은 예산 없음으로. */
export const budgetOf = (
  amount: number | string | null | undefined,
  period: AdBudget['period'],
): AdBudget | null => {
  const n = Number(amount ?? 0)
  return Number.isFinite(n) && n > 0 ? { amount: Math.round(n), period } : null
}

/** 숫자 칸 — 0·없음은 null(매체가 0으로 "안 걸었음"을 나타낸다). */
export const positiveOrNull = (value: number | string | null | undefined) => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 빈 칸만 채운 읽기 하나 — 매체마다 쓰는 칸만 덮는다. */
export const reading = (
  base: Omit<PlatformReading, 'fields'>,
  fields: Partial<PlatformReading['fields']>,
): PlatformReading => ({
  ...base,
  fields: {
    budget: null,
    bidding: '',
    targetCpa: null,
    targetRoas: null,
    audience: '',
    ...fields,
  },
})

/** 시각(ms) → 한국 날짜. */
export const kstDate = (ms: number) =>
  new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10)

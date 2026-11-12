// 날짜 글자(YYYY-MM-DD) 도우미 — 기술문의·대여 폼과 날짜 고르기(date-select.tsx)가 같이 쓴다. 모두 이 기기 시간대 기준.

const pad = (n: number) => String(n).padStart(2, '0')

/** 이 기기 시간대의 날짜(YYYY-MM-DD) — n일 뒤(음수면 앞) */
export const localDate = (offsetDays = 0) => {
  const at = new Date()
  at.setDate(at.getDate() + offsetDays)
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

/** YYYY-MM-DD → 2026년 11월 11일 */
export const dateText = (value: string) => {
  const [y, m, d] = value.split('-').map(Number)
  return y && m && d ? `${y}년 ${m}월 ${d}일` : value
}

/** 두 날짜 사이 날 수 — 첫날·마지막 날을 다 센다(11/12 ~ 11/14 → 3). 형식이 틀렸으면 0 */
export const daysBetween = (start: string, end: string) => {
  const from = Date.parse(`${start}T00:00:00Z`)
  const to = Date.parse(`${end}T00:00:00Z`)
  return Number.isNaN(from) || Number.isNaN(to) ? 0 : Math.round((to - from) / 86_400_000) + 1
}

/** 두 날짜 사이 영업일 수 — 첫날·마지막 날을 다 세고 토·일은 뺀다. 공휴일은 빼지 않는다(달력 자료가 없다). 형식이
 * 틀렸거나 순서가 거꾸로면 0 */
export const businessDaysBetween = (start: string, end: string) => {
  const from = Date.parse(`${start}T00:00:00Z`)
  const to = Date.parse(`${end}T00:00:00Z`)
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return 0
  let count = 0
  for (let at = from; at <= to; at += 86_400_000) {
    const day = new Date(at).getUTCDay()
    if (day !== 0 && day !== 6) count += 1
  }
  return count
}

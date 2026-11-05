// 포매터는 한 번만 만든다 — toLocaleDateString은 부를 때마다 새로 만들어서,
// 리드 표처럼 시각을 수천 번 찍는 곳에서는 그것만으로 수백 ms가 든다.
const TIME_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
})

export const formatTime = (dateNow: number) => TIME_FORMAT.format(dateNow)

// timestamp(ms) -> <input type="datetime-local"> value 형식 ("YYYY-MM-DDTHH:mm")
export const toDatetimeLocalValue = (ms: number): string => {
  if (!ms) return ''
  const date = new Date(ms)
  const offsetMs = date.getTimezoneOffset() * 60000
  const localDate = new Date(date.getTime() - offsetMs)
  return localDate.toISOString().slice(0, 16)
}

// <input type="datetime-local"> 값 -> timestamp(ms)
export const fromDatetimeLocalValue = (value: string): number => {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

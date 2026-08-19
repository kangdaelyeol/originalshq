export const formatTime = (dateNow: number) => {
  return new Date(dateNow).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  })
}

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

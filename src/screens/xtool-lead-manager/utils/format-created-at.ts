export const formatCreatedAt = (dateNow: number) => {
  return new Date(dateNow).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  })
}

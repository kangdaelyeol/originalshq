export const formatPhoneNumber = (ph: string) => {
  const trimmedNumber = ph.replace(/\D/g, '').slice(0, 12)

  if (trimmedNumber.length <= 3) return trimmedNumber
  if (trimmedNumber.length <= 7)
    return `${trimmedNumber.slice(0, 3)}-${trimmedNumber.slice(3)}`
  return `${trimmedNumber.slice(0, 3)}-${trimmedNumber.slice(3, 7)}-${trimmedNumber.slice(7)}`
}

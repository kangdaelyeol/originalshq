export type UserContact = {
  createdAt: number
  utmCampaign: string
  utmSource: string
  utmMedium: string
  ip: string
  name: string
  device: string
  fbc: string
  fbp: string
  userAgent: string
}

export type UserPurchase = UserContact & {
  purchasedAt: number
  price: number
}
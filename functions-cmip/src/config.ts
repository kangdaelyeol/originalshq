// 함수 공통 설정 — 지역·인스턴스 수와 시크릿. setGlobalOptions는 onRequest·
// onSchedule을 만드는 순간에 읽히므로, 함수를 만드는 파일(endpoints/*)은 모두
// 이 파일을 먼저 import한다(시크릿이 필요 없으면 import '../config').
import { setGlobalOptions } from 'firebase-functions/v2'
import { defineSecret } from 'firebase-functions/params'

setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10 })

export const metaAdsId = defineSecret('META_INSIGHT_ACCESS_TOKEN')
export const googleClientId = defineSecret('GOOGLE_CLIENT_ID')
export const googleClientSecret = defineSecret('GOOGLE_CLIENT_SECRET')
export const googleDeveloperToken = defineSecret('GOOGLE_DEVELOPER_TOKEN')
export const naverSecretKey = defineSecret('NAVER_SECRET_KEY')
export const naverAccessLicense = defineSecret('NAVER_ACCESS_LICENSE')
export const openaiAdsApiKey = defineSecret('OPENAI_ADS_API_KEY')
export const cafe24ClientId = defineSecret('CAFE24_CLIENT_ID')
export const cafe24SecretKey = defineSecret('CAFE24_SECRET_KEY')
export const daangnAdsApiKey = defineSecret('DAANGN_ADS_API_KEY')

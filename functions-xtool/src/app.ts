// 모든 함수가 같이 쓰는 준비물 — Firebase 앱·DB·전역 옵션·시크릿.
//
// endpoints/*.ts가 이 파일을 먼저 import하므로, 함수를 정의하기 전에
// initializeApp과 setGlobalOptions가 항상 먼저 실행된다.
import { setGlobalOptions } from 'firebase-functions'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'

initializeApp()

export const db = getFirestore('xtool-read')
setGlobalOptions({ maxInstances: 10 })

export const metaPixelId = defineSecret('META_PIXEL_ID')
export const metaAccessToken = defineSecret('META_ACCESS_TOKEN')
// cmip 코드베이스와 같은 프로젝트(Secret Manager)의 시크릿을 같은 이름으로 쓴다.
export const ga4MeasurementId = defineSecret('GA4_MEASUREMENT_ID')
export const ga4ApiSecret = defineSecret('GA4_API_SECRET')
export const mondayApiKey = defineSecret('MONDAY_API_KEY')
// 상담 신청 접수 안내 문자(SOLAPI).
export const solapiApiKey = defineSecret('SOLAPI_API_KEY')
export const solapiApiSecret = defineSecret('SOLAPI_API_SECRET')

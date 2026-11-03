// 당근 광고 OpenAPI(Karrot Ads OpenAPI, Beta) — https://ads-openapi.kr.karrotmarket.com
// 문서: https://businessdaangn.gitbook.io/business.daangn/ads-pro/tools/openapi
// 키(X-API-KEY)는 광고 계정 하나에 묶여 있고, 요청마다 X-ADVERTISER-ID로 그 계정을
// 지정한다. 전문가모드 광고 계정만 조회된다.

export const API_BASE_URL = 'https://ads-openapi.kr.karrotmarket.com'

/** 광고 계정 ID(광고주 ID) — 민감정보가 아니라 상수. */
export const ADVERTISER_ID = '4620635'

/** 목록 API 한 쪽의 크기. */
export const PAGE_SIZE = 100

/** 성과 API 한 번의 한도 — ID 50개, 기간 31일(문서). */
export const PERFORMANCE_MAX_IDS = 50
export const PERFORMANCE_MAX_DAYS = 31

export const API_BASE_URL = 'https://api.searchad.naver.com'

// /stats 조회 시 fields 파라미터로 요청할 지표 — 필요한 4개(노출/클릭/비용/전환)만
// 최소로 받는다. 문서: https://naver.github.io/searchad-apidoc/#/operations/GET/stats
export const STAT_FIELDS = ['impCnt', 'clkCnt', 'salesAmt', 'ccnt'] as const

// 네이버 검색광고 "도구 > API 사용 관리" 화면에 뜨는 CUSTOMER ID — API
// KEY/SECRET KEY와 달리 민감정보가 아니라 Secret 대신 상수로 둔다(Meta의
// xTool_MAIN_ADS_ID와 같은 성격).
export const CUSTOMER_ID = '1563738'

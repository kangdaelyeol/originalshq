export const API_BASE_URL = 'https://api.searchad.naver.com'

// /stats 조회 시 fields 파라미터로 요청할 지표 — 노출/클릭/비용/전환에 더해
// convAmt(전환매출액)를 추가했다. convAmt는 네이버 공식 2022-04-19 공지
// (http://naver.github.io/searchad-apidoc/notice/2022/04/19/notice1/)의
// 필드 목록엔 있지만, 네이버 자체 자바 샘플 코드(Stat.java)와 일부 서드파티
// 래퍼에는 빠져 있어 실제로 값이 채워져 오는지 라이브 호출로 확인이 필요하다
// — 안 내려오면 revenue는 그냥 0으로 남는다(에러는 아님).
export const STAT_FIELDS = [
  'impCnt',
  'clkCnt',
  'salesAmt',
  'ccnt',
  'convAmt',
] as const

// 네이버 검색광고 "도구 > API 사용 관리" 화면에 뜨는 CUSTOMER ID — API
// KEY/SECRET KEY와 달리 민감정보가 아니라 Secret 대신 상수로 둔다(Meta의
// xTool_MAIN_ADS_ID와 같은 성격).
export const CUSTOMER_ID = '1563738'

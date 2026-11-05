// 네이버 애드부스트/쇼핑부스트업/GFA 등 검색광고가 아닌 네이버 매체의 통합 캠페인 라벨.
// 요약형 파서와 per-row 파서가 반드시 같은 문자열을 써야 캠페인 목록에서 쪼개지지 않는다.
export const NAVER_OTHER_MEDIA_LABEL = '네이버 기타매체 (애드부스트/GFA)'

// 임계값
export const CPA_SURGE_PCT = 20.0
export const CPA_IMPROVE_PCT = -15.0
export const CTR_DROP_PCT = -25.0
export const COST_UP_PCT = 10.0
export const CONV_DOWN_PCT = -10.0

// 소재 유사도(안드로메다 유사 분석 — creative-similarity). Meta가 내부 기준을
// 공개하지 않아 아래 값은 출발점이다 — 실제 소재로 보며 고친다.
/** 같은 프레임으로 볼 pHash 거리(64비트 중 다른 비트 수). 테스트 그림으로 잰
 * 거리 — 크기·화질만 바꾼 것 0, 밝기 2, 살짝 잘라낸 것 8, 0.5초 뒤 프레임 12,
 * 자막 띠를 얹은 것 18~24, 다른 장면 28~36. */
export const FRAME_MATCH_BITS = 12
/** 이 점수(0~1) 이상이면 같은 묶음(엔티티) — 안드로메다가 한 광고처럼 다룬다고
 * 보는 겹침. 퍼셉트론 ft:diversity의 "0.35 미만이면 중복"과 짝(1 − 0.65). */
export const SAME_ENTITY_MIN = 0.65
/** 프롬프트의 "겹치는 소재"에 넣을 최소 점수 — 거의 안 겹치는 소재는 뺀다. */
export const OVERLAP_LIST_MIN = 0.3
/** 컨셉 칸마다 무게(합 1) — 톤·CTA는 xtool 소재끼리 거의 같아 뺐다. */
export const CONCEPT_WEIGHTS = {
  message: 0.3,
  topic: 0.2,
  hook: 0.2,
  persona: 0.15,
  format: 0.15,
} as const
/** 비교 범위 — 이 광고 계정의 Meta 소재 중 오늘 포함 이 날수 안에 집행한 것
 * (하루치 동기화가 빠져도 빠지지 않게 2일). */
export const SIMILARITY_ACTIVE_DAYS = 2

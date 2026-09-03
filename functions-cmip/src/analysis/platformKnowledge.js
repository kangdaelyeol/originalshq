/**
 * 매체 공식 운영 지식 — Python `src/analysis/platform_knowledge.py` 이관.
 * analyzer 진단 분기와 (선택) AI 애널리스트 프롬프트의 근거로 사용한다.
 */

export const META_LEARNING = `\
[Meta 학습 단계(Learning Phase)]
- 정의: 새 광고세트/캠페인이 최적 노출 대상을 찾는 초기 탐색 구간. 이 기간의 CPA 변동은 정상.
- 종료 기준: 7일 이내 최적화 이벤트(전환) 약 50건 도달 시 학습 완료.
- 리셋 조건: 예산 20% 이상 변경, 타겟팅 변경, 소재 추가/교체, 입찰 전략 변경.
- Learning Limited: 7일 내 50건을 못 채울 것으로 예상되는 상태(예산 부족/좁은 타겟).
- 시사점: 학습 중 CPA 급등락은 "문제"가 아닐 수 있음. 예산 변경은 학습 안정 후에.
`;

export const GOOGLE_QS = `\
[Google Ads 품질평가점수(Quality Score)]
- 3개 구성요소(평균이상/평균/평균이하, 최근 90일 동일 검색어 상대평가):
  1) 예상 클릭률(Expected CTR)  2) 광고 관련성(Ad Relevance)  3) 랜딩페이지 경험(Landing Page Experience)
- 키워드 단위 1~10점. 공식적으로는 "진단 도구"이나, 품질점수가 낮으면 동일 순위 확보에 CPC가 더 든다.
- 시사점: CPC 상승을 "경쟁 심화" 탓만 하지 말고 3요소 중 어디가 평균 이하인지 점검.
- PMax/디맨드젠: 여러 네트워크 자동 노출 → 채널별보다 전체 전환 중심으로 평가.
`;

export const NAVER_QI = `\
[네이버 검색광고 품질지수]
- 정의: 키워드-소재-랜딩페이지 연관성 + 실제 성과(CTR·CVR) 종합 상대 점수.
- 척도: 1~7단계. 최초 게재 시 초기값 4, 게재 24시간 후부터 실측 반영.
- 순위식: 노출순위지수 = 입찰가 × 품질지수 → 입찰가만 올려선 상단 노출 보장 안 됨.
- 6단계 이상: 노출순위 상승 + 광고비 절감 혜택.
- 시사점: CPA가 높을 때 입찰가 조정 전에 소재-키워드 일치도, 랜딩페이지 관련성부터 점검.
- 브랜드 검색: CPA가 아니라 CTR·도달·검색량 중심으로 평가.
`;

export const SYSTEM_CONTEXT = [META_LEARNING, GOOGLE_QS, NAVER_QI].join("\n");

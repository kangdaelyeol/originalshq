/** 배치 함수가 도는 시각(KST, 시) — functions-xtool·functions-cmip의 모든
 * onSchedule이 '0 9,11,13,15,17,22 * * *'로 같다. 바꾸면 여기도 고친다. */
export const SCHEDULE_HOURS = [9, 11, 13, 15, 17, 22] as const

export interface BatchJob {
  /** batchRuns 기록의 job 값. */
  id: string
  label: string
  description: string
  codebase: 'xtool' | 'cmip'
  /** Firebase에 배포된 함수 이름 — 콘솔 로그를 찾아볼 때 쓴다. */
  functionName: string
  /** 함수 제한 시간(초) — 이보다 오래 "실행 중"이면 시간 초과로 본다. */
  timeoutSeconds: number
  /** 나중에 더한 작업만 — 기록을 남기기 시작한 첫 예약 시각. 그 전 칸은
   * 누락이 아니라 "기록 전"이다(코드베이스의 기록 시작보다 늦을 때). */
  recordingSince?: string
}

/** 화면에 보여 줄 배치 작업 — 순서가 곧 카드 순서다. */
export const BATCH_JOBS: readonly BatchJob[] = [
  {
    id: 'monday-sync',
    label: 'Monday 보드 동기화',
    description:
      'Monday 보드 16개를 읽어 저장하고, 통합 고객·통계(인입·판매·방치·KPI·재구매)와 cmip가 읽는 오프라인 매출 원장을 다시 만듭니다.',
    codebase: 'xtool',
    functionName: 'syncMondayBoardsScheduled',
    timeoutSeconds: 540,
  },
  {
    id: 'ga-events',
    label: 'GA4 이벤트 수집',
    description:
      'GA ClientId가 적힌 상담의 GA4 이벤트를 BigQuery에서 모아 저장합니다(오기입 추적). Monday 동기화 직후에 돕니다.',
    codebase: 'xtool',
    functionName: 'syncMondayBoardsScheduled',
    timeoutSeconds: 540,
  },
  {
    id: 'tech-boards',
    label: '기술팀 보드 동기화',
    description:
      '기술지원팀 Monday 보드 9개를 다시 읽어 xtool-tech 화면이 읽는 캐시를 맞춥니다. 평소 변경은 webhook으로 몇 초 안에 들어오고, 이 작업은 놓친 것을 메웁니다.',
    codebase: 'xtool',
    functionName: 'syncTechBoardsScheduled',
    timeoutSeconds: 300,
    recordingSince: '2026-11-01T09:00:00+09:00',
  },
  {
    id: 'cafe24-orders',
    label: 'Cafe24 주문',
    description: '최근 30일 주문·환불을 다시 읽어 저장합니다.',
    codebase: 'cmip',
    functionName: 'syncCafe24OrdersScheduled',
    timeoutSeconds: 300,
  },
  {
    id: 'meta-insights',
    label: 'Meta 인사이트',
    description: '최근 14일 광고 성과를 다시 읽어 저장합니다.',
    codebase: 'cmip',
    functionName: 'syncMetaInsightsScheduled',
    timeoutSeconds: 300,
  },
  {
    id: 'meta-ads',
    label: 'Meta 광고 단위',
    description:
      '최근 14일 광고(소재)별 광고비와 광고 → 광고셋 → 캠페인 연결을 다시 읽어 저장합니다(cmip 광고 성과 탭). Meta 인사이트 직후에 돕니다.',
    codebase: 'cmip',
    functionName: 'syncMetaInsightsScheduled',
    timeoutSeconds: 300,
  },
  {
    id: 'meta-creatives',
    label: 'Meta 소재',
    description:
      '집행 중인 광고의 소재(이미지·영상)를 찾아 원본과 분석용 프레임을 Storage에 모읍니다. 새 소재는 제한 시간 안에서 처리하고, 남은 것은 다음 실행에 이어 합니다.',
    codebase: 'cmip',
    functionName: 'syncMetaCreativesScheduled',
    timeoutSeconds: 540,
    recordingSince: '2026-11-04T09:00:00+09:00',
  },
  {
    id: 'daangn-creatives',
    label: '당근 소재',
    description:
      '집행 중인 당근 소재(영상·이미지)를 찾아 원본(영상은 스트리밍을 mp4로)과 분석용 프레임을 Storage에 모읍니다.',
    codebase: 'cmip',
    functionName: 'syncDaangnCreativesScheduled',
    timeoutSeconds: 540,
    recordingSince: '2026-11-04T09:00:00+09:00',
  },
  {
    id: 'google-creatives',
    label: 'Google 소재',
    description:
      '집행 중인 광고에 붙은 이미지 에셋을 찾아 원본과 분석용 프레임을 Storage에 모읍니다. YouTube 영상은 매체가 파일을 주지 않아 모으지 않습니다.',
    codebase: 'cmip',
    functionName: 'syncGoogleCreativesScheduled',
    timeoutSeconds: 540,
    recordingSince: '2026-11-04T17:00:00+09:00',
  },
  {
    id: 'naver-creatives',
    label: '네이버 소재',
    description:
      '집행 중인 광고그룹의 이미지 소재(쇼핑 상품·콘텐츠·브랜드검색 광고, 이미지 확장소재)를 찾아 원본과 분석용 프레임을 Storage에 모읍니다. 문구뿐인 광고는 모으지 않습니다.',
    codebase: 'cmip',
    functionName: 'syncNaverCreativesScheduled',
    timeoutSeconds: 540,
    recordingSince: '2026-11-04T17:00:00+09:00',
  },
  {
    id: 'openai-creatives',
    label: 'OpenAI 소재',
    description:
      '집행 중인 ChatGPT 광고(채팅 카드)의 이미지를 찾아 원본과 분석용 프레임을 Storage에 모읍니다.',
    codebase: 'cmip',
    functionName: 'syncOpenaiCreativesScheduled',
    timeoutSeconds: 540,
    recordingSince: '2026-11-04T17:00:00+09:00',
  },
  {
    id: 'google-insights',
    label: 'Google Ads 인사이트',
    description: '최근 14일 캠페인·광고그룹 성과를 다시 읽어 저장합니다.',
    codebase: 'cmip',
    functionName: 'syncGoogleInsightsScheduled',
    timeoutSeconds: 300,
  },
  {
    id: 'naver-insights',
    label: '네이버 인사이트',
    description: '최근 14일 검색광고 성과를 다시 읽어 저장합니다.',
    codebase: 'cmip',
    functionName: 'syncNaverInsightsScheduled',
    timeoutSeconds: 300,
  },
  {
    id: 'openai-insights',
    label: 'OpenAI 인사이트',
    description: '최근 14일 OpenAI 광고 성과를 다시 읽어 저장합니다.',
    codebase: 'cmip',
    functionName: 'syncOpenaiInsightsScheduled',
    timeoutSeconds: 300,
    recordingSince: '2026-10-30T17:00:00+09:00',
  },
  {
    id: 'daangn-insights',
    label: '당근 인사이트',
    description: '최근 14일 당근 광고그룹 성과를 다시 읽어 저장합니다.',
    codebase: 'cmip',
    functionName: 'syncDaangnInsightsScheduled',
    timeoutSeconds: 300,
    recordingSince: '2026-11-04T09:00:00+09:00',
  },
]

/** 조회 기간 선택지(일). */
export const PERIOD_OPTIONS = [
  { days: 1, label: '오늘' },
  { days: 7, label: '최근 7일' },
  { days: 30, label: '최근 30일' },
] as const

/** 목록을 다시 받아 오는 간격 — 화면을 켜 두면 알아서 최신이 된다. */
export const AUTO_REFRESH_MS = 60_000

/** 사용 분석 흐름 그림에 올리는 탭 수 — 많으면 선이 엉킨다. */
export const MAX_FLOW_VIEWS = 8

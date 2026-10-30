// 프롬프트 퍼셉트론 목업 데이터 — 입력층(신호) → 은닉층(특징·인코더·게이트)
// → 출력층(프롬프트 노드 하나). 케이스 하나가 이 망을 지나 마지막 노드에서
// AI 프롬프트 한 장이 된다. 값은 전부 화면 확인용 예시다.

export type Tone = 'accent' | 'white'

/** 카드의 값 줄 — [이름, 값, 색(기둥 강조색이면 'accent')]. */
export type NodeRow = [string, string, Tone?]

export interface ColumnDef {
  num: string
  title: string
  /** 기둥 고유색 — 카드 점·값·아래 막대·머리 밑줄. */
  color: string
  /** 위쪽 단계 버튼 이름. */
  stage: string
}

export const COLUMNS: ColumnDef[] = [
  { num: '01', title: 'INPUT / SIGNALS', color: '#45c8da', stage: 'INPUT' },
  { num: '02', title: 'FEATURE / TYPED', color: '#e5546f', stage: 'FEATURE' },
  { num: '03', title: 'HIDDEN / ENCODER', color: '#8f86ff', stage: 'HIDDEN' },
  { num: '04', title: 'GATE / SECTIONS', color: '#e9c24a', stage: 'GATE' },
  { num: '05', title: 'OUTPUT / PROMPT', color: '#cfe85e', stage: 'PROMPT' },
]

export interface NodeDef {
  id: string
  col: number
  row: number
  title: string
  rows: NodeRow[]
}

const n = (
  id: string,
  col: number,
  row: number,
  title: string,
  rows: NodeRow[],
): NodeDef => ({ id, col, row, title, rows })

/** 입력층·은닉층 카드 — 기둥마다 8개. */
export const NODES: NodeDef[] = [
  // 01 입력층 — 소재·설정·성과 등 날것의 신호
  n('in:video', 0, 0, 'creative · video', [
    ['frames', '34', 'accent'],
    ['length', '15.1 s'],
    ['ratio', '9:16'],
  ]),
  n('in:setting', 0, 1, 'ad set · setting', [
    ['goal', '문의', 'accent'],
    ['budget', '일 50 000'],
    ['set', 'F2U 영상 B'],
  ]),
  n('in:perf', 0, 2, 'perf · 14d', [
    ['CPA', '48 352'],
    ['CTR', '1.49 %', 'accent'],
    ['CVR', '0.75 %'],
  ]),
  n('in:test', 0, 3, 'test · segments', [
    ['segments', '2'],
    ['winner', '구간 A', 'accent'],
    ['delta', '−11.8 %'],
  ]),
  n('in:landing', 0, 4, 'landing · page', [
    ['offer', '무료 상담', 'accent'],
    ['cta', '상담 신청'],
    ['load', '2.1 s'],
  ]),
  n('in:audience', 0, 5, 'audience · notes', [
    ['mode', 'broad'],
    ['exclude', '기존 고객', 'accent'],
    ['geo', 'KR'],
  ]),
  n('in:brand', 0, 6, 'brand · guide', [
    ['tone', '친근 · 전문'],
    ['banned', '최저가', 'accent'],
    ['logo', '≤ 3 s'],
  ]),
  n('in:library', 0, 7, 'creatives · library', [
    ['total', '37'],
    ['concepts', '12', 'accent'],
    ['dupes', '4'],
  ]),

  // 02 은닉층 1 — 정해진 형식의 질문(특징)
  n('ft:hook', 1, 0, 'Choice · hook_type', [
    ['options', '6'],
    ['labels', '결과 | 문제', 'accent'],
    ['policy', 'in frames'],
  ]),
  n('ft:strength', 1, 1, 'Score · hook_strength', [
    ['scale', '1–5'],
    ['ordered', 'true'],
    ['floor', '3', 'accent'],
  ]),
  n('ft:funnel', 1, 2, 'Choice · funnel', [
    ['options', '3'],
    ['labels', '인지 | 전환', 'accent'],
    ['source', 'goal'],
  ]),
  n('ft:cpa', 1, 3, 'Score · cpa_trend', [
    ['window', '14 d'],
    ['ordered', 'true'],
    ['floor', '−10 %', 'accent'],
  ]),
  n('ft:offer', 1, 4, 'Flag · has_offer', [
    ['type', 'yes / no', 'accent'],
    ['confidence', 'attached'],
    ['owner', 'landing'],
  ]),
  n('ft:diversity', 1, 5, 'Score · diversity', [
    ['vs', '37'],
    ['ordered', 'true'],
    ['floor', '0.35', 'accent'],
  ]),
  n('ft:persona', 1, 6, 'Choice · persona', [
    ['options', '4'],
    ['labels', '공방 | 창업', 'accent'],
    ['policy', 'no sensitive'],
  ]),
  n('ft:risk', 1, 7, 'Flag · policy_risk', [
    ['type', 'yes / no', 'accent'],
    ['confidence', 'attached'],
    ['owner', 'meta'],
  ]),

  // 03 은닉층 2 — 인코더(안드로메다 관점 포함)
  n('hd:frames', 2, 0, 'frame encoder', [
    ['input', '34 frames'],
    ['tokens', '~42k', 'accent'],
    ['output', 'vectors'],
  ]),
  n('hd:transcript', 2, 1, 'transcript encoder', [
    ['source', 'STT'],
    ['lines', '12', 'accent'],
    ['lang', 'ko'],
  ]),
  n('hd:andromeda', 2, 2, 'andromeda lens', [
    ['entity', 'concept'],
    ['dedupe', 'on', 'accent'],
    ['diversity', '0.62'],
  ]),
  n('hd:concept', 2, 3, 'concept fingerprint', [
    ['angle', '결과 먼저'],
    ['format', 'UGC 9:16', 'accent'],
    ['hook', '0–3 s'],
  ]),
  n('hd:persona', 2, 4, 'persona head', [
    ['ranked', 'top 3'],
    ['conf', '0.88', 'accent'],
    ['sensitive', 'none'],
  ]),
  n('hd:perf', 2, 5, 'perf head', [
    ['signal', 'CPA'],
    ['window', '14 d'],
    ['trend', '−11.8 %', 'accent'],
  ]),
  n('hd:policy', 2, 6, 'policy check', [
    ['claims', '과장 없음'],
    ['b / a', 'none', 'accent'],
    ['risk', 'low'],
  ]),
  n('hd:latency', 2, 7, 'median latency', [
    ['reported', '~312 ms', 'accent'],
    ['demo', 'public'],
    ['SLA', 'no'],
  ]),

  // 04 은닉층 3 — 게이트: 어느 섹션으로 보낼지
  n('gt:gate', 3, 0, 'gate ≥ 0.80', [
    ['floor', '0.80', 'accent'],
    ['calibrate', 'on yours'],
    ['kind', 'starting'],
  ]),
  n('gt:role', 3, 1, 'role', [
    ['who', '퍼포먼스 마케터'],
    ['voice', '한국어', 'accent'],
    ['depth', 'expert'],
  ]),
  n('gt:context', 3, 2, 'context', [
    ['account', 'xtool'],
    ['creatives', '37', 'accent'],
    ['window', '14 d'],
  ]),
  n('gt:task', 3, 3, 'task', [
    ['verb', '분석 → 제안', 'accent'],
    ['scope', '1 소재'],
    ['depth', 'full'],
  ]),
  n('gt:constraints', 3, 4, 'constraints', [
    ['no', '민감 속성', 'accent'],
    ['policy', 'Meta ads'],
    ['length', '≤ 1 200'],
  ]),
  n('gt:schema', 3, 5, 'output schema', [
    ['format', 'JSON', 'accent'],
    ['fields', '24'],
    ['strict', 'true'],
  ]),
  n('gt:examples', 3, 6, 'examples', [
    ['shots', '2'],
    ['source', 'top CPA', 'accent'],
    ['masked', 'yes'],
  ]),
  n('gt:selfcheck', 3, 7, 'self-check', [
    ['verify', 'fields'],
    ['retry', '1', 'accent'],
    ['fallback', 'human'],
  ]),
]

/** 출력층 — 노드 하나(PROMPT)의 칸들. 게이트 기둥과 같은 줄에 맞춰 섹션이
 * 쌓이고, 경로가 닿으면 위에서부터 차례로 조립된다. */
export interface SectionDef {
  id: string
  row: number
  title: string
  rows: NodeRow[]
}

export const SECTIONS: SectionDef[] = [
  {
    id: 'out:head',
    row: 0,
    title: 'PROMPT · claude-opus-5-5',
    rows: [
      ['version', 'v12', 'accent'],
      ['tokens', '2 184'],
      ['mode', 'structured'],
    ],
  },
  {
    id: 'out:role',
    row: 1,
    title: '## role',
    rows: [
      ['as', '퍼포먼스 마케터'],
      ['lang', '한국어', 'accent'],
      ['tone', '근거 먼저'],
    ],
  },
  {
    id: 'out:context',
    row: 2,
    title: '## context',
    rows: [
      ['account', 'xtool · 37 소재'],
      ['window', '14 d', 'accent'],
      ['signals', '8'],
    ],
  },
  {
    id: 'out:task',
    row: 3,
    title: '## task',
    rows: [
      ['do', '주성분 · 타겟'],
      ['for', '1 소재', 'accent'],
      ['then', '개선 제안'],
    ],
  },
  {
    id: 'out:constraints',
    row: 4,
    title: '## constraints',
    rows: [
      ['never', '민감 속성', 'accent'],
      ['flag', 'Meta 정책'],
      ['max', '1 200 tok'],
    ],
  },
  {
    id: 'out:output',
    row: 5,
    title: '## output',
    rows: [
      ['format', 'JSON', 'accent'],
      ['fields', '24'],
      ['strict', 'true'],
    ],
  },
  {
    id: 'out:examples',
    row: 6,
    title: '## examples',
    rows: [
      ['shots', '2'],
      ['from', 'top CPA', 'accent'],
      ['pii', 'masked'],
    ],
  },
  {
    id: 'out:selfcheck',
    row: 7,
    title: '## self-check',
    rows: [
      ['verify', '필드 24'],
      ['retry', '1', 'accent'],
      ['else', 'human'],
    ],
  },
]

/** 12가지 쓰임 — 아래 "12 USE CASES" 격자. */
export const USE_CASES = [
  'creative',
  'hook',
  'targeting',
  'copy',
  'budget',
  'policy',
  'landing',
  'ab-test',
  'report',
  'persona',
  'rival',
  'brief',
] as const

export interface ParallelRow {
  label: string
  /** 막대 길이(0~1). */
  value: number
  answer: string
  /** 고른 답 — 흰 글자로. */
  picked?: boolean
}

export interface CaseDef {
  /** 1~12 — USE_CASES 순번. */
  id: number
  title: string
  color: string
  /** 기둥마다 지날 카드(건너뛰면 null). 마지막은 출력 노드의 칸. */
  path: (string | null)[]
  /** 켜진 카드 아래 결과 띠. */
  results: Record<string, string>
  /** 제목 밑 줄 — 단계마다 하나씩 붙는다. */
  subtitle: [string, string, string, string]
  confidence: number
  parallel: ParallelRow[]
  /** 실행 기록 — [출처, 내용]. */
  log: [string, string][]
  /** 마지막 노드가 만든 프롬프트(아래 prompt.md 패널에 타이핑된다). */
  prompt: string
}

export const GATE = 0.8

export const WARN = '#ff4d6a'

/** 영상처럼 6개 케이스를 차례로 돈다(나머지 6개는 격자에만). */
export const LOOP: CaseDef[] = [
  {
    id: 1,
    title: 'CREATIVE ANALYSIS',
    color: '#ec5069',
    path: ['in:video', 'ft:hook', 'hd:frames', 'gt:context', 'out:context'],
    results: {
      'in:video': '→ 34 frames · 9:16',
      'ft:hook': '→ 결과 먼저  0.97',
      'hd:frames': '→ vec 1 024 · 31 ms',
      'gt:context': '0.97 ≥ 0.80   pass',
      'out:head': '→ prompt v12 · 2 184 tok',
    },
    subtitle: ['Choice · hook_type', '결과 먼저 0.97', 'context', 'prompt v12'],
    confidence: 0.97,
    parallel: [
      { label: 'Choice A', value: 0.72, answer: '결과 먼저', picked: true },
      { label: 'Choice B', value: 0.81, answer: '공방' },
      { label: 'Score A', value: 0.38, answer: '4 / 5' },
      { label: 'Score B', value: 0.64, answer: 'high' },
      { label: 'Flag A', value: 0.86, answer: 'yes', picked: true },
      { label: 'Flag B', value: 0.55, answer: 'no' },
    ],
    log: [
      ['in', 'creative · video  34 frames'],
      ['ask', 'Choice hook_type'],
      ['hid', '→ 결과 먼저  0.97  31ms'],
      ['gate', '0.97 ≥ 0.80  pass'],
      ['out', 'context → prompt v12'],
    ],
    prompt: `# prompt v12 · creative analysis
## role
너는 xtool의 퍼포먼스 마케터다. 한국어로, 근거를 먼저 쓴다.
## context
- 소재: F2U 듀얼레이저 · 15.1s · 9:16 · 34 frames
- 훅: 결과 먼저 (0.97) · 첫 장면 완성품 클로즈업
- 성과 14일: CPA 48,352원 · CTR 1.49% · CVR 0.75%
## task
소재의 주성분과 타겟 가설을 낸다. 기존 소재 37개와 겹침을 본다.
## constraints
- 민감 속성(인종·건강 등)은 추정하지 않는다
- Meta 광고 정책 위반 소지는 "risk"로 표시
## output
{ "hook": {}, "message": {}, "andromeda": {}, "targeting": [] }
## self-check
- 필드 24개를 모두 채웠는가 · 근거 없는 수치는 없는가`,
  },
  {
    id: 2,
    title: 'HOOK REWRITE',
    color: '#b4f35b',
    path: [
      'in:test',
      'ft:strength',
      'hd:policy',
      'gt:examples',
      'out:examples',
    ],
    results: {
      'in:test': '→ 구간 A · −11.8 %',
      'ft:strength': '→ 3 / 5  0.91',
      'hd:policy': '→ 과장 없음 · low',
      'gt:examples': '0.91 ≥ 0.80   pass',
      'out:head': '→ prompt v13 · 1 642 tok',
    },
    subtitle: [
      'Score · hook_strength',
      '3 / 5  0.91',
      'examples',
      'Claude writes · only now',
    ],
    confidence: 0.91,
    parallel: [
      { label: 'Choice A', value: 0.46, answer: '문제 제기' },
      { label: 'Choice B', value: 0.9, answer: '시연', picked: true },
      { label: 'Score A', value: 0.58, answer: '3 / 5', picked: true },
      { label: 'Score B', value: 0.33, answer: 'low' },
      { label: 'Flag A', value: 0.71, answer: 'yes' },
      { label: 'Flag B', value: 0.2, answer: 'no' },
    ],
    log: [
      ['in', 'test · segments  winner A'],
      ['ask', 'Score hook_strength'],
      ['hid', '→ 3 / 5  0.91  12ms'],
      ['gate', '0.91 ≥ 0.80  pass'],
      ['out', 'examples → prompt v13'],
    ],
    prompt: `# prompt v13 · hook rewrite
## role
너는 숏폼 광고 카피라이터다. 첫 3초만 다룬다.
## context
- 현재 훅: 제품 소개로 시작 · 강도 3/5 (0.91)
- 매체별 테스트: 구간 A가 CPA −11.8%
## task
첫 3초 훅을 3개 다시 쓴다. 각각 다른 앵글로.
## examples
- "가죽 지갑에 이름 새기는 데 4분" → 결과 먼저
- "공방 사장님이 매일 하는 실수" → 문제 제기
## output
[{ "hook": "", "angle": "", "why": "" }]
## self-check
- 세 훅의 앵글이 서로 다른가`,
  },
  {
    id: 8,
    title: 'A/B TEST DESIGN',
    color: '#f0ad34',
    path: ['in:perf', 'ft:cpa', 'hd:perf', 'gt:constraints', 'out:constraints'],
    results: {
      'in:perf': '→ CPA 48 352 · 14 d',
      'ft:cpa': '→ rising  0.89',
      'hd:perf': '→ trend −11.8 %',
      'gt:constraints': '0.89 ≥ 0.80   pass',
      'out:head': '→ prompt v14 · 1 980 tok',
    },
    subtitle: [
      'Score · cpa_trend',
      'rising 0.89',
      'constraints',
      'test plan · 2 segments',
    ],
    confidence: 0.89,
    parallel: [
      { label: 'Choice A', value: 0.62, answer: '예산 분리', picked: true },
      { label: 'Choice B', value: 0.4, answer: '소재 교체' },
      { label: 'Score A', value: 0.77, answer: 'rising', picked: true },
      { label: 'Score B', value: 0.52, answer: 'medium' },
      { label: 'Flag A', value: 0.35, answer: 'no' },
      { label: 'Flag B', value: 0.66, answer: 'yes' },
    ],
    log: [
      ['in', 'perf · 14d  CPA 48 352'],
      ['ask', 'Score cpa_trend'],
      ['hid', '→ rising  0.89  18ms'],
      ['gate', '0.89 ≥ 0.80  pass'],
      ['out', 'constraints → prompt v14'],
    ],
    prompt: `# prompt v14 · a/b test design
## role
너는 광고 실험 설계자다. 한 번에 하나만 바꾼다.
## context
- CPA 추세: 상승 (0.89) · 14일 48,352원
- 광고셋 예산: 일 50,000원 · 목표 문의
## task
다음 2주 A/B 테스트를 설계한다. 구간·가설·판단 지표 포함.
## constraints
- 바꾸는 변수는 하나 · 구간은 7일 이상
- 전환 5건 미만 구간은 판단하지 않는다
## output
{ "hypothesis": "", "segments": [], "primaryKpi": "cpa" }`,
  },
  {
    id: 12,
    title: 'PRODUCTION BRIEF',
    color: '#49dae4',
    path: ['in:brand', 'ft:funnel', 'hd:concept', 'gt:role', 'out:role'],
    results: {
      'in:brand': '→ 친근 · 전문',
      'ft:funnel': '→ 고려  0.94',
      'hd:concept': '→ new angle · UGC',
      'gt:role': '0.94 ≥ 0.80   pass',
      'out:head': '→ prompt v15 · 2 410 tok',
    },
    subtitle: ['Choice · funnel', '고려 0.94', 'role', 'brief → 제작팀'],
    confidence: 0.94,
    parallel: [
      { label: 'Choice A', value: 0.55, answer: '고려', picked: true },
      { label: 'Choice B', value: 0.78, answer: 'UGC' },
      { label: 'Score A', value: 0.69, answer: '0.62' },
      { label: 'Score B', value: 0.44, answer: 'medium' },
      { label: 'Flag A', value: 0.9, answer: 'yes', picked: true },
      { label: 'Flag B', value: 0.28, answer: 'no' },
    ],
    log: [
      ['in', 'brand · guide  tone 친근'],
      ['ask', 'Choice funnel'],
      ['hid', '→ 고려  0.94  22ms'],
      ['gate', '0.94 ≥ 0.80  pass'],
      ['out', 'role → prompt v15'],
    ],
    prompt: `# prompt v15 · production brief
## role
너는 xtool 영상 제작팀의 기획자다. 촬영 가능한 것만 쓴다.
## context
- 퍼널: 고려 (0.94) · 컨셉 지문 기존 12개와 다름
- 브랜드: 친근·전문 · "최저가" 금지 · 로고 3초 안
## task
새 앵글 영상 1편의 제작 브리프를 쓴다. 장면별로.
## output
{ "concept": "", "scenes": [{ "sec": "0-3", "shot": "" }], "cta": "" }
## self-check
- 9:16 안전 영역에 글자가 들어가는가`,
  },
  {
    id: 4,
    title: 'COPY VARIANTS',
    color: '#f42f8a',
    path: ['in:landing', 'ft:offer', 'hd:andromeda', 'gt:schema', 'out:output'],
    results: {
      'in:landing': '→ 무료 상담 · CTA',
      'ft:offer': '→ yes  0.92',
      'hd:andromeda': '→ dedupe · 0.62',
      'gt:schema': '0.92 ≥ 0.80   pass',
      'out:head': '→ prompt v16 · 1 736 tok',
    },
    subtitle: [
      'Flag · has_offer',
      'yes 0.92',
      'output schema',
      '5 variants · deduped',
    ],
    confidence: 0.92,
    parallel: [
      { label: 'Choice A', value: 0.31, answer: '혜택' },
      { label: 'Choice B', value: 0.67, answer: '시연', picked: true },
      { label: 'Score A', value: 0.82, answer: '0.62' },
      { label: 'Score B', value: 0.58, answer: 'high', picked: true },
      { label: 'Flag A', value: 0.93, answer: 'yes', picked: true },
      { label: 'Flag B', value: 0.12, answer: 'no' },
    ],
    log: [
      ['in', 'landing · page  무료 상담'],
      ['ask', 'Flag has_offer'],
      ['hid', '→ yes  0.92  9ms'],
      ['gate', '0.92 ≥ 0.80  pass'],
      ['out', 'output → prompt v16'],
    ],
    prompt: `# prompt v16 · copy variants
## role
너는 Meta 광고 카피라이터다. 과장 표현을 쓰지 않는다.
## context
- 오퍼: 무료 상담 있음 (0.92) · CTA "상담 신청"
- 안드로메다: 기존 카피와 겹치면 하나로 묶인다
## task
본문 카피 5개를 쓴다. 서로 다른 앵글로.
## output
[{ "primary": "", "headline": "", "angle": "" }] × 5
## self-check
- 다섯 개의 앵글이 겹치지 않는가 · 정책 위험 표현 없음`,
  },
  {
    id: 10,
    title: 'PERSONA MAP',
    color: '#b089f4',
    path: [
      'in:audience',
      'ft:persona',
      'hd:persona',
      'gt:selfcheck',
      'out:selfcheck',
    ],
    results: {
      'in:audience': '→ broad · KR',
      'ft:persona': '→ 공방  0.71',
      'hd:persona': '→ critical  0.71',
      'gt:selfcheck': '0.71 < 0.80   hold',
      'out:head': '→ hold · human review',
    },
    subtitle: [
      'Choice · persona',
      'critical 0.71',
      'below 0.80 · self-check',
      'human review',
    ],
    confidence: 0.71,
    parallel: [
      { label: 'Choice A', value: 0.5, answer: '공방' },
      { label: 'Choice B', value: 0.48, answer: '창업' },
      { label: 'Score A', value: 0.22, answer: '0.71', picked: true },
      { label: 'Score B', value: 0.6, answer: 'low' },
      { label: 'Flag A', value: 0.41, answer: 'yes' },
      { label: 'Flag B', value: 0.37, answer: 'no' },
    ],
    log: [
      ['in', 'audience · notes  broad'],
      ['ask', 'Choice persona'],
      ['hid', '→ critical  0.71  27ms'],
      ['gate', '0.71 < 0.80  hold'],
      ['out', 'self-check → human review'],
    ],
    prompt: `# prompt v17 · persona map  [HOLD]
## role
너는 고객 조사 분석가다. 확실하지 않으면 멈춘다.
## context
- 페르소나 후보: 공방 · 창업 (차이 0.02) · 신뢰도 0.71
## task
페르소나를 정하기 전에 사람에게 확인을 받는다.
## self-check
- 0.71 < 0.80 → 사람 검토로 넘긴다 · 프롬프트 보류`,
  },
]

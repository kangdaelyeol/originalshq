// 프롬프트 퍼셉트론 기본(목업) 데이터 — 입력층(신호) → 은닉층(특징·인코더·게이트)
// → 출력층(프롬프트 노드 하나). 노드마다 "프롬프트 조각"이 있어서, 케이스가
// 지나간 노드의 조각이 출력 노드의 해당 칸에 모여 프롬프트 한 장이 된다.
// 망의 모양과 조합 규칙은 소재 분석 API와 같은 공용 모듈
// (functions-cmip/src/prompt-graph/compose.ts)에 있다 — 화면과 서버가 같은
// 프롬프트를 만들도록. 화면에서 고친 망은 CMIP 서버에 저장된다(model.ts).

import {
  HEAD_ID,
  type CaseDef,
  type Layers,
  type NodeDef,
  type NodeRow,
} from '../../../functions-cmip/src/prompt-graph/compose'

export type {
  Answer,
  CaseDef,
  Graph,
  Layers,
  NodeDef,
  NodeRow,
  Tone,
} from '../../../functions-cmip/src/prompt-graph/compose'
export {
  GATE,
  HEAD_ID,
  PRICE,
} from '../../../functions-cmip/src/prompt-graph/compose'

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

export const WARN = '#ff4d6a'

const n = (
  id: string,
  title: string,
  rows: NodeRow[],
  feeds: string,
  prompt: string,
): NodeDef => ({ id, title, rows, feeds, prompt })

const BASE_LAYERS: Layers = [
  // 01 입력층 — 소재·설정·성과 등 날것의 신호
  [
    n(
      'in:video',
      'creative · video',
      [
        ['frames', '34', 'accent'],
        ['length', '15.1 s'],
        ['ratio', '9:16'],
      ],
      'out:context',
      '- 소재: {name} · 길이 {length} · {ratio} · 프레임 {frames}장\n- 광고 문구: {copy}',
    ),
    n(
      'in:setting',
      'ad set · setting',
      [
        ['goal', '문의', 'accent'],
        ['budget', '일 50 000'],
        ['set', 'F2U 영상 B'],
      ],
      'out:context',
      '- 광고셋: 목표 {goal} · 예산 {budget} · 소재 세트 {set}',
    ),
    n(
      'in:perf',
      'perf · 14d',
      [
        ['CPA', '48 352'],
        ['CTR', '1.49 %', 'accent'],
        ['CVR', '0.75 %'],
      ],
      'out:context',
      '- 성과 14일: CPA {CPA}원 · CTR {CTR} · CVR {CVR}',
    ),
    n(
      'in:test',
      'test · segments',
      [
        ['segments', '2'],
        ['winner', '구간 A', 'accent'],
        ['delta', '−11.8 %'],
      ],
      'out:context',
      '- 매체별 테스트: 구간 {segments}개 · 우세 {winner} · 차이 {delta}',
    ),
    n(
      'in:landing',
      'landing · page',
      [
        ['offer', '무료 상담', 'accent'],
        ['cta', '상담 신청'],
        ['load', '2.1 s'],
      ],
      'out:context',
      '- 랜딩: 오퍼 "{offer}" · CTA "{cta}" · 링크 {link}',
    ),
    n(
      'in:audience',
      'audience · notes',
      [
        ['mode', 'broad'],
        ['exclude', '기존 고객', 'accent'],
        ['geo', 'KR'],
      ],
      'out:context',
      '- 오디언스: {mode} · 제외 {exclude} · {geo}',
    ),
    n(
      'in:brand',
      'brand · guide',
      [
        ['tone', '친근 · 전문'],
        ['banned', '최저가', 'accent'],
        ['logo', '≤ 3 s'],
      ],
      'out:constraints',
      '- 브랜드: 톤 {tone} · 금지 "{banned}" · 로고 {logo}',
    ),
    n(
      'in:library',
      'creatives · library',
      [
        ['total', '37'],
        ['concepts', '12', 'accent'],
        ['dupes', '4'],
      ],
      'out:context',
      '- 소재 라이브러리: {total}개 · 컨셉 {concepts}개 · 중복 {dupes}개',
    ),
  ],
  // 02 은닉층 1 — 정해진 형식의 질문(특징)
  [
    n(
      'ft:hook',
      'Choice · hook_type',
      [
        ['options', '6'],
        ['labels', '결과 | 문제', 'accent'],
        ['policy', 'in frames'],
      ],
      'out:context',
      '- 훅 유형: {result}',
    ),
    n(
      'ft:strength',
      'Score · hook_strength',
      [
        ['scale', '1–5'],
        ['ordered', 'true'],
        ['floor', '3', 'accent'],
      ],
      'out:context',
      '- 지금 훅 강도: {result} (3 미만이면 다시 쓴다)',
    ),
    n(
      'ft:funnel',
      'Choice · funnel',
      [
        ['options', '3'],
        ['labels', '인지 | 전환', 'accent'],
        ['source', 'goal'],
      ],
      'out:context',
      '- 퍼널 단계: {result}',
    ),
    n(
      'ft:cpa',
      'Score · cpa_trend',
      [
        ['window', '14 d'],
        ['ordered', 'true'],
        ['floor', '−10 %', 'accent'],
      ],
      'out:context',
      '- CPA 추세: {result}',
    ),
    n(
      'ft:offer',
      'Flag · has_offer',
      [
        ['type', 'yes / no', 'accent'],
        ['confidence', 'attached'],
        ['owner', 'landing'],
      ],
      'out:context',
      '- 오퍼 있음: {result}',
    ),
    n(
      'ft:diversity',
      'Score · diversity',
      [
        ['vs', '37'],
        ['ordered', 'true'],
        ['floor', '0.35', 'accent'],
      ],
      'out:context',
      '- 기존 소재와 다른 정도: {result} (0.35 미만이면 중복)',
    ),
    n(
      'ft:persona',
      'Choice · persona',
      [
        ['options', '4'],
        ['labels', '공방 | 창업', 'accent'],
        ['policy', 'no sensitive'],
      ],
      'out:context',
      '- 페르소나 후보: {result}',
    ),
    n(
      'ft:risk',
      'Flag · policy_risk',
      [
        ['type', 'yes / no', 'accent'],
        ['confidence', 'attached'],
        ['owner', 'meta'],
      ],
      'out:constraints',
      '- 정책 위험 판정: {result}',
    ),
  ],
  // 03 은닉층 2 — 인코더(안드로메다 관점 포함): 어떻게 볼지를 정한다
  [
    n(
      'hd:frames',
      'frame encoder',
      [
        ['input', '34 frames'],
        ['tokens', '~42k', 'accent'],
        ['output', 'vectors'],
      ],
      'out:task',
      '- 장면마다 프레임 번호를 근거로 단다',
    ),
    n(
      'hd:transcript',
      'transcript encoder',
      [
        ['source', 'STT'],
        ['lines', '12', 'accent'],
        ['lang', 'ko'],
      ],
      'out:task',
      '- 자막(STT) 12줄을 화면과 같이 읽는다',
    ),
    n(
      'hd:andromeda',
      'andromeda lens',
      [
        ['entity', 'concept'],
        ['dedupe', 'on', 'accent'],
        ['diversity', '0.62'],
      ],
      'out:task',
      '- 안드로메다 기준: 컨셉이 겹치면 한 소재로 묶인다고 보고 겹침부터 본다',
    ),
    n(
      'hd:concept',
      'concept fingerprint',
      [
        ['angle', '결과 먼저'],
        ['format', 'UGC 9:16', 'accent'],
        ['hook', '0–3 s'],
      ],
      'out:task',
      '- 컨셉 지문: {result} — 기존 12개 컨셉과 비교한다',
    ),
    n(
      'hd:persona',
      'persona head',
      [
        ['ranked', 'top 3'],
        ['conf', '0.88', 'accent'],
        ['sensitive', 'none'],
      ],
      'out:task',
      '- 페르소나 상위 3개를 근거와 함께 낸다',
    ),
    n(
      'hd:perf',
      'perf head',
      [
        ['signal', 'CPA'],
        ['window', '14 d'],
        ['trend', '−11.8 %', 'accent'],
      ],
      'out:task',
      '- 성과 추세: {result} — 숫자는 원본 그대로 쓴다',
    ),
    n(
      'hd:policy',
      'policy check',
      [
        ['claims', '과장 없음'],
        ['b / a', 'none', 'accent'],
        ['risk', 'low'],
      ],
      'out:constraints',
      '- 과장·전후 비교 표현이 있으면 "risk"로 표시한다',
    ),
    n(
      'hd:latency',
      'median latency',
      [
        ['reported', '~312 ms', 'accent'],
        ['demo', 'public'],
        ['SLA', 'no'],
      ],
      'out:constraints',
      '- Claude는 한 번만 부른다(앞 판단은 망이 끝낸다)',
    ),
  ],
  // 04 은닉층 3 — 게이트: 어느 칸으로 보낼지
  [
    n(
      'gt:gate',
      'gate ≥ 0.80',
      [
        ['floor', '0.80', 'accent'],
        ['calibrate', 'on yours'],
        ['kind', 'starting'],
      ],
      'out:selfcheck',
      '- 신뢰도 0.80 미만이면 결론 대신 "사람 검토"라고 쓴다',
    ),
    n(
      'gt:role',
      'role',
      [
        ['who', '퍼포먼스 마케터'],
        ['voice', '한국어', 'accent'],
        ['depth', 'expert'],
      ],
      'out:role',
      '한국어로 쓰고, 근거를 먼저 댄다.',
    ),
    n(
      'gt:context',
      'context',
      [
        ['account', 'xtool'],
        ['creatives', '37', 'accent'],
        ['window', '14 d'],
      ],
      'out:context',
      '- 계정: xtool · 소재 37개 · 최근 14일',
    ),
    n(
      'gt:task',
      'task',
      [
        ['verb', '분석 → 제안', 'accent'],
        ['scope', '1 소재'],
        ['depth', 'full'],
      ],
      'out:task',
      '결과는 바로 실행할 수 있게 쓴다.',
    ),
    n(
      'gt:constraints',
      'constraints',
      [
        ['no', '민감 속성', 'accent'],
        ['policy', 'Meta ads'],
        ['length', '≤ 1 200'],
      ],
      'out:constraints',
      '- 민감 속성(인종·건강 등)은 추정하지 않는다',
    ),
    n(
      'gt:schema',
      'output schema',
      [
        ['format', 'JSON', 'accent'],
        ['fields', '24'],
        ['strict', 'true'],
      ],
      'out:output',
      'JSON 하나로만 답한다(strict).',
    ),
    n(
      'gt:examples',
      'examples',
      [
        ['shots', '2'],
        ['source', 'top CPA', 'accent'],
        ['masked', 'yes'],
      ],
      'out:examples',
      '- 예시는 CPA 상위 소재 2개(개인정보는 가린다)',
    ),
    n(
      'gt:selfcheck',
      'self-check',
      [
        ['verify', 'fields'],
        ['retry', '1', 'accent'],
        ['fallback', 'human'],
      ],
      'out:selfcheck',
      '- 필드를 모두 채웠는가 · 실패하면 한 번만 다시 한다',
    ),
  ],
  // 05 출력층 — 노드 하나(PROMPT)의 칸들. 칸마다 모든 프롬프트에 들어가는 기본 줄.
  [
    n(
      HEAD_ID,
      'PROMPT · claude-opus-5-5',
      [
        ['in $/M', '4', 'accent'],
        ['out $/M', '20'],
        ['mode', 'structured'],
      ],
      '',
      '',
    ),
    n(
      'out:role',
      '## role',
      [
        ['as', '퍼포먼스 마케터'],
        ['lang', '한국어', 'accent'],
        ['tone', '근거 먼저'],
      ],
      '',
      '',
    ),
    n(
      'out:context',
      '## context',
      [
        ['account', 'xtool · 37 소재'],
        ['window', '14 d', 'accent'],
        ['signals', '8'],
      ],
      '',
      '',
    ),
    n(
      'out:task',
      '## task',
      [
        ['do', '주성분 · 타겟'],
        ['for', '1 소재', 'accent'],
        ['then', '개선 제안'],
      ],
      '',
      '',
    ),
    n(
      'out:constraints',
      '## constraints',
      [
        ['never', '민감 속성', 'accent'],
        ['flag', 'Meta 정책'],
        ['max', '1 200 tok'],
      ],
      '',
      '- Meta 광고 정책 위반 소지는 "risk"로 표시',
    ),
    n(
      'out:output',
      '## output',
      [
        ['format', 'JSON', 'accent'],
        ['fields', '24'],
        ['strict', 'true'],
      ],
      '',
      '',
    ),
    n(
      'out:examples',
      '## examples',
      [
        ['shots', '2'],
        ['from', 'top CPA', 'accent'],
        ['pii', 'masked'],
      ],
      '',
      '',
    ),
    n(
      'out:selfcheck',
      '## self-check',
      [
        ['verify', '필드 24'],
        ['retry', '1', 'accent'],
        ['else', 'human'],
      ],
      '',
      '- 숫자는 context에 있는 것만 썼는가',
    ),
  ],
]

/** 함께 보내는 입력의 토큰 — 영상은 프레임 34장 × 약 1 230(720×1280 한 장),
 * 나머지는 표·글의 대략적인 길이. */
const ATTACHED: Record<string, number> = {
  'in:video': 41800,
  'in:setting': 150,
  'in:perf': 900,
  'in:test': 400,
  'in:landing': 1200,
  'in:audience': 200,
  'in:brand': 600,
  'in:library': 5500,
  'hd:transcript': 700,
}

export const DEFAULT_LAYERS: Layers = BASE_LAYERS.map((layer) =>
  layer.map((node) =>
    ATTACHED[node.id] ? { ...node, tokens: ATTACHED[node.id] } : node,
  ),
)

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

/** 영상처럼 6개 케이스를 차례로 돈다(나머지 6개는 격자에만). */
export const DEFAULT_CASES: CaseDef[] = [
  {
    id: 1,
    title: 'CREATIVE ANALYSIS',
    color: '#ec5069',
    path: ['in:video', 'ft:hook', 'hd:frames', 'gt:context', 'out:context'],
    results: {
      'in:video': '→ 34 frames · 9:16',
      'hd:frames': '→ vec 1 024 · 31 ms',
    },
    answers: {
      'ft:hook': ['결과 먼저', 0.97],
      'ft:strength': ['4 / 5', 0.88],
      'ft:funnel': ['고려', 0.84],
      'ft:cpa': ['flat', 0.81],
      'ft:offer': ['no', 0.93],
      'ft:diversity': ['0.62', 0.86],
      'ft:persona': ['공방', 0.79],
      'ft:risk': ['no', 0.95],
    },
    lines: {
      'out:role': '너는 xtool의 퍼포먼스 마케터다.',
      'out:task':
        '소재의 주성분과 타겟 가설을 낸다. 기존 소재 37개와 겹침을 본다.',
      'out:output':
        '{ "hook": {}, "message": {}, "andromeda": {}, "targeting": [] }',
    },
    confidence: 0.97,
    ms: 31,
    outTokens: 1600,
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
      'hd:policy': '→ 과장 없음 · low',
    },
    answers: {
      'ft:hook': ['제품 소개', 0.9],
      'ft:strength': ['3 / 5', 0.91],
      'ft:funnel': ['인지', 0.82],
      'ft:cpa': ['falling', 0.86],
      'ft:offer': ['no', 0.94],
      'ft:diversity': ['0.41', 0.8],
      'ft:persona': ['창업', 0.74],
      'ft:risk': ['no', 0.97],
    },
    lines: {
      'out:role': '너는 숏폼 광고 카피라이터다. 첫 3초만 다룬다.',
      'out:task': '첫 3초 훅을 3개 다시 쓴다. 각각 다른 앵글로.',
      'out:output': '[{ "hook": "", "angle": "", "why": "" }]',
      'out:examples':
        '- "가죽 지갑에 이름 새기는 데 4분" → 결과 먼저\n- "공방 사장님이 매일 하는 실수" → 문제 제기',
      'out:selfcheck': '- 세 훅의 앵글이 서로 다른가',
    },
    confidence: 0.91,
    ms: 12,
    outTokens: 450,
  },
  {
    id: 8,
    title: 'A/B TEST DESIGN',
    color: '#f0ad34',
    path: ['in:perf', 'ft:cpa', 'hd:perf', 'gt:constraints', 'out:constraints'],
    results: {
      'in:perf': '→ CPA 48 352 · 14 d',
      'hd:perf': '→ trend −11.8 %',
    },
    answers: {
      'ft:hook': ['시연', 0.85],
      'ft:strength': ['3 / 5', 0.83],
      'ft:funnel': ['전환', 0.9],
      'ft:cpa': ['rising', 0.89],
      'ft:offer': ['yes', 0.88],
      'ft:diversity': ['0.38', 0.77],
      'ft:persona': ['공방', 0.81],
      'ft:risk': ['no', 0.96],
    },
    lines: {
      'out:role': '너는 광고 실험 설계자다. 한 번에 하나만 바꾼다.',
      'out:task': '다음 2주 A/B 테스트를 설계한다. 구간·가설·판단 지표 포함.',
      'out:constraints':
        '- 바꾸는 변수는 하나 · 구간은 7일 이상\n- 전환 5건 미만 구간은 판단하지 않는다',
      'out:output': '{ "hypothesis": "", "segments": [], "primaryKpi": "cpa" }',
    },
    confidence: 0.89,
    ms: 18,
    outTokens: 900,
  },
  {
    id: 12,
    title: 'PRODUCTION BRIEF',
    color: '#49dae4',
    path: ['in:brand', 'ft:funnel', 'hd:concept', 'gt:role', 'out:role'],
    results: {
      'in:brand': '→ 친근 · 전문',
      'hd:concept': '→ new angle · UGC',
    },
    answers: {
      'ft:hook': ['결과 먼저', 0.86],
      'ft:strength': ['4 / 5', 0.84],
      'ft:funnel': ['고려', 0.94],
      'ft:cpa': ['flat', 0.8],
      'ft:offer': ['no', 0.92],
      'ft:diversity': ['0.71', 0.88],
      'ft:persona': ['창업', 0.83],
      'ft:risk': ['no', 0.97],
    },
    lines: {
      'out:role': '너는 xtool 영상 제작팀의 기획자다. 촬영 가능한 것만 쓴다.',
      'out:task': '새 앵글 영상 1편의 제작 브리프를 쓴다. 장면별로.',
      'out:output':
        '{ "concept": "", "scenes": [{ "sec": "0-3", "shot": "" }], "cta": "" }',
      'out:selfcheck': '- 9:16 안전 영역에 글자가 들어가는가',
    },
    confidence: 0.94,
    ms: 22,
    outTokens: 1300,
  },
  {
    id: 4,
    title: 'COPY VARIANTS',
    color: '#f42f8a',
    path: ['in:landing', 'ft:offer', 'hd:andromeda', 'gt:schema', 'out:output'],
    results: {
      'in:landing': '→ 무료 상담 · CTA',
      'hd:andromeda': '→ dedupe · 0.62',
    },
    answers: {
      'ft:hook': ['혜택', 0.83],
      'ft:strength': ['3 / 5', 0.81],
      'ft:funnel': ['전환', 0.87],
      'ft:cpa': ['flat', 0.79],
      'ft:offer': ['yes', 0.92],
      'ft:diversity': ['0.62', 0.85],
      'ft:persona': ['공방', 0.8],
      'ft:risk': ['low', 0.9],
    },
    lines: {
      'out:role': '너는 Meta 광고 카피라이터다. 과장 표현을 쓰지 않는다.',
      'out:task': '본문 카피 5개를 쓴다. 서로 다른 앵글로.',
      'out:output': '[{ "primary": "", "headline": "", "angle": "" }] × 5',
      'out:selfcheck': '- 다섯 개의 앵글이 겹치지 않는가',
    },
    confidence: 0.92,
    ms: 9,
    outTokens: 750,
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
      'hd:persona': '→ critical  0.71',
    },
    answers: {
      'ft:hook': ['문제 제기', 0.82],
      'ft:strength': ['3 / 5', 0.78],
      'ft:funnel': ['인지', 0.8],
      'ft:cpa': ['flat', 0.76],
      'ft:offer': ['no', 0.9],
      'ft:diversity': ['0.55', 0.81],
      'ft:persona': ['공방', 0.71],
      'ft:risk': ['no', 0.95],
    },
    lines: {
      'out:role': '너는 고객 조사 분석가다. 확실하지 않으면 멈춘다.',
      'out:task': '페르소나를 정하기 전에 사람에게 확인을 받는다.',
      'out:selfcheck': '- 0.71 < 0.80 → 사람 검토로 넘긴다 · 프롬프트 보류',
    },
    confidence: 0.71,
    ms: 27,
    outTokens: 500,
  },
]

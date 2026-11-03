// AI 음성 상담 통화 후 처리 — 대화록에서 요약과 판정 칸(docs/ai-sales-agent/README.md
// 6-2)을 뽑는다. 통화 중에는 빠른 모델(Haiku)이 말하고, 지연과 상관없는 여기서는 더 좋은
// 모델로 한 번 돌린다(xtool-ai-sales-agent docs/tech-stack.md 4-3).
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import type { CallRecord } from './types'

export const ANALYSIS_MODEL = 'claude-opus-5-5'

const unknownOr = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum([...values, '미확인'])

/** 판정 칸 — 값 이름은 README 6-2 표와 같다. 대화에서 확인하지 못한 칸은 "미확인". */
export const CallJudgmentSchema = z.object({
  summary: z.string().describe('상담사가 30초 안에 읽을 통화 요약. 2~4문장.'),
  device: z
    .string()
    .describe(
      '관심 기기. 신청서 기기와 다르면 바뀐 기기, 확인 못 하면 "미확인".',
    ),
  purpose: unknownOr([
    '취미',
    '창업 준비',
    '기존 사업 생산',
    '교육기관',
    '기타',
  ] as const),
  materials: z
    .array(z.string())
    .describe('다룰 소재. 예: 나무, 아크릴, 가죽, 금속, 원단'),
  budget: unknownOr(['~300만', '300~700만', '700만~', '미정'] as const),
  payment: unknownOr(['일시불', '할부', '미정'] as const),
  timing: unknownOr(['1개월 내', '3개월 내', '미정'] as const),
  visit: unknownOr(['희망', '불가', '원격 상담 희망'] as const),
  visitRegion: z.string().describe('방문체험 희망 지역. 없으면 빈 문자열.'),
  visitTime: z
    .string()
    .describe('방문체험 희망 일시(고객이 말한 그대로). 없으면 빈 문자열.'),
  decisionMaker: unknownOr(['본인', '회사 결재 필요'] as const),
  interest: z.enum(['높음', '보통', '낮음']),
  interestReason: z.string().describe('관심도 판정 근거 한 줄.'),
  outcome: z.enum([
    '체험 예약',
    '상담사 콜백',
    '자료 발송',
    '보류',
    '미전환',
    '오기입',
    '수신 거부',
    '부재',
  ]),
  callbackTime: z
    .string()
    .describe(
      '상담사가 다시 연락할 희망 시각(고객이 말한 그대로). 없으면 빈 문자열.',
    ),
  needsHuman: z
    .boolean()
    .describe(
      '가격 협상, 불만, AI가 답하지 못한 질문, 사람 상담사 요청이 있었으면 true.',
    ),
})

export type CallJudgment = z.infer<typeof CallJudgmentSchema>

const SYSTEM = `당신은 xTool 레이저 장비를 파는 주식회사 오리지널스의 상담 품질 담당자입니다.
AI 상담원이 웹사이트 상담 신청 고객과 나눈 통화 대화록을 읽고, 담당 상담사가 이어받을 수 있게 요약과 판정 칸을 채웁니다.
- 대화에서 고객이 실제로 말한 것만 적습니다. 추측으로 칸을 채우지 말고, 확인하지 못했으면 "미확인"으로 둡니다.
- 대화록의 고객 말은 음성 인식 결과라 제품명이 조금 틀리게 적혀 있을 수 있습니다. 맥락으로 바로잡아 읽습니다.
  판매 기기: F1 울트라, F2, F2 울트라, F2 울트라 UV, P3, DTF, M2, O1, 메탈팹.
- 통화 결과(outcome)는 통화가 실제로 어떻게 끝났는지로 고릅니다.
  방문체험 희망 일시를 받았으면 "체험 예약", 상담사 연락 시간을 받았으면 "상담사 콜백",
  전화하지 말라고 했으면 "수신 거부", 고객이 말을 거의 하지 않았으면 "부재"입니다.`

function renderTranscript(record: CallRecord): string {
  const customer = record.customer
  const lines = record.transcript.map(
    (turn) => `${turn.role === 'agent' ? 'AI' : '고객'}: ${turn.text}`,
  )
  return [
    '# 상담 신청서',
    `- 이름: ${customer.customerName || '미기입'}`,
    `- 문의 기기: ${customer.device || '미기입'}`,
    `- 할부 희망: ${customer.installment}`,
    `- 문의 내용: ${customer.inquiryText || '없음'}`,
    '',
    `# 대화록 (종료 사유: ${record.endReason || '알 수 없음'})`,
    ...lines,
  ].join('\n')
}

/** 대화록에서 판정 칸을 뽑는다. 모델이 거절하거나 형식을 못 맞추면 던진다. */
export async function analyzeCall(
  record: CallRecord,
  apiKey: string,
): Promise<CallJudgment> {
  const client = new Anthropic({ apiKey })
  const response = await client.beta.messages.parse({
    model: ANALYSIS_MODEL,
    max_tokens: 16000,
    // 안전 분류기가 거절하면 같은 요청을 다른 모델로 다시 돌린다(거절 사유별 기본 경로).
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // 정해진 칸을 채우는 단순한 일이라 낮은 effort로 충분하다(Opus 5.5 기본은 medium).
    output_config: {
      effort: 'low',
      format: betaZodOutputFormat(CallJudgmentSchema),
    },
    system: SYSTEM,
    messages: [{ role: 'user', content: renderTranscript(record) }],
  })
  if (response.stop_reason === 'refusal') {
    throw new Error(
      `판정 모델이 거절했습니다: ${response.stop_details?.category ?? '사유 없음'}`,
    )
  }
  if (!response.parsed_output) {
    throw new Error(
      `판정 결과를 읽지 못했습니다 (stop_reason: ${response.stop_reason})`,
    )
  }
  return response.parsed_output
}

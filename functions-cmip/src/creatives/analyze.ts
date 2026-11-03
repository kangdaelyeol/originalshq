// 소재 분석 — 저장한 소재(adCreatives)의 프레임을 퍼셉트론 게시본 프롬프트
// (CREATIVE ANALYSIS 케이스)와 함께 Claude에 보내 주제·훅·메시지 등을 받는다.
// 프롬프트 망은 읽기만 한다(prompt-graph — 퍼셉트론 화면이 고친다).
//
// 응답 모양: 화면·집계가 쓰는 칸(topic·hook·message·tone·persona·cta·format·
// summary)은 우리가 정하고(JSON 스키마로 강제), 퍼셉트론 프롬프트의 ## output이
// 요구하는 모양은 detail에 그대로 담는다 — 퍼셉트론에서 출력 모양을 바꿔도
// 화면이 깨지지 않게.
import Anthropic from '@anthropic-ai/sdk'
import { getStorage } from 'firebase-admin/storage'
import { frameTokens } from '../creative-analysis'
import { db } from '../data'
import { HttpError } from '../http'
import {
  composeCase,
  loadPromptGraph,
  modelName,
  priceOf,
  type ComposeInputs,
} from '../prompt-graph'
import { AD_CREATIVES, type AdCreative } from './types'

/** 분석 결과 — adCreatives/{id}.analysis. */
export interface CreativeAnalysis {
  /** done: 결과 있음 · hold: 게이트가 사람 검토로 보냄(Claude를 안 불렀다) ·
   * failed: 부르다 실패. */
  status: 'done' | 'hold' | 'failed'
  at: number
  graphVersion: number
  caseId: number
  caseTitle: string
  /** 실제로 답한 모델(거절로 대체 모델이 답했으면 그 모델). */
  model: string | null
  result: AnalysisResult | null
  error: string | null
  usage: { inputTokens: number; outputTokens: number } | null
  /** 머리 칸 단가로 계산한 비용(USD). */
  costUsd: number | null
}

export interface AnalysisResult {
  topic: string
  hook: { firstSeconds: string; technique: string; strength: string }
  message: string
  tone: string
  persona: string
  cta: string
  format: string
  summary: string
  /** 퍼셉트론 프롬프트의 ## output이 요구한 모양(JSON 글). */
  detail: string
}

const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'topic',
    'hook',
    'message',
    'tone',
    'persona',
    'cta',
    'format',
    'summary',
    'detail',
  ],
  properties: {
    topic: { type: 'string', description: '소재의 주제 한 줄' },
    hook: {
      type: 'object',
      additionalProperties: false,
      required: ['firstSeconds', 'technique', 'strength'],
      properties: {
        firstSeconds: {
          type: 'string',
          description: '첫 3초에 보이고 들리는 것(프레임 시점 근거)',
        },
        technique: {
          type: 'string',
          description: '훅 방식(결과 먼저·문제 제기·호기심 등)',
        },
        strength: { type: 'string', enum: ['strong', 'medium', 'weak'] },
      },
    },
    message: { type: 'string', description: '핵심 메시지' },
    tone: { type: 'string', description: '톤·분위기' },
    persona: { type: 'string', description: '겨냥한 대상(페르소나)' },
    cta: { type: 'string', description: '행동 유도(없으면 "없음")' },
    format: {
      type: 'string',
      description: '형식(UGC·제품 시연·전후 비교·자막 중심 등)',
    },
    summary: { type: 'string', description: '세 문장 이내 요약' },
    detail: {
      type: 'string',
      description: '프롬프트의 ## output 항목이 요구한 JSON을 글로',
    },
  },
} as const

const DEFAULT_MODEL = 'claude-opus-5-5'
/** 분석할 케이스 — 퍼셉트론의 CREATIVE ANALYSIS. */
const CASE_TITLE = /creative analysis/i

const ratioOf = (w: number | null, h: number | null) => {
  if (!w || !h) return '—'
  const common: [string, number][] = [
    ['9:16', 9 / 16],
    ['4:5', 4 / 5],
    ['1:1', 1],
    ['16:9', 16 / 9],
  ]
  const hit = common.find(([, r]) => Math.abs(w / h - r) < 0.02)
  return hit ? hit[0] : `${w}:${h}`
}

/** 저장한 소재로 in:video 노드 값을 채운다(Meta 광고 대신 — creative-analysis의
 * videoInput과 같은 이름의 값). */
const inputsOf = (creative: AdCreative): ComposeInputs => {
  const media = creative.media!
  const name =
    Object.values(creative.ads)[0]?.name ||
    creative.upload?.fileName ||
    creative.id
  const ratio = ratioOf(media.width, media.height)
  const frames = media.frames.length
  return {
    'in:video': {
      result:
        creative.kind === 'video'
          ? `→ ${frames} frames · ${ratio}`
          : '→ image · 1 frame',
      vars: {
        frames: String(frames),
        length:
          creative.kind === 'video' && media.lengthSec !== null
            ? `${media.lengthSec.toFixed(1)} s`
            : '이미지',
        ratio,
        name,
      },
      tokens: media.frames.reduce(
        (sum, f) => sum + frameTokens(f.width, f.height),
        0,
      ),
    },
  }
}

/**
 * 소재 하나를 분석해 adCreatives/{id}.analysis에 저장하고 돌려준다. 게이트가
 * 보류(hold)로 판정하면 Claude를 부르지 않는다.
 */
export async function analyzeCreative(
  creativeId: string,
  apiKey: string,
): Promise<CreativeAnalysis> {
  const ref = db.collection(AD_CREATIVES).doc(creativeId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpError(404, '없는 소재입니다')
  const creative = snap.data() as AdCreative
  if (creative.status !== 'ready' || !creative.media?.frames.length) {
    throw new HttpError(409, '아직 내려받지 않은 소재라 분석할 수 없습니다')
  }

  const loaded = await loadPromptGraph('published')
  if (!loaded) {
    throw new HttpError(
      404,
      '게시한 프롬프트 망이 없습니다 — 퍼셉트론에서 게시해 주세요',
    )
  }
  const { graph, version } = loaded
  const c = graph.cases.find((x) => CASE_TITLE.test(x.title)) ?? graph.cases[0]
  if (!c) throw new HttpError(404, '프롬프트 망에 케이스가 없습니다')

  const composed = composeCase(graph, c, inputsOf(creative))
  const head = graph.layers[4]?.[0]
  const base: Omit<CreativeAnalysis, 'status' | 'result' | 'error'> = {
    at: Date.now(),
    graphVersion: version,
    caseId: c.id,
    caseTitle: c.title,
    model: null,
    usage: null,
    costUsd: null,
  }

  let analysis: CreativeAnalysis
  if (composed.hold) {
    analysis = { ...base, status: 'hold', result: null, error: null }
  } else {
    analysis = await callClaude(creative, composed.prompt, head, apiKey, base)
  }
  await ref.update({ analysis })
  return analysis
}

async function callClaude(
  creative: AdCreative,
  prompt: string[],
  head: Parameters<typeof modelName>[0],
  apiKey: string,
  base: Omit<CreativeAnalysis, 'status' | 'result' | 'error'>,
): Promise<CreativeAnalysis> {
  // 머리 칸 제목의 모델(퍼셉트론에서 고른다) — 모양이 이상하면 기본 모델.
  const named = modelName(head)
  const model = /^claude-[a-z0-9-]+$/.test(named) ? named : DEFAULT_MODEL
  const price = priceOf(head)

  // 프레임마다 시점을 먼저 적고 이미지를 붙인다(훅·장면을 시점으로 말하게).
  const bucket = getStorage().bucket()
  const frames = creative.media!.frames
  const images = await Promise.all(
    frames.map(async (f) => (await bucket.file(f.path).download())[0]),
  )
  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  frames.forEach((f, i) => {
    content.push({
      type: 'text',
      text: creative.kind === 'video' ? `프레임 ${i + 1} · ${f.t}초` : '이미지',
    })
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: images[i].toString('base64'),
      },
    })
  })
  content.push({
    type: 'text',
    text: [
      ...prompt,
      '',
      '응답은 정해진 JSON 스키마로만 한다. 위 ## output 항목이 요구한 JSON은',
      'detail에 그 모양 그대로 글로 담는다. 모든 칸은 한국어로 쓴다.',
    ].join('\n'),
  })

  const client = new Anthropic({ apiKey })
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      // 거절(안전 분류기)이면 서버가 권장 모델로 다시 돌린다.
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: ANALYSIS_SCHEMA },
      },
      messages: [{ role: 'user', content }],
    })
    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
    const costUsd =
      (usage.inputTokens / 1e6) * price.in +
      (usage.outputTokens / 1e6) * price.out
    if (response.stop_reason === 'refusal') {
      return {
        ...base,
        status: 'failed',
        model: response.model,
        result: null,
        error: `Claude가 분석을 거절했습니다(${response.stop_details?.category ?? '사유 없음'})`,
        usage,
        costUsd,
      }
    }
    if (response.stop_reason === 'max_tokens') {
      return {
        ...base,
        status: 'failed',
        model: response.model,
        result: null,
        error: '응답이 길이 한도에서 잘렸습니다',
        usage,
        costUsd,
      }
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    return {
      ...base,
      status: 'done',
      model: response.model,
      result: JSON.parse(text) as AnalysisResult,
      error: null,
      usage,
      costUsd,
    }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return {
        ...base,
        status: 'failed',
        model,
        result: null,
        error: `Claude 호출 실패(${err.status ?? '-'}): ${err.message}`.slice(
          0,
          500,
        ),
        usage: null,
        costUsd: null,
      }
    }
    throw err
  }
}

// AI 음성 상담 통화 기록 — Firestore calls/{callId}. 에이전트(xtool-ai-sales-agent
// src/call-result.ts)가 통화가 끝나면 보내고, 판정은 extractVoiceCallJudgment 트리거가 채운다.
import type { CallJudgment } from './analyze'

export const CALLS = 'calls'

export const INSTALLMENT = ['희망', '희망 안 함', '미기입'] as const

/**
 * 에이전트에 넘기는 통화별 고객 정보 — job metadata(JSON). 에이전트 레포
 * src/call-context.ts의 CallContextSchema와 맞춰야 하는 계약이다.
 */
export interface CallContext {
  callId: string
  customerName: string
  device: string
  inquiredAt: string
  installment: (typeof INSTALLMENT)[number]
  inquiryText: string
}

export interface CallTurn {
  role: 'agent' | 'customer'
  text: string
  /** ms */
  at: number
}

/** 통화 중 구간별 지연(ms) — 턴마다 하나씩. 에이전트 src/call-result.ts CallLatency와 같다. */
export interface CallLatency {
  endOfUtteranceMs: number[]
  llmTtftMs: number[]
  ttsTtfbMs: number[]
}

export interface CallRecord {
  callId: string
  /** web-test: /log 브라우저 테스트, phone: 전화 발신(나중). */
  source: 'web-test' | 'phone'
  customer: CallContext
  /** ms */
  startedAt: number
  endedAt: number
  /** end_call(AI가 끊음), no_response, max_duration, 연결 끊김 등. */
  endReason: string
  transcript: CallTurn[]
  /** 예전 에이전트는 보내지 않는다. */
  latency?: CallLatency
  /** saved → analyzed | analysis_failed */
  status: 'saved' | 'analyzed' | 'analysis_failed'
  result?: CallJudgment
  analysisModel?: string
  analysisError?: string
  analyzedAt?: number
}

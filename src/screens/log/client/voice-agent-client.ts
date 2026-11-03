import { postJson, requestJson } from './http'

// AI 음성 상담원 브라우저 테스트 — functions-xtool createVoiceAgentSession.
// 받은 serverUrl·participantToken으로 LiveKit에 직접 붙는다(음성은 함수를 거치지
// 않는다). 상담원 에이전트는 xtool-ai-sales-agent 레포에 있다.

/** 가상 고객 정보 — 에이전트가 첫 멘트와 상담에 쓴다(에이전트 레포
 * src/call-context.ts와 같은 모양). 비우면 "고객님"으로 부른다. */
export interface TestCallInput {
  customerName: string
  /** Monday 기기별 보드 이름 그대로(예: "F2 울트라"). */
  device: string
  /** 사람이 읽는 형식(예: "오늘 오후"). */
  inquiredAt: string
  installment: '희망' | '희망 안 함' | '미기입'
  inquiryText: string
}

export interface VoiceAgentSession {
  serverUrl: string
  roomName: string
  participantToken: string
}

export const createVoiceAgentSession = (input: TestCallInput) =>
  requestJson<VoiceAgentSession>(
    'createVoiceAgentSession',
    'AI 상담원 연결을 준비하지 못했습니다',
    postJson(input),
  )

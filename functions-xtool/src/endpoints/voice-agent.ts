import { randomUUID } from 'node:crypto'
import { onRequest } from 'firebase-functions/https'
import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
} from 'livekit-server-sdk'
import { livekitApiKey, livekitApiSecret, livekitUrl } from '../app'
import { endpoint } from '../http'
import type { ValidationResponse } from '../types'

// 에이전트 워커가 LiveKit에 등록한 이름(xtool-ai-sales-agent 레포 src/main.ts agentName).
const AGENT_NAME = 'xtool-sales-agent'
// 토큰으로 방에 들어올 수 있는 시간. 통화 길이가 아니라 접속 시작까지의 유효 시간이다.
const TOKEN_TTL = '10m'

const INSTALLMENT = ['희망', '희망 안 함', '미기입'] as const

/**
 * 에이전트에 넘기는 통화별 고객 정보 — job metadata(JSON). 에이전트 레포
 * src/call-context.ts의 CallContextSchema와 맞춰야 하는 계약이다.
 */
interface CallContext {
  callId: string
  customerName: string
  device: string
  inquiredAt: string
  installment: (typeof INSTALLMENT)[number]
  inquiryText: string
}

type TestCallInput = Omit<CallContext, 'callId'>

const optionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string'

// 테스트 화면이 고른 가상 고객 정보. 모두 선택값이고, 비우면 에이전트가 "고객님"으로 부른다.
const validateTestCall = (
  body: Record<string, unknown>,
): ValidationResponse<TestCallInput> => {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'invalid request body' }
  }
  for (const field of ['customerName', 'device', 'inquiredAt', 'inquiryText']) {
    if (!optionalString(body[field])) {
      return { ok: false, error: `${field} must be a string` }
    }
  }
  if (
    body.installment !== undefined &&
    !INSTALLMENT.includes(body.installment as CallContext['installment'])
  ) {
    return {
      ok: false,
      error: `installment must be one of: ${INSTALLMENT.join(', ')}`,
    }
  }
  return {
    ok: true,
    data: {
      customerName: (body.customerName as string | undefined) ?? '',
      device: (body.device as string | undefined) ?? '',
      inquiredAt: (body.inquiredAt as string | undefined) ?? '',
      installment:
        (body.installment as CallContext['installment'] | undefined) ??
        '미기입',
      inquiryText: (body.inquiryText as string | undefined) ?? '',
    },
  }
}

// ────────────────────────────────
// createVoiceAgentSession — AI 음성 상담원 브라우저 테스트(/log "AI 상담원" 탭).
// 새 LiveKit 방에 들어갈 접속 토큰을 만들고, 그 방에 상담원 에이전트를 배정한다
// (토큰의 roomConfig). 화면은 받은 serverUrl·participantToken으로 LiveKit에 직접
// WebRTC로 붙어 음성으로 통화한다 — 음성은 이 함수를 거치지 않는다.
// 내부 직원 테스트용이라 관리자만 부를 수 있다.
// ────────────────────────────────
export const createVoiceAgentSession = onRequest(
  { secrets: [livekitUrl, livekitApiKey, livekitApiSecret] },
  endpoint(
    {
      name: 'createVoiceAgentSession',
      method: 'POST',
      admin: true,
      validate: validateTestCall,
    },
    async ({ data, response }) => {
      const roomName = `voice-test-${Date.now()}-${randomUUID().slice(0, 8)}`
      const call: CallContext = { callId: roomName, ...data }

      const token = new AccessToken(
        livekitApiKey.value(),
        livekitApiSecret.value(),
        { identity: `tester-${randomUUID().slice(0, 8)}`, ttl: TOKEN_TTL },
      )
      token.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      })
      token.roomConfig = new RoomConfiguration({
        agents: [
          new RoomAgentDispatch({
            agentName: AGENT_NAME,
            metadata: JSON.stringify(call),
          }),
        ],
      })

      response.status(200).send({
        serverUrl: livekitUrl.value(),
        roomName,
        participantToken: await token.toJwt(),
      })
    },
  ),
)

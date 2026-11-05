import { randomUUID, timingSafeEqual } from 'node:crypto'
import { onDocumentCreated } from 'firebase-functions/firestore'
import { onRequest } from 'firebase-functions/https'
import * as logger from 'firebase-functions/logger'
import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
} from 'livekit-server-sdk'
import {
  anthropicApiKey,
  db,
  livekitApiKey,
  livekitApiSecret,
  livekitUrl,
  voiceAgentSecret,
} from '../app'
import { endpoint } from '../http'
import type { ValidationResponse } from '../types'
import { ANALYSIS_MODEL, analyzeCall } from '../voice-call/analyze'
import {
  CALLS,
  INSTALLMENT,
  type CallContext,
  type CallLatency,
  type CallRecord,
  type CallTurn,
} from '../voice-call/types'

// 에이전트 워커가 LiveKit에 등록한 이름(xtool-ai-sales-agent 레포 src/main.ts agentName).
const AGENT_NAME = 'xtool-sales-agent'
// 토큰으로 방에 들어올 수 있는 시간. 통화 길이가 아니라 접속 시작까지의 유효 시간이다.
const TOKEN_TTL = '10m'
// 웹 테스트 방 이름 앞머리 — 통화 기록의 source를 가른다.
const WEB_TEST_PREFIX = 'voice-test-'
// 대화록 크기 상한 — 8분 통화 상한(에이전트 call-guard.ts) 기준으로 넉넉하게.
const MAX_TURNS = 400
const MAX_TURN_CHARS = 4_000

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
      const suffix = randomUUID().slice(0, 8)
      const roomName = `${WEB_TEST_PREFIX}${Date.now()}-${suffix}`
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

type CallResultInput = Omit<
  CallRecord,
  | 'source'
  | 'status'
  | 'result'
  | 'analysisModel'
  | 'analysisError'
  | 'analyzedAt'
>

const isTurn = (value: unknown): value is CallTurn => {
  const turn = value as CallTurn
  return (
    typeof turn === 'object' &&
    turn !== null &&
    (turn.role === 'agent' || turn.role === 'customer') &&
    typeof turn.text === 'string' &&
    turn.text.length <= MAX_TURN_CHARS &&
    typeof turn.at === 'number'
  )
}

const validateCallResult = (
  body: Record<string, unknown>,
): ValidationResponse<CallResultInput> => {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'invalid request body' }
  }
  const { callId, customer, startedAt, endedAt, endReason, transcript } = body
  if (typeof callId !== 'string' || !/^[\w-]{1,128}$/.test(callId)) {
    return { ok: false, error: 'callId must be 1-128 letters, digits, _ or -' }
  }
  if (typeof customer !== 'object' || customer === null) {
    return { ok: false, error: 'customer is required' }
  }
  if (typeof startedAt !== 'number' || typeof endedAt !== 'number') {
    return { ok: false, error: 'startedAt and endedAt must be numbers' }
  }
  if (typeof endReason !== 'string') {
    return { ok: false, error: 'endReason must be a string' }
  }
  if (
    !Array.isArray(transcript) ||
    transcript.length > MAX_TURNS ||
    !transcript.every(isTurn)
  ) {
    return {
      ok: false,
      error: `transcript must be up to ${MAX_TURNS} turns of {role, text, at}`,
    }
  }
  const latency = parseLatency(body.latency)
  return {
    ok: true,
    data: {
      callId,
      customer: customer as CallContext,
      startedAt,
      endedAt,
      endReason,
      transcript,
      ...(latency ? { latency } : {}),
    },
  }
}

const LATENCY_KEYS = ['endOfUtteranceMs', 'llmTtftMs', 'ttsTtfbMs'] as const

// 지연 기록은 선택값 — 모양이 틀리면 버리고 저장은 계속한다(판정이 더 중요하다).
const parseLatency = (value: unknown): CallLatency | undefined => {
  if (typeof value !== 'object' || value === null) return undefined
  const latency = value as Record<string, unknown>
  const ok = LATENCY_KEYS.every(
    (key) =>
      Array.isArray(latency[key]) &&
      (latency[key] as unknown[]).length <= MAX_TURNS * 2 &&
      (latency[key] as unknown[]).every((ms) => typeof ms === 'number'),
  )
  return ok ? (latency as unknown as CallLatency) : undefined
}

const secretMatches = (given: string | undefined, expected: string) => {
  if (!given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// ────────────────────────────────
// submitVoiceCallResult — 에이전트가 통화를 마치면 대화록을 보낸다(에이전트 레포
// src/call-result.ts). 공유 비밀키(X-Voice-Agent-Secret)로 확인하고 calls/{callId}에
// 저장한다. 요약·판정은 저장을 받은 트리거(extractVoiceCallJudgment)가 따로 채운다 —
// 에이전트가 통화 종료를 모델 응답까지 기다리지 않게 하려는 것이다.
// ────────────────────────────────
export const submitVoiceCallResult = onRequest(
  { secrets: [voiceAgentSecret] },
  endpoint(
    {
      name: 'submitVoiceCallResult',
      method: 'POST',
    },
    async ({ request, response }) => {
      // 비밀키부터 — 키 없이 부른 요청에는 입력 검사 문구도 보여 주지 않는다.
      if (
        !secretMatches(
          request.get('x-voice-agent-secret'),
          voiceAgentSecret.value(),
        )
      ) {
        response.status(401).send({ error: 'invalid agent secret' })
        return
      }
      const validation = validateCallResult(request.body ?? {})
      if (!validation.ok) {
        response.status(400).send({ error: validation.error })
        return
      }
      const data = validation.data
      const record: CallRecord = {
        ...data,
        source: data.callId.startsWith(WEB_TEST_PREFIX) ? 'web-test' : 'phone',
        status: 'saved',
      }
      // 같은 통화를 두 번 보내면(재시도) 덮어쓰지 않고 처음 것을 둔다.
      const created = await db
        .collection(CALLS)
        .doc(data.callId)
        .create(record)
        .then(() => true)
        .catch((error: { code?: number }) => {
          if (error.code === 6) return false // ALREADY_EXISTS
          throw error
        })
      response
        .status(created ? 201 : 200)
        .send({ callId: data.callId, created })
    },
  ),
)

// ────────────────────────────────
// extractVoiceCallJudgment — 통화 기록이 저장되면 요약과 판정 칸(README 6-2)을
// 뽑아 같은 문서에 붙인다. 실패하면 status: analysis_failed와 이유를 남긴다.
// ────────────────────────────────
export const extractVoiceCallJudgment = onDocumentCreated(
  {
    document: `${CALLS}/{callId}`,
    database: 'xtool-read',
    secrets: [anthropicApiKey],
    timeoutSeconds: 120,
  },
  async (event) => {
    const snapshot = event.data
    if (!snapshot) return
    const record = snapshot.data() as CallRecord
    try {
      const result = await analyzeCall(record, anthropicApiKey.value())
      await snapshot.ref.update({
        status: 'analyzed',
        result,
        analysisModel: ANALYSIS_MODEL,
        analyzedAt: Date.now(),
      })
    } catch (error) {
      logger.error('extractVoiceCallJudgment 처리 실패:', error)
      await snapshot.ref.update({
        status: 'analysis_failed',
        analysisModel: ANALYSIS_MODEL,
        analysisError: error instanceof Error ? error.message : String(error),
        analyzedAt: Date.now(),
      })
    }
  },
)

// ────────────────────────────────
// getVoiceCall — 통화 기록 한 건(?callId=). /log "AI 상담원" 탭이 통화가 끝난 뒤
// 요약·판정이 붙을 때까지 몇 초마다 다시 부른다. 관리자만.
// ────────────────────────────────
export const getVoiceCall = onRequest(
  endpoint(
    { name: 'getVoiceCall', method: 'GET', admin: true },
    async ({ request, response }) => {
      const callId = String(request.query.callId ?? '')
      if (!/^[\w-]{1,128}$/.test(callId)) {
        response.status(400).send({ error: 'callId is required' })
        return
      }
      const snapshot = await db.collection(CALLS).doc(callId).get()
      if (!snapshot.exists) {
        response.status(404).send({ error: '통화 기록이 아직 없습니다' })
        return
      }
      response.status(200).send(snapshot.data())
    },
  ),
)

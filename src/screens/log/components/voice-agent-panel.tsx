import { useState } from 'react'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useTranscriptions,
  useVoiceAssistant,
  type AgentState,
} from '@livekit/components-react'
import { INQUIRY_DEVICES } from '../client/inquiry-client'
import {
  createVoiceAgentSession,
  type TestCallInput,
  type VoiceAgentSession,
} from '../client/voice-agent-client'
import { VoiceCallResult } from './voice-call-result'

/** 처음 열었을 때의 가상 고객 — 에이전트 레포의 SAMPLE_CALL과 같다. */
const SAMPLE_CALL: TestCallInput = {
  customerName: '김민수',
  device: 'F2 울트라',
  inquiredAt: '오늘 오후',
  installment: '희망',
  inquiryText: '가죽 지갑에 각인하고 싶은데 가능한가요?',
}

const INSTALLMENT_OPTIONS: TestCallInput['installment'][] = [
  '희망',
  '희망 안 함',
  '미기입',
]

const STATE_LABEL: Record<AgentState, string> = {
  disconnected: '연결 끊김',
  connecting: '상담원 연결 중',
  'pre-connect-buffering': '상담원 연결 중',
  failed: '연결 실패',
  initializing: '상담원 준비 중',
  idle: '대기',
  listening: '듣는 중',
  thinking: '생각하는 중',
  speaking: '말하는 중',
}

/**
 * /log의 "AI 상담원" 탭 — AI 음성 상담원(xtool-ai-sales-agent)과 브라우저로
 * 통화해 보는 내부 테스트. 가상 고객 정보를 정하고 "통화 시작"을 누르면
 * functions-xtool이 LiveKit 방과 접속 토큰을 만들고 상담원을 그 방에 보낸다.
 * 마이크 권한이 필요하다. 통화는 실제 고객 상담처럼 처음에 AI·녹음 고지를 한다.
 */
export function VoiceAgentPanel() {
  const [form, setForm] = useState<TestCallInput>(SAMPLE_CALL)
  const [session, setSession] = useState<VoiceAgentSession | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 방금 끝난 통화 — 끝나면 결과(요약·판정)를 아래에 보여 준다.
  const [lastCallId, setLastCallId] = useState<string | null>(null)

  const set = <K extends keyof TestCallInput>(
    key: K,
    value: TestCallInput[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }))

  const start = async () => {
    setStarting(true)
    setError(null)
    setLastCallId(null)
    const res = await createVoiceAgentSession(form)
    setStarting(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSession(res.data)
  }

  const end = () => {
    if (session) setLastCallId(session.roomName)
    setSession(null)
  }

  return (
    <>
      <header className="batch-log__header">
        <div>
          <h2 className="batch-log__title">AI 상담원 테스트</h2>
          <p className="batch-log__muted">
            상담 신청 고객에게 거는 AI 음성 상담원과 브라우저로 통화해 봅니다 —
            가상 고객 정보로 첫 멘트와 상담이 진행됩니다. 마이크 권한이
            필요합니다.
          </p>
        </div>
        <div className="batch-log__controls">
          {session ? (
            <button type="button" className="batch-log__refresh" onClick={end}>
              통화 끝내기
            </button>
          ) : (
            <button
              type="button"
              className="batch-log__refresh"
              disabled={starting}
              onClick={() => void start()}
            >
              {starting ? '연결 준비 중…' : '통화 시작'}
            </button>
          )}
        </div>
      </header>

      {error && <p className="batch-log__card batch-log__error">{error}</p>}

      <section
        className="batch-log__card voice-agent__form"
        aria-label="가상 고객"
      >
        <label>
          <span>고객 이름</span>
          <input
            value={form.customerName}
            disabled={!!session}
            placeholder="비우면 “고객님”"
            onChange={(e) => set('customerName', e.target.value)}
          />
        </label>
        <label>
          <span>문의 기기</span>
          <select
            value={form.device}
            disabled={!!session}
            onChange={(e) => set('device', e.target.value)}
          >
            <option value="">미기입</option>
            {INQUIRY_DEVICES.map((each) => (
              <option key={each.device} value={each.label}>
                {each.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>할부 희망</span>
          <select
            value={form.installment}
            disabled={!!session}
            onChange={(e) =>
              set('installment', e.target.value as TestCallInput['installment'])
            }
          >
            {INSTALLMENT_OPTIONS.map((each) => (
              <option key={each} value={each}>
                {each}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>신청 시각</span>
          <input
            value={form.inquiredAt}
            disabled={!!session}
            onChange={(e) => set('inquiredAt', e.target.value)}
          />
        </label>
        <label className="voice-agent__wide">
          <span>문의 내용</span>
          <input
            value={form.inquiryText}
            disabled={!!session}
            onChange={(e) => set('inquiryText', e.target.value)}
          />
        </label>
      </section>

      {session && (
        <LiveKitRoom
          className="voice-agent__room"
          serverUrl={session.serverUrl}
          token={session.participantToken}
          connect
          audio
          onDisconnected={end}
          onError={(e) => setError(e.message)}
        >
          <RoomAudioRenderer />
          <Conversation />
        </LiveKitRoom>
      )}

      {!session && lastCallId && (
        <VoiceCallResult key={lastCallId} callId={lastCallId} />
      )}
    </>
  )
}

/** 통화 중 — 상담원 상태와 대화 자막(상담원·내 말). */
function Conversation() {
  const { state } = useVoiceAssistant()
  const transcriptions = useTranscriptions()
  const { localParticipant } = useLocalParticipant()

  return (
    <section className="batch-log__card voice-agent__call" aria-label="통화">
      <p className="voice-agent__state" data-state={state}>
        <i aria-hidden="true" />
        {STATE_LABEL[state] ?? state}
      </p>
      <ol className="voice-agent__transcript">
        {transcriptions.map((each) => {
          const mine =
            each.participantInfo.identity === localParticipant.identity
          return (
            <li key={each.streamInfo.id} className={mine ? 'is-me' : ''}>
              <small>{mine ? '나' : 'AI'}</small>
              {each.text}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

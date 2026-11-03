import { useEffect, useState } from 'react'
import {
  getVoiceCall,
  type VoiceCallJudgment,
  type VoiceCallRecord,
} from '../client/voice-agent-client'

// 통화가 끝나면 에이전트가 대화록을 보내고(몇 초), functions-xtool 트리거가 요약·판정을
// 붙인다(10초 안팎). 그동안 이 간격으로 다시 묻고, 이만큼 지나면 멈춘다.
const POLL_MS = 3_000
const GIVE_UP_MS = 120_000

const FIELDS: readonly [keyof VoiceCallJudgment, string][] = [
  ['outcome', '통화 결과'],
  ['interest', '관심도'],
  ['device', '관심 기기'],
  ['purpose', '용도'],
  ['materials', '다룰 소재'],
  ['budget', '예산대'],
  ['payment', '결제 방식'],
  ['timing', '도입 시기'],
  ['visit', '방문체험'],
  ['visitTime', '체험 희망 일시'],
  ['visitRegion', '체험 희망 지역'],
  ['decisionMaker', '결정권'],
  ['callbackTime', '연락 희망 시각'],
  ['needsHuman', '사람 확인 필요'],
]

const average = (values: number[] | undefined) =>
  values?.length
    ? `${(values.reduce((a, b) => a + b, 0) / values.length / 1000).toFixed(2)}초`
    : '—'

const show = (value: VoiceCallJudgment[keyof VoiceCallJudgment]) => {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'boolean') return value ? '예' : '아니요'
  return value || '—'
}

/**
 * 방금 끝난 통화의 결과 — 요약과 판정 칸(README 6-2), 대화록. Firestore calls/{callId}를
 * getVoiceCall로 받아 판정이 붙을 때까지 몇 초마다 다시 묻는다. 통화마다 key를 바꿔
 * 새로 그린다(상태 초기화).
 */
export function VoiceCallResult({ callId }: { callId: string }) {
  const [record, setRecord] = useState<VoiceCallRecord | null>(null)
  const [gaveUp, setGaveUp] = useState(false)

  useEffect(() => {
    let stopped = false
    let timer: number | undefined
    const startedAt = Date.now()
    const poll = async () => {
      const res = await getVoiceCall(callId)
      if (stopped) return
      if (res.ok) setRecord(res.data)
      const done = res.ok && res.data.status !== 'saved'
      if (done) return
      if (Date.now() - startedAt > GIVE_UP_MS) {
        setGaveUp(true)
        return
      }
      timer = window.setTimeout(() => void poll(), POLL_MS)
    }
    void poll()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [callId])

  return (
    <section
      className="batch-log__card voice-agent__result"
      aria-label="통화 결과"
    >
      <h3 className="batch-log__card-desc">방금 통화 결과</h3>
      {!record && !gaveUp && (
        <p className="batch-log__muted">통화 기록을 기다리는 중…</p>
      )}
      {record?.status === 'saved' && !gaveUp && (
        <p className="batch-log__muted">요약과 판정을 만드는 중…</p>
      )}
      {gaveUp && record?.status !== 'analyzed' && (
        <p className="batch-log__muted">
          결과가 아직 없습니다. 에이전트의 통화 결과 전송 설정
          (VOICE_RESULT_URL)과 functions 로그를 확인해 주세요.
        </p>
      )}
      {record?.status === 'analysis_failed' && (
        <p className="batch-log__error">판정 실패: {record.analysisError}</p>
      )}
      {record?.result && (
        <>
          <p className="voice-agent__summary">{record.result.summary}</p>
          <dl className="voice-agent__fields">
            {FIELDS.map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{show(record.result![key])}</dd>
              </div>
            ))}
          </dl>
          <p className="batch-log__muted">
            관심도 근거: {record.result.interestReason}
          </p>
        </>
      )}
      {record?.latency && (
        <p className="batch-log__muted">
          평균 지연 — 말 끝 판단 {average(record.latency.endOfUtteranceMs)} ·
          LLM 첫 토큰 {average(record.latency.llmTtftMs)} · TTS 첫 음성{' '}
          {average(record.latency.ttsTtfbMs)}
        </p>
      )}
      {record && (
        <details className="voice-agent__details">
          <summary>
            대화록 {record.transcript.length}줄 · 종료 사유 {record.endReason}
          </summary>
          <ol className="voice-agent__transcript">
            {record.transcript.map((turn, index) => (
              <li
                key={index}
                className={turn.role === 'customer' ? 'is-me' : ''}
              >
                <small>{turn.role === 'customer' ? '고객' : 'AI'}</small>
                {turn.text}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  )
}

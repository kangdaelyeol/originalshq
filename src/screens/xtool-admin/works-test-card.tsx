import { httpsCallable } from 'firebase/functions'
import { Send } from 'lucide-react'
import { useState } from 'react'
import { xtoolFirebase } from '@/xtool-auth/firebase'
import { functionErrorMessage } from './errors'
import { Button, GlassCard } from '@/screens/xtool-tech/components/basic-parts'

// 보낼 곳 — 나에게 1:1(웍스 아이디), 채널 ID를 직접 적은 채팅방, 정해 둔 채팅방(functions-xtool works/channels.ts 열쇠)
type Target = 'me' | 'channelId' | 'tech'

const TARGETS: readonly { key: Target; label: string }[] = [
  { key: 'me', label: '나에게 1:1' },
  { key: 'channelId', label: '채널 ID 직접 입력' },
  { key: 'tech', label: '기술팀 채팅방' },
]

interface WorksTestInput {
  channel?: string
  channelId?: string
  userId?: string
}

// 적어 둔 웍스 아이디 — 이 브라우저에만(다음에 다시 적지 않게)
const USER_KEY = 'xtool-admin:works-test-user'
const readUser = () => {
  try {
    return window.localStorage.getItem(USER_KEY) ?? ''
  } catch {
    return ''
  }
}
const saveUser = (value: string) => {
  try {
    window.localStorage.setItem(USER_KEY, value)
  } catch {
    /* 저장소를 못 쓰면 이번만 */
  }
}

const sendTest = async (input: WorksTestInput) =>
  (
    await httpsCallable<WorksTestInput, { ok: boolean; channel: string }>(
      xtoolFirebase().functions,
      'techWorksTest',
    )(input)
  ).data

/**
 * 네이버 웍스 봇 연결 확인 — 확인 메시지를 하나 보낸다(functions-xtool techWorksTest). 다른 사람이 보지 않게 처음에는
 * 나에게 1:1(웍스 아이디)로 보내 보고, 알림을 켜기 전에 실제 채팅방으로 보낸다. 실패하면 웍스가 돌려준 이유를 보인다.
 */
export function WorksTestCard() {
  const [target, setTarget] = useState<Target>('me')
  const [userId, setUserId] = useState(readUser)
  const [channelId, setChannelId] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const value = target === 'me' ? userId.trim() : target === 'channelId' ? channelId.trim() : 'tech'
  const run = async () => {
    setBusy(true)
    setResult(null)
    try {
      if (target === 'me') saveUser(value)
      const input: WorksTestInput =
        target === 'me' ? { userId: value } : target === 'channelId' ? { channelId: value } : { channel: 'tech' }
      const data = await sendTest(input)
      setResult({ ok: true, text: `${data.channel}에 확인 메시지를 보냈어요. 웍스에서 왔는지 봐 주세요.` })
    } catch (e) {
      setResult({ ok: false, text: functionErrorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <GlassCard
      title="네이버 웍스 연결 확인"
      subtitle="웍스 봇으로 확인 메시지를 하나 보내요. 처음에는 나에게 1:1로 보내 보고, 알림을 켜기 전에 실제 채팅방으로 보내 보세요."
      actions={
        <>
          <select
            className="field__input works-test__select"
            aria-label="보낼 곳"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value as Target)
              setResult(null)
            }}
          >
            {TARGETS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          {target === 'me' && (
            <input
              className="field__input works-test__input"
              aria-label="웍스 아이디"
              placeholder="웍스 아이디(예: name@회사도메인)"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          )}
          {target === 'channelId' && (
            <input
              className="field__input works-test__input"
              aria-label="채널 ID"
              placeholder="채널 ID"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            />
          )}
          <Button size="sm" icon={Send} disabled={busy || !value} onClick={() => void run()}>
            {busy ? '보내는 중…' : '확인 메시지 보내기'}
          </Button>
        </>
      }
    >
      {result ? (
        <p
          className={result.ok ? 'member-form__result' : 'member-form__result member-form__result--crit'}
          role={result.ok ? 'status' : 'alert'}
        >
          {result.text}
        </p>
      ) : (
        <p className="phone-copy__hint">
          웍스 아이디는 웍스 로그인 아이디예요(관리자 콘솔 구성원 목록이나 내 프로필에서 볼 수 있어요). 봇 공개 범위에
          내가 들어 있어야 1:1로 받을 수 있어요.
        </p>
      )}
    </GlassCard>
  )
}

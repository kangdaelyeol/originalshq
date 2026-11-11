import { httpsCallable } from 'firebase/functions'
import { Save, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { xtoolFirebase } from '@/xtool-auth/firebase'
import { functionErrorMessage } from './errors'
import { Button, GlassCard } from '@/screens/xtool-tech/components/basic-parts'

interface Settings {
  enabled: boolean
  channelId: string | null
  updatedAt: number | null
  updatedBy: string | null
}

interface Input {
  action: 'get' | 'set' | 'test'
  enabled?: boolean
  channelId?: string | null
}

const callNotify = async (input: Input) =>
  (await httpsCallable<Input, { settings: Settings }>(xtoolFirebase().functions, 'techInquiryNotify')(input)).data
    .settings

const updatedText = (s: Settings | null) =>
  s?.updatedAt
    ? `${new Date(s.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · ${s.updatedBy ?? ''}`
    : '아직 저장한 적이 없어요'

/**
 * 아톡문의 새 문의 웍스 알림 — 아톡문의 보드에 항목이 만들어지면 웍스 채팅방에 고객명·연락처·기기 종류·문의 종류·
 * 문의 내용과 보드 링크를 보낸다(functions-xtool inquiry-notify.ts — webhook이 보낸다). 여기서 켜고 끄고 채널 ID를
 * 정한다. 봇이 그 채팅방에 초대돼 있어야 한다.
 */
export function InquiryNotifyCard() {
  const [saved, setSaved] = useState<Settings | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [channelId, setChannelId] = useState('')
  const [busy, setBusy] = useState<'load' | 'save' | 'test' | null>('load')
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const apply = (s: Settings) => {
    setSaved(s)
    setEnabled(s.enabled)
    setChannelId(s.channelId ?? '')
  }

  useEffect(() => {
    let cancelled = false
    callNotify({ action: 'get' })
      .then((s) => !cancelled && apply(s))
      .catch((e) => !cancelled && setResult({ ok: false, text: functionErrorMessage(e) }))
      .finally(() => !cancelled && setBusy(null))
    return () => {
      cancelled = true
    }
  }, [])

  const changed = !!saved && (saved.enabled !== enabled || (saved.channelId ?? '') !== channelId.trim())

  const run = async (action: 'set' | 'test') => {
    setBusy(action === 'set' ? 'save' : 'test')
    setResult(null)
    try {
      const s = await callNotify(
        action === 'set' ? { action, enabled, channelId: channelId.trim() || null } : { action },
      )
      apply(s)
      setResult({
        ok: true,
        text: action === 'set' ? '저장했어요.' : '저장한 채팅방에 예시 메시지를 보냈어요. 웍스에서 확인해 주세요.',
      })
    } catch (e) {
      setResult({ ok: false, text: functionErrorMessage(e) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <GlassCard
      title="아톡문의 새 문의 웍스 알림"
      subtitle="아톡문의 보드에 항목이 만들어지면 웍스 채팅방에 고객명·연락처·기기 종류·문의 종류·문의 내용과 보드 링크를 보내요. 봇이 그 채팅방에 초대돼 있어야 해요. 켜기 전에 Lightsail 알림을 꺼야 두 번 가지 않아요."
      actions={
        <>
          <Button
            size="sm"
            variant="ghost"
            icon={Send}
            disabled={busy !== null || !saved?.channelId || changed}
            title={changed ? '먼저 저장해 주세요' : undefined}
            onClick={() => void run('test')}
          >
            {busy === 'test' ? '보내는 중…' : '테스트 보내기'}
          </Button>
          <Button size="sm" icon={Save} disabled={busy !== null || !changed} onClick={() => void run('set')}>
            {busy === 'save' ? '저장하는 중…' : '저장'}
          </Button>
        </>
      }
    >
      <div className="inquiry-notify">
        <label className="inquiry-notify__toggle">
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy === 'load'}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          알림 켜기
        </label>
        <label className="inquiry-notify__field">
          <span>채널 ID</span>
          <input
            className="field__input"
            placeholder="웍스 채팅방 채널 ID"
            value={channelId}
            disabled={busy === 'load'}
            onChange={(e) => setChannelId(e.target.value)}
          />
        </label>
        {result ? (
          <p
            className={result.ok ? 'member-form__result' : 'member-form__result member-form__result--crit'}
            role={result.ok ? 'status' : 'alert'}
          >
            {result.text}
          </p>
        ) : (
          <p className="phone-copy__hint">
            {busy === 'load' ? '설정을 불러오는 중…' : `마지막 저장: ${updatedText(saved)}`}
          </p>
        )}
      </div>
    </GlassCard>
  )
}

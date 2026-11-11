import { httpsCallable } from 'firebase/functions'
import { Plus, Save, Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { xtoolFirebase } from '@/xtool-auth/firebase'
import { functionErrorMessage } from './errors'
import { Button, GlassCard } from '@/screens/xtool-tech/components/basic-parts'

interface Settings {
  enabled: boolean
  delayEnabled: boolean
  channelId: string | null
  updatedAt: number | null
  updatedBy: string | null
}

interface Input {
  action: 'get' | 'set' | 'test' | 'holidays'
  enabled?: boolean
  delayEnabled?: boolean
  channelId?: string | null
  holidays?: string[]
}

interface Output {
  settings: Settings
  holidays: string[]
  /** 지연 알림을 켤 때 이미 10분을 넘어 보낸 것으로 기록한 건 수 */
  baselined?: number
}

const callNotify = async (input: Input) =>
  (await httpsCallable<Input, Output>(xtoolFirebase().functions, 'techInquiryNotify')(input)).data

const updatedText = (s: Settings | null) =>
  s?.updatedAt
    ? `${new Date(s.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · ${s.updatedBy ?? ''}`
    : '아직 저장한 적이 없어요'

/** 2026-12-25 → 2026. 12. 25.(금) */
const holidayText = (date: string) =>
  new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  })

/**
 * 아톡문의 웍스 알림 — 새 문의(아톡문의 보드에 항목이 만들어지면 고객명·연락처·기기 종류·문의 종류·문의 내용과 보드
 * 링크, webhook이 보낸다 — inquiry-notify.ts)와 10분 지연(상담 상태가 신규 문의인 채 시간추적이 10분을 넘으면,
 * 평일 9~17시 1분마다 점검 — inquiry-delay.ts)을 같은 채팅방으로 보낸다. 둘을 따로 켜고 끄고, 지연 알림을 보내지 않는
 * 공휴일을 정한다. 봇이 그 채팅방에 초대돼 있어야 한다.
 */
export function InquiryNotifyCard() {
  const [saved, setSaved] = useState<Settings | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [delayEnabled, setDelayEnabled] = useState(false)
  const [channelId, setChannelId] = useState('')
  const [holidays, setHolidays] = useState<string[]>([])
  const [newHoliday, setNewHoliday] = useState('')
  const [busy, setBusy] = useState<'load' | 'save' | 'test' | 'holidays' | null>('load')
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  // 서버가 아직 옛 버전이면(배포 전) 지연 알림·공휴일이 빠져 온다 — 없는 값은 꺼짐·빈 목록으로 본다
  const apply = (out: Output) => {
    const settings = { ...out.settings, delayEnabled: out.settings.delayEnabled ?? false }
    setSaved(settings)
    setEnabled(settings.enabled)
    setDelayEnabled(settings.delayEnabled)
    setChannelId(settings.channelId ?? '')
    setHolidays(Array.isArray(out.holidays) ? out.holidays : [])
  }

  useEffect(() => {
    let cancelled = false
    callNotify({ action: 'get' })
      .then((out) => !cancelled && apply(out))
      .catch((e) => !cancelled && setResult({ ok: false, text: functionErrorMessage(e) }))
      .finally(() => !cancelled && setBusy(null))
    return () => {
      cancelled = true
    }
  }, [])

  const changed =
    !!saved &&
    (saved.enabled !== enabled || saved.delayEnabled !== delayEnabled || (saved.channelId ?? '') !== channelId.trim())

  const run = async (input: Input, done: (out: Output) => string) => {
    setBusy(input.action === 'set' ? 'save' : input.action === 'test' ? 'test' : 'holidays')
    setResult(null)
    try {
      const out = await callNotify(input)
      apply(out)
      setResult({ ok: true, text: done(out) })
    } catch (e) {
      setResult({ ok: false, text: functionErrorMessage(e) })
    } finally {
      setBusy(null)
    }
  }

  const save = () =>
    run({ action: 'set', enabled, delayEnabled, channelId: channelId.trim() || null }, (out) =>
      out.baselined
        ? `저장했어요. 이미 10분을 넘어 있던 문의 ${out.baselined}건은 보낸 것으로 기록해 두었어요(한꺼번에 가지 않게).`
        : '저장했어요.',
    )

  const saveHolidays = (next: string[]) => run({ action: 'holidays', holidays: next }, () => '공휴일을 저장했어요.')

  return (
    <GlassCard
      title="아톡문의 웍스 알림"
      subtitle="새 문의와 10분 지연을 같은 채팅방으로 보내요. 새 문의는 항목이 만들어지면, 지연은 상담 상태가 '신규 문의'인 채 시간추적이 10분을 넘으면(평일 9~17시, 공휴일 빼고 1분마다 점검) 한 번 보내요. 켜기 전에 Lightsail의 같은 알림을 꺼야 두 번 가지 않아요."
      actions={
        <>
          <Button
            size="sm"
            variant="ghost"
            icon={Send}
            disabled={busy !== null || !saved?.channelId || changed}
            title={changed ? '먼저 저장해 주세요' : undefined}
            onClick={() =>
              void run(
                { action: 'test' },
                () => '저장한 채팅방에 새 문의 예시 메시지를 보냈어요. 웍스에서 확인해 주세요.',
              )
            }
          >
            {busy === 'test' ? '보내는 중…' : '테스트 보내기'}
          </Button>
          <Button size="sm" icon={Save} disabled={busy !== null || !changed} onClick={() => void save()}>
            {busy === 'save' ? '저장하는 중…' : '저장'}
          </Button>
        </>
      }
    >
      <div className="inquiry-notify">
        <div className="inquiry-notify__toggles">
          <label className="inquiry-notify__toggle">
            <input
              type="checkbox"
              checked={enabled}
              disabled={busy === 'load'}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            새 문의 알림 켜기
          </label>
          <label className="inquiry-notify__toggle">
            <input
              type="checkbox"
              checked={delayEnabled}
              disabled={busy === 'load'}
              onChange={(e) => setDelayEnabled(e.target.checked)}
            />
            10분 지연 알림 켜기
          </label>
        </div>
        <label className="inquiry-notify__field">
          <span>채널 ID(두 알림 같은 채팅방)</span>
          <input
            className="field__input"
            placeholder="웍스 채팅방 채널 ID"
            value={channelId}
            disabled={busy === 'load'}
            onChange={(e) => setChannelId(e.target.value)}
          />
        </label>

        <div className="inquiry-notify__field">
          <span>공휴일 — 이날은 지연 알림을 보내지 않아요(주말은 원래 빠져요)</span>
          <div className="inquiry-notify__holiday-add">
            <input
              type="date"
              className="field__input"
              aria-label="추가할 공휴일"
              value={newHoliday}
              disabled={busy !== null}
              onChange={(e) => setNewHoliday(e.target.value)}
            />
            <Button
              size="sm"
              variant="ghost"
              icon={Plus}
              disabled={busy !== null || !newHoliday || holidays.includes(newHoliday)}
              onClick={() => {
                void saveHolidays([...holidays, newHoliday])
                setNewHoliday('')
              }}
            >
              추가
            </Button>
          </div>
          {holidays.length > 0 ? (
            <ul className="inquiry-notify__holidays">
              {holidays.map((date) => (
                <li key={date}>
                  {holidayText(date)}
                  <button
                    type="button"
                    aria-label={`${date} 빼기`}
                    disabled={busy !== null}
                    onClick={() => void saveHolidays(holidays.filter((d) => d !== date))}
                  >
                    <X size={13} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="phone-copy__hint">아직 넣은 공휴일이 없어요.</p>
          )}
        </div>

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

import { CircleCheck, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { addMember, normalizeEmail, TEAMS, type TeamKey } from '@/xtool-auth/members'
import { Button } from '@/screens/xtool-tech/components/ui/button'
import { GlassCard } from '@/screens/xtool-tech/components/ui/glass-card'
import { TextField } from '@/screens/xtool-tech/components/ui/text-field'
import { firestoreErrorMessage } from './errors'

type Result = { tone: 'good' | 'crit'; text: string }

/** 구성원 등록 — 등록된 이메일만 팀 페이지에 Google 로그인·회원가입할 수 있다. */
export function MemberForm({ adminEmail }: { adminEmail: string }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const email = normalizeEmail(String(data.get('email') ?? ''))
    const teams = Object.fromEntries(TEAMS.map(({ key }) => [key, data.get(`team-${key}`) === 'on'])) as Record<
      TeamKey,
      boolean
    >
    setBusy(true)
    setResult(null)
    try {
      const added = await addMember(
        {
          email,
          name: String(data.get('name') ?? ''),
          isAdmin: data.get('isAdmin') === 'on',
          teams,
          status: 'active',
        },
        adminEmail,
      )
      if (added) {
        form.reset()
        setResult({ tone: 'good', text: `등록했어요 — ${email} 계정으로 Google 로그인이나 회원가입을 할 수 있어요.` })
      } else {
        setResult({ tone: 'crit', text: '이미 등록된 이메일이에요. 아래 목록에서 권한을 바꿔 주세요.' })
      }
    } catch (error) {
      setResult({ tone: 'crit', text: firestoreErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <GlassCard title="구성원 등록" subtitle="등록한 이메일만 팀 페이지에 들어올 수 있어요 — 회사 Google 계정이면 가입 없이 바로 로그인돼요.">
      <form className="member-form" onSubmit={(e) => void onSubmit(e)}>
        <div className="member-form__fields">
          <TextField label="이메일" name="email" type="email" placeholder="name@xtool.co.kr" required autoComplete="off" />
          <TextField label="이름" name="name" placeholder="홍길동" required maxLength={60} autoComplete="off" />
        </div>
        <fieldset className="member-form__group">
          <legend className="field__label">팀 페이지 권한</legend>
          <div className="member-form__checks">
            {TEAMS.map((team) => (
              <label key={team.key} className="check">
                <input type="checkbox" name={`team-${team.key}`} defaultChecked={team.key === 'tech'} />
                {team.label}
                {!team.ready && <span className="member-form__soon">준비 중</span>}
              </label>
            ))}
            <span className="member-form__divider" aria-hidden />
            <label className="check">
              <input type="checkbox" name="isAdmin" />
              관리자(이 화면 사용)
            </label>
          </div>
        </fieldset>
        <div className="form__actions">
          <Button type="submit" icon={UserPlus} disabled={busy}>
            {busy ? '등록하는 중…' : '등록하기'}
          </Button>
          {result && (
            <p className={`member-form__result member-form__result--${result.tone}`} role="status">
              {result.tone === 'good' && <CircleCheck size={14} aria-hidden />}
              {result.text}
            </p>
          )}
        </div>
      </form>
    </GlassCard>
  )
}

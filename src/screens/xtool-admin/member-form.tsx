import { CircleCheck, RefreshCw, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import {
  addMember,
  generateTempPassword,
  issueAccount,
  MIN_PASSWORD,
  normalizeEmail,
  TEAMS,
  type TeamKey,
} from '@xtool-core/members'
import { Button } from '@/ohq-ui/components/button'
import { GlassCard } from '@/ohq-ui/components/glass-card'
import { TextField } from '@/ohq-ui/components/text-field'
import { CredentialNote } from './credential-note'
import { firestoreErrorMessage, functionErrorMessage } from './errors'

type Result = { tone: 'good' | 'crit'; text: string }

/**
 * 구성원 등록 — 기본은 아이디(회사 이메일)와 임시 비밀번호 발급: 직원은 그걸로 처음 로그인해
 * 자기 비밀번호를 정한다. 발급을 끄면 회사 Google 계정으로만 로그인하는 구성원이 된다.
 */
export function MemberForm({ adminEmail }: { adminEmail: string }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [issue, setIssue] = useState(true)
  const [password, setPassword] = useState(generateTempPassword)
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const email = normalizeEmail(String(data.get('email') ?? ''))
    const name = String(data.get('name') ?? '')
    const isAdmin = data.get('isAdmin') === 'on'
    const teams = Object.fromEntries(TEAMS.map(({ key }) => [key, data.get(`team-${key}`) === 'on'])) as Record<
      TeamKey,
      boolean
    >
    setBusy(true)
    setResult(null)
    setIssued(null)
    try {
      if (issue) {
        await issueAccount({ email, name, isAdmin, teams, password })
        form.reset()
        setIssued({ email, password })
        setPassword(generateTempPassword())
      } else {
        const added = await addMember({ email, name, isAdmin, teams, status: 'active' }, adminEmail)
        if (added) {
          form.reset()
          setResult({ tone: 'good', text: `등록했어요 — ${email} Google 계정으로 로그인할 수 있어요.` })
        } else {
          setResult({ tone: 'crit', text: '이미 등록된 이메일이에요. 아래 목록에서 권한을 바꿔 주세요.' })
        }
      }
    } catch (error) {
      setResult({ tone: 'crit', text: issue ? functionErrorMessage(error) : firestoreErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <GlassCard
      title="구성원 등록"
      subtitle="아이디(회사 이메일)와 임시 비밀번호를 발급하면, 직원은 처음 로그인할 때 자기 비밀번호를 정해요."
    >
      <form className="member-form" onSubmit={(e) => void onSubmit(e)}>
        <div className="member-form__fields">
          <TextField label="아이디(이메일)" name="email" type="email" placeholder="name@xtool.co.kr" required autoComplete="off" />
          <TextField label="이름" name="name" placeholder="홍길동" required maxLength={60} autoComplete="off" />
        </div>

        <fieldset className="member-form__group">
          <legend className="field__label">로그인 방법</legend>
          <div className="member-form__checks">
            <label className="check">
              <input type="checkbox" checked={issue} onChange={(e) => setIssue(e.target.checked)} />
              아이디·임시 비밀번호 발급
            </label>
            {!issue && <span className="member-form__soon">회사 Google 계정으로만 로그인</span>}
          </div>
          {issue && (
            <div className="member-form__password">
              <label className="field__label" htmlFor="member-temp-password">
                임시 비밀번호
              </label>
              <div className="member-form__password-row">
                <input
                  id="member-temp-password"
                  className="field__input member-form__password-input"
                  value={password}
                  minLength={MIN_PASSWORD}
                  required
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button variant="ghost" icon={RefreshCw} onClick={() => setPassword(generateTempPassword())}>
                  새로 만들기
                </Button>
              </div>
            </div>
          )}
        </fieldset>

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
            {busy ? '등록하는 중…' : issue ? '등록하고 발급하기' : '등록하기'}
          </Button>
          {result && (
            <p className={`member-form__result member-form__result--${result.tone}`} role="status">
              {result.tone === 'good' && <CircleCheck size={14} aria-hidden />}
              {result.text}
            </p>
          )}
        </div>
        {issued && <CredentialNote {...issued} onClose={() => setIssued(null)} />}
      </form>
    </GlassCard>
  )
}

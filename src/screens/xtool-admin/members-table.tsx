import { KeyRound, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  generateTempPassword,
  removeMember,
  resetMemberPassword,
  TEAMS,
  updateMember,
  watchMembers,
  type XtoolMember,
} from '@/xtool-auth/members'
import { initialsOf } from '@/xtool-auth/use-xtool-session'
import { Avatar } from '@/screens/xtool-tech/components/ui/avatar'
import { Button } from '@/screens/xtool-tech/components/ui/button'
import { GlassCard } from '@/screens/xtool-tech/components/ui/glass-card'
import { StatusPill } from '@/screens/xtool-tech/components/ui/status-pill'
import { cx } from '@/screens/xtool-tech/lib/cx'
import { CredentialNote } from './credential-note'
import { firestoreErrorMessage, functionErrorMessage, relativeTime } from './errors'

// 삭제 버튼을 한 번 더 눌러야 지운다 — 그 사이 기다리는 시간.
const CONFIRM_MS = 3000

function statusOf(member: XtoolMember) {
  if (member.status === 'disabled') return { tone: 'crit', label: '정지' } as const
  // 임시 비밀번호를 받고 아직 자기 비밀번호를 안 정함
  if (member.mustChangePassword) return { tone: 'warn', label: '첫 로그인 대기' } as const
  if (!member.uid) return { tone: 'neutral', label: '가입 전' } as const
  return { tone: 'good', label: '활성' } as const
}

/** 등록된 구성원 — 실시간. 자기 자신의 관리자 권한·정지·삭제는 막는다(규칙도 막는다). */
export function MembersTable({ selfEmail }: { selfEmail: string }) {
  const [members, setMembers] = useState<XtoolMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  // 비밀번호 재발급 — 한 번 더 눌러야 한다(쓰던 로그인이 끊기니까). 발급한 값은 위에 보여 준다.
  const [confirmingReset, setConfirmingReset] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null)

  useEffect(
    () =>
      watchMembers(
        (next) => {
          setMembers(next)
          setError(null)
        },
        (e) => setError(firestoreErrorMessage(e)),
      ),
    [],
  )

  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(null), CONFIRM_MS)
    return () => clearTimeout(timer)
  }, [confirming])

  useEffect(() => {
    if (!confirmingReset) return
    const timer = setTimeout(() => setConfirmingReset(null), CONFIRM_MS)
    return () => clearTimeout(timer)
  }, [confirmingReset])

  const run = async (email: string, task: () => Promise<void>) => {
    setPending(email)
    setError(null)
    try {
      await task()
    } catch (e) {
      setError(firestoreErrorMessage(e))
    } finally {
      setPending(null)
    }
  }

  const onResetPassword = (email: string) => {
    if (confirmingReset !== email) {
      setConfirmingReset(email)
      return
    }
    setConfirmingReset(null)
    const password = generateTempPassword()
    setPending(email)
    setError(null)
    setIssued(null)
    resetMemberPassword(email, password)
      .then(() => setIssued({ email, password }))
      .catch((e: unknown) => setError(functionErrorMessage(e)))
      .finally(() => setPending(null))
  }

  const onDelete = (email: string) => {
    if (confirming !== email) {
      setConfirming(email)
      return
    }
    setConfirming(null)
    void run(email, () => removeMember(email))
  }

  const needle = query.trim().toLowerCase()
  const shown = (members ?? []).filter(
    (m) => !needle || m.email.includes(needle) || m.name.toLowerCase().includes(needle),
  )
  const activeCount = (members ?? []).filter((m) => m.status === 'active').length

  return (
    <GlassCard
      title="구성원"
      subtitle={
        members
          ? `전체 ${members.length}명 · 사용 중 ${activeCount}명 — 팀 칩을 눌러 권한을 켜고 끄세요`
          : '불러오는 중…'
      }
      actions={
        <label className="admin-search">
          <Search size={14} aria-hidden />
          <span className="sr-only">이름·이메일 검색</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름·이메일 검색"
          />
        </label>
      }
    >
      {error && (
        <p className="member-form__result member-form__result--crit admin-table-error" role="alert">
          {error}
        </p>
      )}
      {issued && <CredentialNote {...issued} onClose={() => setIssued(null)} />}
      <div className="table-wrap">
        <table className="table table--roomy">
          <thead>
            <tr>
              <th scope="col">구성원</th>
              <th scope="col">팀 페이지 권한</th>
              <th scope="col">관리자</th>
              <th scope="col">상태</th>
              <th scope="col">마지막 로그인</th>
              <th scope="col">
                <span className="sr-only">작업</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members && shown.length === 0 && (
              <tr>
                <td colSpan={6} className="table__empty">
                  {needle ? '검색 결과가 없어요.' : '아직 등록된 구성원이 없어요.'}
                </td>
              </tr>
            )}
            {shown.map((member) => {
              const isSelf = member.email === selfEmail
              const status = statusOf(member)
              const busy = pending === member.email
              return (
                <tr key={member.email} className={cx(member.status === 'disabled' && 'is-disabled')} aria-busy={busy}>
                  <td>
                    <div className="person">
                      <Avatar initials={initialsOf(member.name, member.email)} color="rgba(255, 255, 255, 0.12)" />
                      <div>
                        <p className="person__name">
                          {member.name}
                          {isSelf && <span className="member-self">나</span>}
                        </p>
                        <p className="person__sub">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="admin-chips">
                      {TEAMS.map((team) => {
                        const on = member.teams[team.key] === true
                        return (
                          <button
                            key={team.key}
                            type="button"
                            className={cx('admin-chip', on && 'is-on')}
                            aria-pressed={on}
                            disabled={busy}
                            title={team.ready ? undefined : '페이지 준비 중 — 권한은 미리 줄 수 있어요'}
                            onClick={() =>
                              void run(member.email, () =>
                                updateMember(member.email, { teams: { ...member.teams, [team.key]: !on } }),
                              )
                            }
                          >
                            {team.label}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                  <td>
                    <div className="admin-chips">
                      <button
                        type="button"
                        className={cx('admin-chip', member.isAdmin && 'is-on')}
                        aria-pressed={member.isAdmin}
                        aria-label={`${member.name} 관리자`}
                        disabled={busy || isSelf}
                        title={isSelf ? '자기 자신의 관리자 권한은 뺄 수 없어요' : undefined}
                        onClick={() => void run(member.email, () => updateMember(member.email, { isAdmin: !member.isAdmin }))}
                      >
                        관리자
                      </button>
                    </div>
                  </td>
                  <td>
                    <StatusPill tone={status.tone} dot>
                      {status.label}
                    </StatusPill>
                  </td>
                  <td className="table__muted">
                    {member.lastSignInAt ? relativeTime(member.lastSignInAt.toMillis()) : '—'}
                  </td>
                  <td>
                    {!isSelf && (
                      <div className="row-actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={KeyRound}
                          disabled={busy || member.status === 'disabled'}
                          className={cx(confirmingReset === member.email && 'button--danger')}
                          title="임시 비밀번호를 새로 만들어요 — 쓰던 기기의 로그인은 끊겨요"
                          aria-label={
                            confirmingReset === member.email ? `${member.name} 비밀번호 정말 재발급` : `${member.name} 비밀번호 재발급`
                          }
                          onClick={() => onResetPassword(member.email)}
                        >
                          {confirmingReset === member.email ? '정말 재발급' : '비밀번호 재발급'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void run(member.email, () =>
                              updateMember(member.email, {
                                status: member.status === 'active' ? 'disabled' : 'active',
                              }),
                            )
                          }
                        >
                          {member.status === 'active' ? '정지' : '정지 해제'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          disabled={busy}
                          className={cx(confirming === member.email && 'button--danger')}
                          aria-label={confirming === member.email ? `${member.name} 정말 삭제` : `${member.name} 삭제`}
                          onClick={() => onDelete(member.email)}
                        >
                          {confirming === member.email ? '정말 삭제' : '삭제'}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}

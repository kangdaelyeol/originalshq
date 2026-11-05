import { KeyRound, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  GROUP_ROLES,
  POSITIONS,
  removeMember,
  resetMemberPassword,
  TEAMS,
  TECH_AREAS,
  updateMember,
  watchMembers,
  type Position,
  type TeamKey,
  type XtoolMember,
} from '@xtool-core/members'
import { generateTempPassword } from '@/xtool-auth/members'
import { initialsOf } from '@/xtool-auth/use-xtool-session'
import { usePhotoOf } from '@/screens/xtool-tech/data/tech-profiles'
import { Avatar } from '@/ohq-ui/components/avatar'
import { Button } from '@/ohq-ui/components/button'
import { GlassCard } from '@/ohq-ui/components/glass-card'
import { ConfirmDialog } from '@/ohq-ui/components/confirm-dialog'
import { StatusPill } from '@/ohq-ui/components/status-pill'
import { cx } from '@/ohq-ui/lib/cx'
import { CredentialNote } from './credential-note'
import { firestoreErrorMessage, functionErrorMessage, relativeTime } from './errors'


// 표 위 팀 버튼 — 전체·팀별(TEAMS)·관리자. 검색과 같이 걸린다.
type MemberFilter = 'all' | TeamKey | 'admin'

const FILTERS: readonly { key: MemberFilter; label: string; match: (m: XtoolMember) => boolean }[] = [
  { key: 'all', label: '전체', match: () => true },
  ...TEAMS.map((team) => ({ key: team.key, label: team.label, match: (m: XtoolMember) => m.teams[team.key] === true })),
  { key: 'admin', label: '관리자', match: (m) => m.isAdmin },
]

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
  const [filter, setFilter] = useState<MemberFilter>('all')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const photoOf = usePhotoOf()
  // 비밀번호 재발급 — 한 번 더 눌러야 한다(쓰던 로그인이 끊기니까). 발급한 값은 위에 보여 준다.
  const [confirmingReset, setConfirmingReset] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null)

  useEffect(
    () =>
      // 목록이 바뀌어도 오류는 지우지 않는다 — 규칙에 막힌 쓰기는 되돌리는 스냅샷이 바로 따라와서, 여기서
      // 지우면 실패 문구가 보이자마자 사라진다(오류는 다음 작업을 시작할 때 run이 지운다).
      watchMembers(setMembers, (e) => setError(firestoreErrorMessage(e))),
    [],
  )


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

  // 확인 모달에서 "재발급"을 누르면
  const onResetPassword = (email: string) => {
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

  // 확인 모달에서 "삭제"를 누르면
  const onDelete = (email: string) => {
    setConfirming(null)
    void run(email, () => removeMember(email))
  }

  const nameOfMember = (email: string | null) => (members ?? []).find((m) => m.email === email)?.name || email || ''
  const needle = query.trim().toLowerCase()
  const inFilter = FILTERS.find((f) => f.key === filter)?.match ?? (() => true)
  const shown = (members ?? []).filter(
    (m) => inFilter(m) && (!needle || m.email.includes(needle) || m.name.toLowerCase().includes(needle)),
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
      <div className="admin-chips member-filter" role="group" aria-label="팀별로 보기">
        {FILTERS.map((f) => {
          const on = filter === f.key
          return (
            <button
              key={f.key}
              type="button"
              className={cx('admin-chip', on && 'is-on')}
              aria-pressed={on}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="member-filter__count">{(members ?? []).filter(f.match).length}</span>
            </button>
          )
        })}
      </div>
      <div className="table-wrap">
        <table className="table table--roomy">
          <thead>
            <tr>
              <th scope="col">구성원</th>
              <th scope="col">직책</th>
              <th scope="col">팀 페이지 권한</th>
              <th scope="col">관리자</th>
              <th scope="col">기술팀 담당</th>
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
                <td colSpan={8} className="table__empty">
                  {needle ? '검색 결과가 없어요.' : filter !== 'all' ? '이 팀에 등록된 구성원이 없어요.' : '아직 등록된 구성원이 없어요.'}
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
                      <Avatar initials={initialsOf(member.name, member.email)} color="rgba(255, 255, 255, 0.12)" photo={photoOf(member.name)} />
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
                    {/* 직책(사원~대표)과 그룹장·팀원 — tech 팀원 & 권한에 보인다. 그룹 역할은 고른 것을 다시 누르면 비운다. */}
                    <div className="member-role">
                      <select
                        className="log-select"
                        value={member.position ?? ''}
                        aria-label={`${member.name} 직책`}
                        disabled={busy}
                        onChange={(e) => {
                          const position = (e.target.value || null) as Position | null
                          void run(member.email, () => updateMember(member.email, { position }))
                        }}
                      >
                        <option value="">직책 미정</option>
                        {POSITIONS.map((position) => (
                          <option key={position.key} value={position.key}>
                            {position.label}
                          </option>
                        ))}
                      </select>
                      <div className="admin-chips">
                        {GROUP_ROLES.map((role) => {
                          const on = member.groupRole === role.key
                          return (
                            <button
                              key={role.key}
                              type="button"
                              className={cx('admin-chip', on && 'is-on')}
                              aria-pressed={on}
                              aria-label={`${member.name} ${role.label}`}
                              disabled={busy}
                              onClick={() =>
                                void run(member.email, () => updateMember(member.email, { groupRole: on ? null : role.key }))
                              }
                            >
                              {role.label}
                            </button>
                          )
                        })}
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
                    {/* 기술팀 담당영역 — 기술팀 팀원 화면(팀원 & 권한)에 보인다. 고른 것을 다시 누르면 비운다. */}
                    {member.teams.tech === true ? (
                      <div className="admin-chips">
                        {TECH_AREAS.map((area) => {
                          const on = member.techArea === area.key
                          return (
                            <button
                              key={area.key}
                              type="button"
                              className={cx('admin-chip', on && 'is-on')}
                              aria-pressed={on}
                              aria-label={`${member.name} 담당 ${area.label}`}
                              disabled={busy}
                              onClick={() =>
                                void run(member.email, () => updateMember(member.email, { techArea: on ? null : area.key }))
                              }
                            >
                              {area.label}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="table__muted">—</span>
                    )}
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
                          title="임시 비밀번호를 새로 만들어요 — 쓰던 기기의 로그인은 끊겨요"
                          aria-label={`${member.name} 비밀번호 재발급`}
                          onClick={() => setConfirmingReset(member.email)}
                        >
                          비밀번호 재발급
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
                          aria-label={`${member.name} 삭제`}
                          onClick={() => setConfirming(member.email)}
                        >
                          삭제
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
      <ConfirmDialog
        open={confirmingReset !== null}
        tone="primary"
        title={`${nameOfMember(confirmingReset)}님 비밀번호를 다시 발급할까요?`}
        message="새 임시 비밀번호를 만들어요. 지금 쓰던 비밀번호는 더 못 쓰고, 로그인돼 있던 기기에서도 로그아웃돼요."
        confirmLabel="재발급"
        onCancel={() => setConfirmingReset(null)}
        onConfirm={() => confirmingReset && onResetPassword(confirmingReset)}
      />
      <ConfirmDialog
        open={confirming !== null}
        title={`${nameOfMember(confirming)}님을 구성원에서 삭제할까요?`}
        message="팀 페이지에 더는 들어올 수 없어요. 다시 쓰게 하려면 새로 등록해야 해요."
        confirmLabel="삭제"
        onCancel={() => setConfirming(null)}
        onConfirm={() => confirming && onDelete(confirming)}
      />
    </GlassCard>
  )
}

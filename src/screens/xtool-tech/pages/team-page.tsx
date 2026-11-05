import { ScrollText, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { initialsOf } from '@/xtool-auth/use-xtool-session'
import { GROUP_ROLES, POSITIONS, TECH_AREAS, type XtoolMember } from '@/xtool-auth/members'
import { Avatar, Button, GlassCard, StatusPill } from '../components/layout-parts'
import { MemberLogPanel, MemberWorkPanel } from '../components/team/member-panels'
import { useCurrentMember } from '../context/member-context'
import { buildMyWork } from '../data/my-work'
import type { TechBoardKey } from '../data/tech-boards'
import { useTechMembers } from '../data/tech-members'
import { usePhotoOf } from '../data/tech-profiles'
import { useWorkSources } from '../data/use-my-work'
import { koreaToday } from '../lib/dates'
import { personColor } from '../lib/person-color'
import { useBoardItemParam } from '../lib/use-item-param'
import { BoardItemHost } from './boards/board-host'

// 관리자 화면(구성원 등록·권한·담당영역) — 팀원 등록과 담당영역은 거기서 정한다.
const ADMIN_PATH = '/admin/xtool'

const areaLabel = (member: XtoolMember) => TECH_AREAS.find((a) => a.key === member.techArea)?.label ?? null
const positionLabel = (member: XtoolMember) => POSITIONS.find((p) => p.key === member.position)?.label ?? null
const groupRoleLabel = (member: XtoolMember) => GROUP_ROLES.find((r) => r.key === member.groupRole)?.label ?? null

/**
 * 팀원 & 권한 — 관리자 화면에서 기술팀으로 등록한 활성 구성원. 직책(사원~대표·그룹장/팀원)과 담당영역(방문체험·AS)은
 * 관리자가 정하고, 상태는 지금
 * 맡은 업무(오늘 기준으로 끝나지 않은 담당 업무, 내 업무와 같은 계산)를 센다 — 누르면 그 업무 목록이 열리고, 목록의
 * 업무를 누르면 이 화면에서 그 항목 상세가 열린다. "로그"는 그 사람의 수정 기록(기술팀 모두 본다).
 */
export function TeamPage() {
  const navigate = useNavigate()
  const me = useCurrentMember()
  const isAdmin = me?.isAdmin === true
  const members = useTechMembers()
  const photoOf = usePhotoOf()
  const { sources, loading } = useWorkSources()
  const today = koreaToday()

  const rows = useMemo(() => [...(members ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [members])
  // 사람마다 지금 맡은 업무 — 담당자 칸의 이름으로 찾는다(내 업무와 같다)
  const workOf = useMemo(
    () => new Map(rows.map((m) => [m.email, buildMyWork(sources, new Set([m.name]), today)])),
    [rows, sources, today],
  )

  const [workFor, setWorkFor] = useState<XtoolMember | null>(null)
  const [logFor, setLogFor] = useState<XtoolMember | null>(null)
  // 업무 목록에서 고른 항목(?board·?item) — 상세는 닫히는 움직임이 끝날 때까지 그려 두려고 마지막에 연 보드를 들고 있는다.
  const [opened, closeItem] = useBoardItemParam()
  const [drawerBoard, setDrawerBoard] = useState<TechBoardKey | null>(opened?.boardKey ?? null)
  if (opened && opened.boardKey !== drawerBoard) setDrawerBoard(opened.boardKey)
  // 항목 상세가 열리면 업무 목록은 닫는다(모달이 겹치지 않게)
  const [openedKey, setOpenedKey] = useState(opened ? `${opened.boardKey}:${opened.itemId}` : null)
  const nextKey = opened ? `${opened.boardKey}:${opened.itemId}` : null
  if (nextKey !== openedKey) {
    setOpenedKey(nextKey)
    if (nextKey) setWorkFor(null)
  }

  return (
    <>
      <GlassCard
        title="팀원 & 권한"
        subtitle={
          members === null
            ? '불러오는 중…'
            : `기술팀 ${rows.length}명 — 등록과 담당영역은 관리자 화면에서 정해요`
        }
        actions={
          isAdmin ? (
            <Button size="sm" variant="ghost" icon={ShieldCheck} onClick={() => navigate(ADMIN_PATH)}>
              구성원 관리
            </Button>
          ) : undefined
        }
      >
        <div className="table-wrap">
          <table className="table table--roomy team-table">
            <thead>
              <tr>
                <th scope="col">프로필</th>
                <th scope="col">직책</th>
                <th scope="col">담당 영역</th>
                <th scope="col">상태</th>
                <th scope="col">작업</th>
              </tr>
            </thead>
            <tbody>
              {members !== null && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="table__empty">
                    기술팀으로 등록된 사람이 없어요.
                  </td>
                </tr>
              )}
              {rows.map((member) => {
                const items = workOf.get(member.email) ?? []
                const urgent = items.filter((i) => i.urgent).length
                const area = areaLabel(member)
                const position = positionLabel(member)
                const groupRole = groupRoleLabel(member)
                return (
                  <tr key={member.email}>
                    <td>
                      <div className="person">
                        <Avatar
                          initials={initialsOf(member.name, member.email)}
                          color={personColor(member.name)}
                          photo={photoOf(member.name)}
                        />
                        <div>
                          <p className="person__name">{member.name}</p>
                          <p className="person__sub">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      {position || groupRole ? (
                        <span className="team-position">
                          {position && <span className="team-area">{position}</span>}
                          {groupRole && (
                            <StatusPill tone={member.groupRole === 'lead' ? 'info' : 'neutral'}>{groupRole}</StatusPill>
                          )}
                        </span>
                      ) : (
                        <span className="table__muted">미정</span>
                      )}
                    </td>
                    <td>{area ? <span className="team-area">{area}</span> : <span className="table__muted">미정</span>}</td>
                    <td>
                      <button
                        type="button"
                        className="team-work"
                        aria-label={`${member.name} 지금 맡은 업무 ${items.length}건 보기`}
                        onClick={() => setWorkFor(member)}
                      >
                        {loading && items.length === 0 ? (
                          <StatusPill tone="neutral">불러오는 중</StatusPill>
                        ) : items.length === 0 ? (
                          <StatusPill tone="neutral">맡은 업무 없음</StatusPill>
                        ) : (
                          <StatusPill tone={urgent ? 'warn' : 'info'} dot>
                            {`진행 중 ${items.length}건${urgent ? ` · 임박·지남 ${urgent}` : ''}`}
                          </StatusPill>
                        )}
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={ScrollText}
                          aria-label={`${member.name} 수정 기록`}
                          onClick={() => setLogFor(member)}
                        >
                          로그
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <MemberWorkPanel
        member={workFor}
        items={workFor ? (workOf.get(workFor.email) ?? []) : []}
        onClose={() => setWorkFor(null)}
      />
      <MemberLogPanel member={logFor} onClose={() => setLogFor(null)} />
      {drawerBoard && (
        <BoardItemHost
          boardKey={drawerBoard}
          itemId={opened?.boardKey === drawerBoard ? opened.itemId : null}
          onClose={closeItem}
        />
      )}
    </>
  )
}

import { Plus } from 'lucide-react'
import { Avatar } from '../components/ui/avatar'
import { Button } from '../components/ui/button'
import { GlassCard } from '../components/ui/glass-card'
import { StatusPill } from '../components/ui/status-pill'
import { MEMBER_STATUS, TEAM } from '../data/team'

export function TeamPage() {
  const activeCount = TEAM.filter((m) => m.status === 'active').length
  return (
    <GlassCard
      title="팀원 & 권한 관리"
      subtitle={`전체 ${TEAM.length}명 · 활성 ${activeCount}명 — 관리자와 일반 멤버 계정`}
      actions={
        <Button icon={Plus} size="sm">
          팀원 초대
        </Button>
      }
    >
      <div className="table-wrap">
        <table className="table table--roomy">
          <thead>
            <tr>
              <th scope="col">프로필</th>
              <th scope="col">역할</th>
              <th scope="col">담당 영역</th>
              <th scope="col">상태</th>
              <th scope="col">작업</th>
            </tr>
          </thead>
          <tbody>
            {TEAM.map((member) => {
              const status = MEMBER_STATUS[member.status]
              return (
                <tr key={member.id}>
                  <td>
                    <div className="person">
                      <Avatar initials={member.initials} color={member.color} />
                      <div>
                        <p className="person__name">{member.name}</p>
                        <p className="person__sub">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table__strong">{member.role}</td>
                  <td>
                    <span className="link-text">{member.focus}</span>
                  </td>
                  <td>
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Button variant="ghost" size="sm" aria-label={`${member.name} 권한 변경`}>
                        권한 변경
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`${member.name} 활동 로그`}>
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
  )
}

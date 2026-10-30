import { DEPLOY_STATUS, type DeployRecord } from '../../data/overview'
import { memberById } from '../../data/team'
import { Avatar } from '../ui/avatar'
import { StatusPill } from '../ui/status-pill'

export function DeployTable({ rows }: { rows: readonly DeployRecord[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">담당자</th>
            <th scope="col">서비스</th>
            <th scope="col">브랜치 · 커밋</th>
            <th scope="col">상태</th>
            <th scope="col">시간</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((deploy) => {
            const author = memberById(deploy.authorId)
            const status = DEPLOY_STATUS[deploy.status]
            return (
              <tr key={deploy.id}>
                <td>
                  <div className="person">
                    <Avatar initials={author.initials} color={author.color} />
                    <div>
                      <p className="person__name">{author.name}</p>
                      <p className="person__sub">{deploy.id}</p>
                    </div>
                  </div>
                </td>
                <td className="table__strong">{deploy.service}</td>
                <td className="table__mono">{deploy.ref}</td>
                <td>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </td>
                <td className="table__muted">{deploy.time}</td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="table__empty">
                이 상태의 배포가 없어요
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

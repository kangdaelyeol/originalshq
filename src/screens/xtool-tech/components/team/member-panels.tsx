import { X } from 'lucide-react'
import { useId } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { XtoolMember } from '@xtool-core/members'
import type { MyWorkItem } from '@xtool-core/my-work'
import { useMemberEditLogs, type TechEditLog } from '@xtool-core/tech-edit-logs'
import { koreaToday } from '@xtool-core/dates'
import { boardItemSearch } from '../../lib/use-item-param'
import { DrawerShell } from '../layout-parts'
import { MyWorkRow } from '../overview/my-work-card'

// 팀원 화면(팀원 & 권한)의 가운데 모달 두 개 — 지금 맡은 업무, 수정 기록. 껍데기는 레이아웃 부품이라 물이면 물로 나온다.

interface PanelProps {
  /** 연 사람 — null이면 닫힌다 */
  member: XtoolMember | null
  onClose: () => void
}

function PanelHead({ titleId, eyebrow, title, onClose }: { titleId: string; eyebrow: string; title: string; onClose: () => void }) {
  return (
    <header className="drawer__header">
      <div className="drawer__heading">
        <p className="drawer__eyebrow">{eyebrow}</p>
        <h2 id={titleId} className="drawer__title">
          {title}
        </h2>
      </div>
      <button type="button" className="icon-button" aria-label="닫기" onClick={onClose}>
        <X size={16} aria-hidden />
      </button>
    </header>
  )
}

/** 지금 맡은 업무 — 오늘 기준으로 끝나지 않은 담당 업무(내 업무와 같은 계산). 줄을 누르면 이 화면에서 그 항목 서랍이 열린다. */
export function MemberWorkPanel({ member, items, onClose }: PanelProps & { items: readonly MyWorkItem[] }) {
  const titleId = useId()
  const [params] = useSearchParams()
  const today = koreaToday()
  return (
    <DrawerShell
      open={member !== null}
      onClose={onClose}
      labelledBy={titleId}
      contentKey={member?.email}
      placement="center"
    >
      {member && (
        <>
          <PanelHead titleId={titleId} eyebrow={`지금 맡은 업무 ${items.length}건`} title={member.name} onClose={onClose} />
          <div className="drawer__body">
            {items.length === 0 ? (
              <p className="bar-list__empty">진행 중인 업무가 없어요.</p>
            ) : (
              <ul className="my-work__list">
                {items.map((item) => (
                  <MyWorkRow
                    key={`${item.boardKey}:${item.itemId}`}
                    item={item}
                    today={today}
                    to={boardItemSearch(params, item)}
                    replace
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </DrawerShell>
  )
}

const ACTION_LABEL: Record<TechEditLog['action'], string> = { update: '수정', create: '새로 만듦', delete: '삭제' }

const stamp = (ms: number) =>
  new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/** 수정 기록 — 그 사람이 tech 화면에서 바꾼 것(최근 기록에서 거른다). 기술팀 모두 읽는다. */
export function MemberLogPanel({ member, onClose }: PanelProps) {
  const titleId = useId()
  const { logs, error } = useMemberEditLogs(member?.email ?? null)
  return (
    <DrawerShell
      open={member !== null}
      onClose={onClose}
      labelledBy={titleId}
      contentKey={member?.email}
      placement="center"
    >
      {member && (
        <>
          <PanelHead
            titleId={titleId}
            eyebrow={logs ? `수정 기록 ${logs.length}건` : '수정 기록'}
            title={member.name}
            onClose={onClose}
          />
          <div className="drawer__body">
            {error ? (
              <p className="bar-list__empty">기록을 읽지 못했어요 — {error}</p>
            ) : !logs ? (
              <p className="bar-list__empty">불러오는 중…</p>
            ) : logs.length === 0 ? (
              <p className="bar-list__empty">최근 수정 기록이 없어요.</p>
            ) : (
              <ol className="member-logs">
                {logs.map((log) => (
                  <li key={log.id} className="member-log">
                    <p className="member-log__head">
                      <time dateTime={new Date(log.at).toISOString()}>{stamp(log.at)}</time>
                      <span className="member-log__action">{ACTION_LABEL[log.action] ?? log.action}</span>
                      {!log.ok && <span className="member-log__fail">실패</span>}
                    </p>
                    <p className="member-log__item">
                      {log.boardName} · {log.itemName || '(이름 없음)'}
                    </p>
                    {log.changes?.length > 0 && (
                      <ul className="member-log__changes">
                        {log.changes.map((change, i) => (
                          <li key={`${change.field}:${i}`}>
                            <span className="member-log__field">{change.title}</span>
                            {change.before ?? '—'} → {change.after ?? '—'}
                          </li>
                        ))}
                      </ul>
                    )}
                    {log.error && <p className="member-log__error">{log.error}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </DrawerShell>
  )
}

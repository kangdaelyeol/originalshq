import { Clock, Ellipsis, Flag, MessageSquare } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { cx } from '../../../lib/cx'
import { AvatarStack } from './avatar'
import { dueLabel, type D15Task } from './design15-data'

interface TaskCardProps {
  task: D15Task
  /** 끄는 동안 원래 자리에 남는 흐린 모습(F270 불투명도 0.35) */
  ghost?: boolean
  /** 들려 있는 모습(1.03배·2°·그림자) — 끄는 층에서만 */
  lifted?: boolean
  /** 놓는 중이라 잠깐 숨김(떠 있는 카드가 이 자리로 날아온다) */
  landing?: boolean
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void
}

/**
 * 할 일 카드(F330 103×53.5px) — 분야 꼬리표·우선순위 깃발·…·제목·진행 막대·마감·댓글·사람.
 * 끝남 기둥에서는 막대가 가득 차고 마감이 날짜로 바뀐다("In 6 days" → "Oct 15").
 */
export function TaskCard({ task, ghost, lifted, landing, onPointerDown }: TaskCardProps) {
  const progress = task.stage === 'done' ? 1 : task.progress
  return (
    <article
      className={cx('d15-task', ghost && 'is-ghost', lifted && 'is-lifted', landing && 'is-landing')}
      data-task={task.id}
      onPointerDown={onPointerDown}
    >
      <header className="d15-task__head">
        <span className={cx('d15-task__tag', `is-${task.tag.toLowerCase()}`)}>{task.tag}</span>
        <span className={cx('d15-task__prio', `is-${task.priority.toLowerCase()}`)}>
          <Flag aria-hidden strokeWidth={2} />
          {task.priority}
        </span>
        <button
          type="button"
          className="d15-task__menu"
          aria-label="Move task"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Ellipsis aria-hidden strokeWidth={2.4} />
        </button>
      </header>
      <h4 className="d15-task__title">{task.title}</h4>
      <span className="d15-task__bar">
        <i style={{ width: `${progress * 100}%` }} />
      </span>
      <footer className="d15-task__foot">
        <span className="d15-task__meta">
          <Clock aria-hidden strokeWidth={2} />
          {dueLabel(task)}
        </span>
        <span className="d15-task__meta">
          <MessageSquare aria-hidden strokeWidth={2} />
          {task.comments}
        </span>
        <AvatarStack people={task.people} />
      </footer>
    </article>
  )
}

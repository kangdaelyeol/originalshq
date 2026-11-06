import { Plus } from 'lucide-react'
import { useState } from 'react'
import { KanbanBoard } from './kanban-board'
import { D15_PAGE_HEAD, D15_TASK_FILTERS, type D15Stage, type D15Task, type D15TaskFilter } from './design15-data'
import { PageHead } from './page-head'
import { PillTabs } from './pill-tabs'

interface TasksPageProps {
  tasks: readonly D15Task[]
  onMove: (id: string, stage: D15Stage) => void
}

const MATCH: Record<D15TaskFilter, (t: D15Task) => boolean> = {
  All: () => true,
  'My tasks': (t) => !!t.mine,
  'High priority': (t) => t.priority === 'High',
  'Due this week': (t) => t.stage !== 'done' && t.dueIn <= 7,
}

/** Tasks(F250·F330) — 거르기 알약·"13 tasks shown"·네 기둥 칸반 */
export function TasksPage({ tasks, onMove }: TasksPageProps) {
  const [filter, setFilter] = useState<D15TaskFilter>('All')
  const match = MATCH[filter]
  const shown = tasks.filter(match).length
  const head = D15_PAGE_HEAD.tasks
  return (
    <div className="d15-tasks">
      <PageHead
        title={head.title}
        sub={head.sub}
        actions={
          <button type="button" className="d15-btn d15-btn--solid">
            <Plus aria-hidden strokeWidth={2.4} />
            New Task
          </button>
        }
      />
      <div className="d15-toolbar d15-rise">
        <PillTabs
          options={D15_TASK_FILTERS}
          value={filter}
          onChange={setFilter}
          tourId="task-filter"
          label="Filter tasks"
        />
        <p className="d15-toolbar__note">
          <b>{shown}</b> tasks shown
        </p>
      </div>
      <KanbanBoard tasks={tasks} visible={match} onMove={onMove} />
    </div>
  )
}

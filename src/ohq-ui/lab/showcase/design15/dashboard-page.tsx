import { Plus, Upload } from 'lucide-react'
import { D15_COLLAB, D15_PAGE_HEAD, D15_REMINDER, D15_WEEK_BARS, type D15Project } from './design15-data'
import { PageHead } from './page-head'
import { ProgressGauge } from './progress-gauge'
import { ProjectList } from './project-list'
import { ReminderCard } from './reminder-card'
import { StatCard } from './stat-card'
import { TeamCollab } from './team-collab'
import { TimeTracker } from './time-tracker'
import type { TrackerClock } from './tracker-clock'
import { WeekBars } from './week-bars'

export interface D15Stats {
  ended: number
  running: number
  pending: number
}

interface DashboardPageProps {
  stats: D15Stats
  projects: readonly (D15Project & { fresh?: boolean })[]
  clock: TrackerClock
  onAddProject: () => void
}

/**
 * Dashboard — 숫자 넷(Total = 셋의 합)·막대·알림·프로젝트·시간 기록·팀·반원. 카드 열 장이 52ms씩
 * Total → Ended → Running → Pending → 막대 → 알림 → 프로젝트 → 시간 기록 → 팀 → 반원 차례로 떠오른다(F861~F889).
 */
export function DashboardPage({ stats, projects, clock, onAddProject }: DashboardPageProps) {
  const total = stats.ended + stats.running + stats.pending
  const head = D15_PAGE_HEAD.dashboard
  return (
    <div className="d15-dash">
      <PageHead
        title={head.title}
        sub={head.sub}
        actions={
          <>
            <button type="button" className="d15-btn d15-btn--solid" onClick={onAddProject} data-tour="add-project">
              <Plus aria-hidden strokeWidth={2.4} />
              Add Project
            </button>
            <button type="button" className="d15-btn d15-btn--ghost">
              <Upload aria-hidden strokeWidth={2.2} />
              Import Data
            </button>
          </>
        }
      />
      <div className="d15-dash__grid">
        <StatCard highlight title="Total Projects" value={total} note="Increased from last month" index={0} />
        <StatCard title="Ended Projects" value={stats.ended} note="Increased from last month" index={1} />
        <StatCard title="Running Projects" value={stats.running} note="Increased from last month" index={2} />
        <StatCard title="Pending Projects" value={stats.pending} note="Awaiting review" noteTone="review" index={3} />
        <WeekBars bars={D15_WEEK_BARS} index={4} />
        <ReminderCard title={D15_REMINDER.title} time={D15_REMINDER.time} index={5} />
        <div className="d15-dash__side">
          <ProjectList projects={projects} onNew={onAddProject} index={6} />
          <TimeTracker clock={clock} index={7} />
        </div>
        <div className="d15-dash__low">
          <TeamCollab rows={D15_COLLAB} index={8} />
          <ProgressGauge completed={stats.ended / total} inProgress={stats.running / total} index={9} />
        </div>
      </div>
    </div>
  )
}

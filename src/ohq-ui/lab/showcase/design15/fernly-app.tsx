import { useCallback, useEffect, useRef, useState } from 'react'
import { cx } from '../../../lib/cx'
import { AnalyticsPage } from './analytics-page'
import { AppSidebar } from './app-sidebar'
import { AppTopbar } from './app-topbar'
import { CalendarPage } from './calendar-page'
import { DashboardPage, type D15Stats } from './dashboard-page'
import { cssVars } from './d15-format'
import { PAGE_SWAP_MS } from './d15-motion'
import {
  accentByKey,
  D15_BASE_STATS,
  D15_MEMBERS,
  D15_PROJECTS,
  D15_TASKS,
  D15_TRACKER_START,
  type D15AccentKey,
  type D15Page,
  type D15Project,
  type D15Stage,
  type D15Task,
} from './design15-data'
import { NewProjectModal } from './new-project-modal'
import { ProfileDrawer } from './profile-drawer'
import { SettingsPage } from './settings-page'
import { TasksPage } from './tasks-page'
import { TeamPage } from './team-page'
import { Toast } from './toast'
import { TrackerClock } from './tracker-clock'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "10/23/2026" → "Oct 23, 2026"(목록 글) */
function dueText(input: string) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim())
  if (!m) return input
  return `${MONTHS[Math.min(11, Math.max(0, Number(m[1]) - 1))]} ${Number(m[2])}, ${m[3]}`
}

interface FernlyAppProps {
  /** 처음 강조색(설정에서 바꾼다) */
  initialAccent?: D15AccentKey
}

/**
 * Fernly 앱 한 벌 — 사이드바·위 막대·여섯 쪽·새 프로젝트 창·프로필 서랍·알림. 강조색은 창 뿌리의 CSS 변수
 * 다섯(--d15-accent·soft·deep·ink·tint, @property 등록)이라 0.2초에 앱 전체가 다시 칠해진다.
 * 쪽을 누르면 옛 쪽이 0.12초에 사라지고 0.18초 뒤 새 쪽이 붙는다(카드는 그때부터 52ms씩 떠오른다).
 */
export function FernlyApp({ initialAccent = 'ocean' }: FernlyAppProps) {
  const [page, setPage] = useState<D15Page>('dashboard')
  const [navPage, setNavPage] = useState<D15Page>('dashboard')
  const [leaving, setLeaving] = useState(false)
  const [accent, setAccent] = useState<D15AccentKey>(initialAccent)
  const [stats, setStats] = useState<D15Stats>(D15_BASE_STATS)
  const [projects, setProjects] = useState<(D15Project & { fresh?: boolean })[]>(() => [...D15_PROJECTS])
  const [tasks, setTasks] = useState<D15Task[]>(() => [...D15_TASKS])
  const [weekStart, setWeekStart] = useState<0 | 1>(0)
  const [modal, setModal] = useState(false)
  const [profile, setProfile] = useState<string | null>(null)
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
  const [clock] = useState(() => new TrackerClock(D15_TRACKER_START))
  const swap = useRef(0)
  const toastSeq = useRef(0)

  useEffect(() => () => window.clearTimeout(swap.current), [])
  useEffect(() => () => clock.pause(), [clock])

  const go = (next: D15Page) => {
    if (next === navPage) return
    setNavPage(next)
    setLeaving(true)
    window.clearTimeout(swap.current)
    swap.current = window.setTimeout(() => {
      setPage(next)
      setLeaving(false)
    }, PAGE_SWAP_MS)
  }

  const say = (text: string) => {
    toastSeq.current += 1
    setToast({ id: toastSeq.current, text })
  }
  const clearToast = useCallback(() => setToast(null), [])
  const closeModal = useCallback(() => setModal(false), [])
  const closeProfile = useCallback(() => setProfile(null), [])

  const createProject = (name: string, due: string) => {
    setModal(false)
    setProjects((list) => [
      ...list.map((p) => ({ ...p, fresh: false })),
      { id: `new-${list.length}`, name, due: dueText(due), icon: 'dot', fresh: true },
    ])
    setStats((s) => ({ ...s, pending: s.pending + 1 }))
    say(`“${name}” added to projects`)
  }

  const moveTask = (id: string, stage: D15Stage) =>
    setTasks((list) => {
      const task = list.find((t) => t.id === id)
      if (!task) return list
      return [{ ...task, stage }, ...list.filter((t) => t.id !== id)]
    })

  const pickAccent = (key: D15AccentKey) => {
    if (key === accent) return
    setAccent(key)
    say(`Accent set to ${accentByKey(key).name}`)
  }

  const a = accentByKey(accent)
  const member = profile ? D15_MEMBERS.find((m) => m.id === profile) : undefined

  let view
  switch (page) {
    case 'tasks':
      view = <TasksPage tasks={tasks} onMove={moveTask} />
      break
    case 'calendar':
      view = <CalendarPage weekStart={weekStart} />
      break
    case 'analytics':
      view = <AnalyticsPage />
      break
    case 'team':
      view = <TeamPage onProfile={setProfile} />
      break
    case 'settings':
      view = <SettingsPage accent={accent} onAccent={pickAccent} weekStart={weekStart} onWeekStart={setWeekStart} />
      break
    default:
      view = <DashboardPage stats={stats} projects={projects} clock={clock} onAddProject={() => setModal(true)} />
  }

  return (
    <div
      className="d15-app"
      lang="en"
      style={cssVars({
        '--d15-accent': a.accent,
        '--d15-accent-soft': a.soft,
        '--d15-accent-deep': a.deep,
        '--d15-accent-ink': a.ink,
        '--d15-accent-tint': a.tint,
      })}
    >
      <AppSidebar page={navPage} onNavigate={go} openTasks={tasks.filter((t) => t.stage !== 'done').length} />
      <AppTopbar page={navPage} />
      <main className="d15-main">
        <div key={page} className={cx('d15-page', `is-${page}`, leaving && 'is-leaving')}>
          {view}
        </div>
      </main>
      {modal && <NewProjectModal onClose={closeModal} onCreate={createProject} />}
      {member && (
        <ProfileDrawer
          key={member.id}
          member={member}
          tasks={tasks.filter((t) => t.people.includes(member.initials))}
          onClosed={closeProfile}
        />
      )}
      {toast && <Toast key={toast.id} text={toast.text} onDone={clearToast} />}
    </div>
  )
}

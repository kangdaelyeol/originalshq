// D15 데이터 — sample/design15-pm.mp4(Fernly 프로젝트 관리 앱)에 보인 글·숫자 그대로. 영상에 잘리거나 안 보인 곳은
// 같은 결로 채웠다(주석에 "채움"). F는 영상 프레임(30fps, F0 = 0초).

export type D15Page = 'dashboard' | 'tasks' | 'calendar' | 'analytics' | 'team' | 'settings'

// ── 강조색 ──────────────────────────────────────────────────────────────────
// Ocean·Plum은 F205·F899 같은 자리에서 잰 값, 칩 위/아래는 F790 확대 화면의 견본 칩. Forest·Ember는 칩만 보여서
// 같은 비율(칩 위 = 강조색 × 0.83, 밝은 색 = 같은 색상 l+27)로 채웠다.
export type D15AccentKey = 'forest' | 'ocean' | 'plum' | 'ember'

export interface D15Accent {
  key: D15AccentKey
  name: string
  /** 견본 칩 위/아래(세로 그라데이션) */
  chip: readonly [string, string]
  /** 막대 M·완료 호·활성 알약 (Ocean 28,76,165) */
  accent: string
  /** 막대 T(옅은) (103,152,230) */
  soft: string
  /** 막대 W·진행 호·글 강조 (12,39,89) */
  deep: string
  /** 시간 기록 카드 바탕 (8,24,54) */
  ink: string
  /** 옅은 바탕(사이드바 활성·끌어 놓을 기둥) */
  tint: string
}

export const D15_ACCENTS: readonly D15Accent[] = [
  {
    key: 'forest',
    name: 'Forest',
    chip: ['#0c482a', '#083c25'],
    accent: '#17663f',
    soft: '#74c79a',
    deep: '#0b3a22',
    ink: '#071f14',
    tint: '#e3f0e8',
  },
  {
    key: 'ocean',
    name: 'Ocean',
    chip: ['#163f8a', '#113473'],
    accent: '#1c4ca5',
    soft: '#6798e6',
    deep: '#0c2759',
    ink: '#081836',
    tint: '#e3eaf6',
  },
  {
    key: 'plum',
    name: 'Plum',
    chip: ['#583192', '#412673'],
    accent: '#653dab',
    soft: '#a789df',
    deep: '#301550',
    ink: '#1b0e30',
    tint: '#ece6f6',
  },
  {
    key: 'ember',
    name: 'Ember',
    chip: ['#963c17', '#7c3113'],
    accent: '#b0481c',
    soft: '#f0a17c',
    deep: '#5e240c',
    ink: '#2e1206',
    tint: '#f7e9e2',
  },
]

export const accentByKey = (key: D15AccentKey) => D15_ACCENTS.find((a) => a.key === key) ?? D15_ACCENTS[1]

// ── 앱 뼈대 ─────────────────────────────────────────────────────────────────
export type D15NavIcon = 'grid' | 'tasks' | 'calendar' | 'analytics' | 'team' | 'settings' | 'help' | 'logout'

export interface D15NavItem {
  page: D15Page | null
  label: string
  icon: D15NavIcon
}

export const D15_NAV_MENU: readonly D15NavItem[] = [
  { page: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { page: 'tasks', label: 'Tasks', icon: 'tasks' },
  { page: 'calendar', label: 'Calendar', icon: 'calendar' },
  { page: 'analytics', label: 'Analytics', icon: 'analytics' },
  { page: 'team', label: 'Team', icon: 'team' },
]

export const D15_NAV_GENERAL: readonly D15NavItem[] = [
  { page: 'settings', label: 'Settings', icon: 'settings' },
  { page: null, label: 'Help', icon: 'help' },
  { page: null, label: 'Logout', icon: 'logout' },
]

export const D15_USER = { name: 'Noah Castell', email: 'noah@fernly.app', initials: 'NC' }

export const D15_PAGE_HEAD: Record<D15Page, { title: string; sub: string }> = {
  dashboard: { title: 'Dashboard', sub: 'Everything your team is shipping, in one calm place.' },
  tasks: { title: 'Tasks', sub: 'Drag a card to another stage, or use its menu to move it.' },
  calendar: { title: 'Calendar', sub: 'Meetings, reviews and deadlines across the team.' },
  analytics: { title: 'Analytics', sub: 'How the team is shipping, and where the time goes.' },
  team: { title: 'Team', sub: 'Everyone on the workspace, what they’re carrying and who’s around.' },
  settings: { title: 'Settings', sub: 'Your profile, notifications and how Fernly looks.' },
}

// ── 사람 ────────────────────────────────────────────────────────────────────
export type D15Dept = 'Engineering' | 'Design' | 'Marketing' | 'Management'
export type D15Presence = 'online' | 'away' | 'offline'

export interface D15Member {
  id: string
  initials: string
  name: string
  role: string
  dept: D15Dept
  presence: D15Presence
  open: number
  completed: number
  /** 일 부담 % — 85 이상이면 호박색 막대(Mateo 88%) */
  workload: number
  /** 머리 동그라미 바탕(파스텔) */
  tint: string
  /** 프로필 서랍의 장소 — Priya(Lisbon)만 영상에 보였다(나머지 채움) */
  location: string
}

// F358 팀 화면: 8명, 초록 점 5명(= "5 online now"). Owen의 숫자는 자막에 가려 F346에서 읽었다.
export const D15_MEMBERS: readonly D15Member[] = [
  {
    id: 'nc',
    initials: 'NC',
    name: 'Noah Castell',
    role: 'Project Lead',
    dept: 'Management',
    presence: 'online',
    open: 0,
    completed: 48,
    workload: 64,
    tint: '#f1d2c4',
    location: 'Toronto',
  },
  {
    id: 'pr',
    initials: 'PR',
    name: 'Priya Raman',
    role: 'Product Designer',
    dept: 'Design',
    presence: 'online',
    open: 1,
    completed: 39,
    workload: 72,
    tint: '#f3cfca',
    location: 'Lisbon',
  },
  {
    id: 'ms',
    initials: 'MS',
    name: 'Mateo Silva',
    role: 'Backend Engineer',
    dept: 'Engineering',
    presence: 'online',
    open: 2,
    completed: 51,
    workload: 88,
    tint: '#cfe6d2',
    location: 'Porto',
  },
  {
    id: 'hk',
    initials: 'HK',
    name: 'Hana Kobayashi',
    role: 'Frontend Engineer',
    dept: 'Engineering',
    presence: 'away',
    open: 1,
    completed: 33,
    workload: 56,
    tint: '#d3d7f1',
    location: 'Osaka',
  },
  {
    id: 'om',
    initials: 'OM',
    name: 'Owen Mercer',
    role: 'Frontend Engineer',
    dept: 'Engineering',
    presence: 'online',
    open: 2,
    completed: 42,
    workload: 79,
    tint: '#f1dfb7',
    location: 'Dublin',
  },
  {
    id: 'ss',
    initials: 'SS',
    name: 'Sofia Sato',
    role: 'QA Engineer',
    dept: 'Engineering',
    presence: 'offline',
    open: 1,
    completed: 27,
    workload: 41,
    tint: '#e3d3f1',
    location: 'Kyoto',
  },
  {
    id: 'mk',
    initials: 'MK',
    name: 'Maya Kovac',
    role: 'Brand Designer',
    dept: 'Design',
    presence: 'away',
    open: 2,
    completed: 24,
    workload: 50,
    tint: '#cfe9ec',
    location: 'Zagreb',
  },
  {
    id: 'lr',
    initials: 'LR',
    name: 'Liam Reyes',
    role: 'Marketing Lead',
    dept: 'Marketing',
    presence: 'online',
    open: 1,
    completed: 30,
    workload: 67,
    tint: '#f6dcc4',
    location: 'Austin',
  },
]

export const memberByInitials = (initials: string) => D15_MEMBERS.find((m) => m.initials === initials)

export const D15_TEAM_FILTERS = ['All', 'Engineering', 'Design', 'Marketing', 'Management'] as const
export type D15TeamFilter = (typeof D15_TEAM_FILTERS)[number]

// ── 대시보드 ────────────────────────────────────────────────────────────────
/** 숫자 칸 바탕 — Total = Ended + Running + Pending(24 = 10+12+2). 프로젝트를 더하면 Pending이 하나 는다(F92 25·3). */
export const D15_BASE_STATS = { ended: 10, running: 12, pending: 2 }

export type D15ProjectIcon = 'stripes' | 'pie' | 'plus' | 'sun' | 'atoms' | 'dot'

export interface D15Project {
  id: string
  name: string
  due: string
  icon: D15ProjectIcon
}

export const D15_PROJECTS: readonly D15Project[] = [
  { id: 'payments', name: 'Payments API v2', due: 'Oct 8, 2026', icon: 'stripes' },
  { id: 'mobile', name: 'Mobile Onboarding', due: 'Oct 12, 2026', icon: 'pie' },
  { id: 'dsa', name: 'Design System Audit', due: 'Oct 15, 2026', icon: 'plus' },
  { id: 'search', name: 'Search Revamp', due: 'Oct 20, 2026', icon: 'sun' },
  { id: 'q4', name: 'Q4 Launch Site', due: 'Oct 22, 2026', icon: 'atoms' },
]

/** F48~F68에 친 이름·미리 채워진 날짜(10/23/2026) */
export const D15_NEW_PROJECT = { name: 'Payment Gateway', due: '2026-10-23' }

export type D15CollabStatus = 'Completed' | 'In Progress' | 'Pending'

export const D15_COLLAB: readonly { member: string; task: string; status: D15CollabStatus }[] = [
  { member: 'PR', task: 'Design System Tokens', status: 'Completed' },
  { member: 'MS', task: 'Passkey Sign-in', status: 'In Progress' },
  { member: 'HK', task: 'Saved Filters for Projects', status: 'Pending' },
  { member: 'OM', task: 'Marketing Site Refresh', status: 'In Progress' },
]

export type D15BarTone = 'hatch' | 'accent' | 'soft' | 'deep'

/** Project Analytics 막대 — 높이는 F41에서 잰 값(바닥 y243.5, T 74%가 47.5px → 100% = 64.2px) */
export const D15_WEEK_BARS: readonly { day: string; value: number; tone: D15BarTone }[] = [
  { day: 'S', value: 65, tone: 'hatch' },
  { day: 'M', value: 90, tone: 'accent' },
  { day: 'T', value: 74, tone: 'soft' },
  { day: 'W', value: 99, tone: 'deep' },
  { day: 'T', value: 100, tone: 'hatch' },
  { day: 'F', value: 71, tone: 'hatch' },
  { day: 'S', value: 90, tone: 'hatch' },
]

export const D15_REMINDER = { title: 'Check-in with Halcyon Labs', time: 'Time : 02.00 pm - 04.00 pm' }

/** 시간 기록 — F41에 01:24:08, 멈춘 채. 재생하면 0.6초 뒤 첫 칸(F149 누름 → F167 09) */
export const D15_TRACKER_START = 1 * 3600 + 24 * 60 + 8.4

// ── 할 일 ───────────────────────────────────────────────────────────────────
export type D15Stage = 'todo' | 'progress' | 'review' | 'done'
export type D15Tag = 'Backend' | 'Frontend' | 'Design' | 'Marketing' | 'QA'
export type D15Priority = 'Low' | 'Medium' | 'High'

export interface D15Task {
  id: string
  title: string
  tag: D15Tag
  priority: D15Priority
  stage: D15Stage
  /** 진행 막대(0~1) — 끝남 기둥에서는 늘 가득 */
  progress: number
  /** 남은 날(오늘 Oct 9 기준) — 0이면 Tomorrow가 아니라 오늘, 끝남 기둥은 날짜(dueDate)로 */
  dueIn: number
  dueDate: string
  comments: number
  people: readonly string[]
  mine?: boolean
}

export const D15_STAGES: readonly { id: D15Stage; name: string }[] = [
  { id: 'todo', name: 'To do' },
  { id: 'progress', name: 'In progress' },
  { id: 'review', name: 'In review' },
  { id: 'done', name: 'Done' },
]

// F254(끌기 전) 차례. F330(끈 뒤): "Saved filters for projects"가 Done 맨 위로.
export const D15_TASKS: readonly D15Task[] = [
  {
    id: 't-saved',
    title: 'Saved filters for projects',
    tag: 'Frontend',
    priority: 'Medium',
    stage: 'todo',
    progress: 0,
    dueIn: 6,
    dueDate: 'Oct 15',
    comments: 2,
    people: ['HK'],
  },
  {
    id: 't-api',
    title: 'Write API endpoint docs',
    tag: 'Backend',
    priority: 'Low',
    stage: 'todo',
    progress: 0,
    dueIn: 9,
    dueDate: 'Oct 18',
    comments: 1,
    people: ['MS'],
  },
  {
    id: 't-onb',
    title: 'Onboarding email sequence',
    tag: 'Marketing',
    priority: 'Low',
    stage: 'todo',
    progress: 0,
    dueIn: 12,
    dueDate: 'Oct 21',
    comments: 0,
    people: ['LR', 'NB'],
  },
  {
    id: 't-lcp',
    title: 'Cut LCP under 2 seconds',
    tag: 'Frontend',
    priority: 'High',
    stage: 'todo',
    progress: 0,
    dueIn: 5,
    dueDate: 'Oct 14',
    comments: 3,
    people: ['OM'],
    mine: true,
  },
  {
    id: 't-login',
    title: 'Design login & sign-up screens',
    tag: 'Design',
    priority: 'High',
    stage: 'progress',
    progress: 0.6,
    dueIn: 2,
    dueDate: 'Oct 11',
    comments: 4,
    people: ['PR', 'MK'],
  },
  {
    id: 't-pass',
    title: 'Passkey sign-in',
    tag: 'Backend',
    priority: 'High',
    stage: 'progress',
    progress: 0.45,
    dueIn: 3,
    dueDate: 'Oct 12',
    comments: 7,
    people: ['MS'],
  },
  {
    id: 't-site',
    title: 'Marketing site refresh',
    tag: 'Frontend',
    priority: 'Medium',
    stage: 'progress',
    progress: 0.7,
    dueIn: 4,
    dueDate: 'Oct 13',
    comments: 3,
    people: ['OM', 'HK'],
    mine: true,
  },
  {
    id: 't-q4',
    title: 'Q4 launch announcement',
    tag: 'Marketing',
    priority: 'Medium',
    stage: 'progress',
    progress: 0.3,
    dueIn: 8,
    dueDate: 'Oct 17',
    comments: 1,
    people: ['NB'],
  },
  {
    id: 't-safari',
    title: 'Safari & Firefox regression pass',
    tag: 'QA',
    priority: 'Medium',
    stage: 'review',
    progress: 0.9,
    dueIn: 1,
    dueDate: 'Oct 10',
    comments: 5,
    people: ['SS'],
  },
  {
    id: 't-brand',
    title: 'Brand illustration set',
    tag: 'Design',
    priority: 'Medium',
    stage: 'review',
    progress: 0.85,
    dueIn: 2,
    dueDate: 'Oct 11',
    comments: 6,
    people: ['MK'],
  },
  {
    id: 't-mono',
    title: 'Monorepo cleanup',
    tag: 'Backend',
    priority: 'Low',
    stage: 'done',
    progress: 1,
    dueIn: -2,
    dueDate: 'Oct 7',
    comments: 2,
    people: ['PR'],
  },
  {
    id: 't-widgets',
    title: 'Dashboard analytics widgets',
    tag: 'Frontend',
    priority: 'High',
    stage: 'done',
    progress: 1,
    dueIn: -1,
    dueDate: 'Oct 8',
    comments: 9,
    people: ['HK', 'PR'],
  },
  {
    id: 't-kick',
    title: 'Kickoff with Halcyon Labs',
    tag: 'Marketing',
    priority: 'Medium',
    stage: 'done',
    progress: 1,
    dueIn: -3,
    dueDate: 'Oct 6',
    comments: 4,
    people: ['NC', 'LR'],
    mine: true,
  },
]

export const D15_TASK_FILTERS = ['All', 'My tasks', 'High priority', 'Due this week'] as const
export type D15TaskFilter = (typeof D15_TASK_FILTERS)[number]

export const dueLabel = (task: D15Task) =>
  task.stage === 'done'
    ? task.dueDate
    : task.dueIn <= 0
      ? 'Today'
      : task.dueIn === 1
        ? 'Tomorrow'
        : `In ${task.dueIn} days`

/** 프로필 서랍의 "Assigned tasks" 상태 글 */
export const STAGE_STATUS: Record<D15Stage, string> = {
  todo: 'To do',
  progress: 'In progress',
  review: 'In review',
  done: 'Done',
}

// ── 달력 ────────────────────────────────────────────────────────────────────
export type D15EventKind = 'meeting' | 'team' | 'review' | 'deadline' | 'social'

export const D15_EVENT_KINDS: readonly { kind: D15EventKind; label: string }[] = [
  { kind: 'meeting', label: 'Meeting' },
  { kind: 'team', label: 'Team' },
  { kind: 'review', label: 'Review' },
  { kind: 'deadline', label: 'Deadline' },
  { kind: 'social', label: 'Social' },
]

/** 오늘 — 2026-10-09(금) */
export const D15_TODAY = { y: 2026, m: 9, d: 9 }

// F545 10월 칸의 일정(칸 너비에 잘린 글은 같은 결로 채움). 11월은 영상(F505)처럼 비어 있다.
export const D15_EVENTS: readonly { date: string; title: string; kind: D15EventKind }[] = [
  { date: '2026-10-03', title: 'Design sprint', kind: 'team' },
  { date: '2026-10-06', title: 'Halcyon Labs kickoff', kind: 'meeting' },
  { date: '2026-10-07', title: 'Monorepo cleanup review', kind: 'review' },
  { date: '2026-10-09', title: 'Daily stand-up', kind: 'team' },
  { date: '2026-10-09', title: 'Check-in with Halcyon Labs', kind: 'meeting' },
  { date: '2026-10-10', title: 'Design review — auth flow', kind: 'review' },
  { date: '2026-10-10', title: 'Regression sign-off', kind: 'deadline' },
  { date: '2026-10-11', title: 'Sprint planning', kind: 'team' },
  { date: '2026-10-12', title: 'Passkey demo', kind: 'review' },
  { date: '2026-10-14', title: 'Lunch & learn: a11y', kind: 'social' },
  { date: '2026-10-15', title: 'Search feature review', kind: 'review' },
  { date: '2026-10-17', title: 'Launch announcement', kind: 'deadline' },
  { date: '2026-10-18', title: 'Investor update', kind: 'meeting' },
  { date: '2026-10-21', title: 'Retro + team lunch', kind: 'social' },
  { date: '2026-10-24', title: 'Quarterly planning', kind: 'meeting' },
  { date: '2026-10-28', title: 'Regression pass', kind: 'deadline' },
]

export const D15_TODAY_AGENDA: readonly {
  start: string
  end: string
  title: string
  kind: D15EventKind
  label: string
  people: readonly string[]
}[] = [
  {
    start: '10:00 am',
    end: '10:30 am',
    title: 'Daily stand-up',
    kind: 'team',
    label: 'Team',
    people: ['MS', 'HK', 'OM'],
  },
  {
    start: '2:00 pm',
    end: '4:00 pm',
    title: 'Check-in with Halcyon Labs',
    kind: 'meeting',
    label: 'Meeting',
    people: ['NC', 'LR'],
  },
]

export const D15_COMING_UP: readonly { day: number; title: string; when: string }[] = [
  { day: 9, title: 'Daily stand-up', when: 'Today · 10:00 am' },
  { day: 9, title: 'Check-in with Halcyon Labs', when: 'Today · 2:00 pm' },
  { day: 10, title: 'Design review — auth flow', when: 'Tomorrow · 11:00 am' },
  { day: 10, title: 'Regression sign-off', when: 'Tomorrow · 5:00 pm' },
  { day: 11, title: 'Sprint planning', when: 'Sunday · 9:30 am' },
]

// ── 분석 ────────────────────────────────────────────────────────────────────
export type D15Range = '7D' | '30D' | '90D'
export const D15_RANGES: readonly D15Range[] = ['7D', '30D', '90D']

export interface D15Kpi {
  label: string
  value: number
  /** 'int' 1,234 · 'pct' 89% · 'days' 3.0 d */
  format: 'int' | 'pct' | 'days'
  delta: number
  up: boolean
}

export interface D15RangeData {
  days: number
  kpis: readonly D15Kpi[]
  /** 프로젝트별 시간(합 = Hours tracked) */
  hours: readonly number[]
}

// 90D는 F680(647·3,553·89%·3.0 d·도넛 3,553h·프로젝트 1101/853/711/533/355h).
// 30D는 F578~F594 숫자 오르기를 맞춰 거슬러 잰 끝값(224·1,260·92%·2.9 d). 7D는 채움.
export const D15_RANGE_DATA: Record<D15Range, D15RangeData> = {
  '7D': {
    days: 7,
    kpis: [
      { label: 'Tasks completed', value: 58, format: 'int', delta: 9.4, up: true },
      { label: 'Hours tracked', value: 296, format: 'int', delta: 4.2, up: true },
      { label: 'On-time delivery', value: 94, format: 'pct', delta: 2.1, up: true },
      { label: 'Avg. cycle time', value: 2.6, format: 'days', delta: 7.1, up: false },
    ],
    hours: [92, 71, 59, 44, 30],
  },
  '30D': {
    days: 30,
    kpis: [
      { label: 'Tasks completed', value: 224, format: 'int', delta: 12.4, up: true },
      { label: 'Hours tracked', value: 1260, format: 'int', delta: 9.8, up: true },
      { label: 'On-time delivery', value: 92, format: 'pct', delta: 3.1, up: true },
      { label: 'Avg. cycle time', value: 2.9, format: 'days', delta: 8.2, up: false },
    ],
    hours: [390, 302, 252, 189, 127],
  },
  '90D': {
    days: 90,
    kpis: [
      { label: 'Tasks completed', value: 647, format: 'int', delta: 18.9, up: true },
      { label: 'Hours tracked', value: 3553, format: 'int', delta: 16.1, up: true },
      { label: 'On-time delivery', value: 89, format: 'pct', delta: 6.0, up: true },
      { label: 'Avg. cycle time', value: 3.0, format: 'days', delta: 16.7, up: false },
    ],
    hours: [1101, 853, 711, 533, 355],
  },
}

export const D15_TIME_PROJECTS: readonly { name: string; tone: 'deep' | 'accent' | 'soft' | 'amber' | 'gray' }[] = [
  { name: 'Payments API v2', tone: 'deep' },
  { name: 'Mobile Onboarding', tone: 'accent' },
  { name: 'Design System Audit', tone: 'soft' },
  { name: 'Search Revamp', tone: 'amber' },
  { name: 'Q4 Launch Site', tone: 'gray' },
]

export const D15_CONTRIBUTORS: readonly { initials: string; name: string; count: number }[] = [
  { initials: 'MS', name: 'Mateo Silva', count: 170 },
  { initials: 'PR', name: 'Priya Raman', count: 152 },
  { initials: 'HK', name: 'Hana Kobayashi', count: 131 },
  { initials: 'OM', name: 'Owen Mercer', count: 118 },
]

// ── 처리량 — 90일(Jul 12 ~ Oct 9) ───────────────────────────────────────────
export interface D15ThroughputDay {
  /** 'Jul 28' */
  label: string
  tasks: number
  avg: number
  prev: number
  prevAvg: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** 날짜 이름 — 2026-07-12부터 i일 뒤 */
const dayLabel = (i: number) => {
  const d = new Date(Date.UTC(2026, 6, 12 + i))
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

/** 결정적 의사 난수(mulberry32) — 새로 고쳐도 같은 선 */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 툴팁에 보인 날(F614·F620·F630·F640·F648·F660)은 영상 값 그대로 박는다
const PINNED: Record<string, Partial<D15ThroughputDay>> = {
  'Jul 27': { tasks: 9, avg: 7.1, prev: 9 },
  'Jul 28': { tasks: 10, avg: 7.1, prev: 9 },
  'Aug 23': { tasks: 3, avg: 7.0, prev: 7 },
  'Aug 24': { tasks: 10, avg: 7.1, prev: 9 },
  'Sep 17': { tasks: 7, avg: 6.7, prev: 10 },
  'Sep 26': { tasks: 1, avg: 7.6, prev: 2 },
}

function buildThroughput(): D15ThroughputDay[] {
  const r = rng(15)
  // 이번 기간 7일 평균(F630 확대 화면 모양): Jul 12 6.0에서 열흘 동안 7 근처로 오르고, 6.5~8 사이를 들쭉날쭉,
  // 9월 말 8 가까이 갔다가 Oct 9에 7로 내려온다. 지난 기간(점선)은 5.5~6.5, Jul 15 근처 5 아래로 한 번 꺼진다.
  const avg: number[] = []
  const prevAvg: number[] = []
  for (let i = 0; i < 90; i++) {
    const ramp = i < 10 ? (10 - i) * 0.12 : 0
    const end = i > 84 ? (i - 84) * 0.12 : 0
    avg.push(7.25 + 0.45 * Math.sin(i / 11 + 0.5) + 0.3 * Math.sin(i / 4.1) - ramp - end + (r() - 0.5) * 0.6)
    const dip = i >= 2 && i <= 6 ? 1.1 * Math.sin(((i - 2) / 4) * Math.PI) : 0
    prevAvg.push(6.05 + 0.4 * Math.sin(i / 9 + 2) + 0.3 * Math.sin(i / 3.3) - dip + (r() - 0.5) * 0.5)
  }
  const days: D15ThroughputDay[] = []
  for (let i = 0; i < 90; i++) {
    days.push({ label: dayLabel(i), tasks: 0, avg: 0, prev: 0, prevAvg: Math.round(prevAvg[i] * 10) / 10 })
  }
  // 박은 날 둘레(±3일)를 그 값 쪽으로 끌어 와서 선이 튀지 않게
  days.forEach((d, i) => {
    const pin = PINNED[d.label]?.avg
    if (pin === undefined) return
    const delta = pin - avg[i]
    for (let k = -3; k <= 3; k++) if (avg[i + k] !== undefined) avg[i + k] += delta * (1 - Math.abs(k) / 4)
  })
  days.forEach((d, i) => {
    const pin = PINNED[d.label] ?? {}
    const a = pin.avg ?? Math.round(avg[i] * 10) / 10
    d.avg = a
    d.tasks = pin.tasks ?? Math.max(0, Math.min(12, Math.round(a + (r() - 0.5) * 9)))
    d.prev = pin.prev ?? Math.max(0, Math.min(12, Math.round(prevAvg[i] + (r() - 0.5) * 9)))
  })
  return days
}

export const D15_THROUGHPUT: readonly D15ThroughputDay[] = buildThroughput()

/** 꼬마 선(KPI 칸) — 칸마다 20점 */
export const D15_SPARKS: readonly (readonly number[])[] = [0, 1, 2, 3].map((k) => {
  const r = rng(40 + k)
  return Array.from(
    { length: 20 },
    (_, i) => 0.5 + 0.22 * Math.sin(i / 2.3 + k) + (r() - 0.5) * 0.3 + (i > 16 ? 0.15 : 0),
  )
})

/** 활동 칸(20주 × 7일) 세기 0~4 */
export const D15_ACTIVITY: readonly number[] = (() => {
  const r = rng(7)
  return Array.from({ length: 140 }, (_, i) => {
    const week = Math.floor(i / 7)
    const day = i % 7
    const base = 1.2 + week / 9 + (day === 0 || day === 6 ? -1.1 : 0.4)
    return Math.max(0, Math.min(4, Math.round(base + (r() - 0.5) * 2.2)))
  })
})()

// ── 둘러보기 자막 — 영상 편집자가 넣은 설명 알약(앱 UI가 아니다: 창 밖 x=32까지 나온다) ──────────
export const D15_CAPTIONS = {
  add: 'Add a project — every number follows',
  drag: 'Drag work across the board',
  team: 'Filter the team — cards find their place',
  accent: 'One accent re-tints everything',
} as const

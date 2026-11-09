import { TEAMS, type TeamKey, type XtoolMember } from '@xtool-core/members'
import {
  BRAIN_DEFAULTS,
  hubPlaces,
  type BrainHub,
  type BrainMapData,
  type BrainSeat,
  type SeatStatus,
} from '@/ohq-ui/lab/showcase/design14/brain-map'
import { relativeTime } from './errors'
import type { MemberFilter } from './members-table'

// 시스템 지도 — xtool 계정 하나로 들어가는 화면들(허브)과 들어갈 수 있는 사람(자리). 들어가는 기준은
// checkAccess(xtool-core access.ts)와 라우터의 가드(useXtoolSession·AdminGate)를 그대로 옮긴 것이다.

const DAY = 86_400_000
/** 최근 로그인으로 보는 날 수 — 호 길이도 이 안에서 최근일수록 길다 */
const RECENT_DAYS = 7

/** 상태 글(범례·목록) — D14 다섯 상태에 대응 */
export const SYSTEM_STATUS_TEXT: Record<SeatStatus, string> = {
  working: '최근 로그인',
  'runs-itself': '로그인함',
  waiting: '조치 필요',
  'not-running': '정지',
  'in-head': '준비 중 팀',
}

export const SYSTEM_STATUS_ORDER: readonly SeatStatus[] = [
  'working',
  'runs-itself',
  'waiting',
  'not-running',
  'in-head',
]

/** 허브 안 자리 순서 — 손볼 사람이 앞(+N으로 잘려도 보이게) */
const SEAT_RANK: Record<SeatStatus, number> = {
  waiting: 0,
  working: 1,
  'runs-itself': 2,
  'in-head': 3,
  'not-running': 4,
}

interface PersonState {
  status: SeatStatus
  progress?: number
  note: string
  lastMs: number
}

/** 사람 하나의 상태 — 구성원 표의 상태 칸과 같은 순서: 정지 > 첫 로그인 대기(임시 비밀번호) > 가입 전 > 로그인 */
function personState(m: XtoolMember, now: number): PersonState {
  const lastMs = m.lastSignInAt?.toMillis() ?? 0
  if (m.status === 'disabled') return { status: 'not-running', note: '정지 · 못 들어가요', lastMs }
  if (m.mustChangePassword) return { status: 'waiting', note: '첫 로그인 대기', lastMs }
  if (!m.uid) return { status: 'waiting', note: '가입 전', lastMs }
  const age = now - lastMs
  if (lastMs && age < RECENT_DAYS * DAY) {
    return {
      status: 'working',
      progress: Math.max(0.08, 1 - age / (RECENT_DAYS * DAY)),
      note: relativeTime(lastMs, now),
      lastMs,
    }
  }
  return { status: 'runs-itself', note: lastMs ? `${relativeTime(lastMs, now)} 로그인` : '로그인 기록 없음', lastMs }
}

const teamOf = (key: TeamKey) => TEAMS.find((t) => t.key === key)

interface SystemDef {
  id: string
  name: string
  /** 허브 이름 아래 — 주소 */
  path: string
  /** 머리 자리 이름 위 — 주소들 */
  tag: string
  /** 머리 자리 이름 아래 — 들어가는 기준 한 줄 */
  rule: string
  can: (m: XtoolMember) => boolean
  /** 화면 준비 중인 팀 — 권한만 미리 줄 수 있다 */
  team?: TeamKey
  /** +N을 누르면 구성원 표를 이 필터로 */
  filter: MemberFilter
}

function systems(): SystemDef[] {
  const pending = (key: TeamKey): SystemDef => {
    const team = teamOf(key)
    const label = team?.label ?? key
    return {
      id: key,
      name: label,
      path: team?.ready ? label : '준비 중',
      tag: team?.ready ? label : '화면 준비 중',
      rule: `관리자 · ${label} 권한`,
      can: (m) => m.isAdmin || m.teams[key] === true,
      team: team?.ready ? undefined : key,
      filter: key,
    }
  }
  return [
    {
      id: 'tech',
      name: '기술팀 보드',
      path: '/xtool-tech',
      tag: '/xtool-tech',
      rule: '관리자 · 기술팀 권한',
      can: (m) => m.isAdmin || m.teams.tech === true,
      filter: 'tech',
    },
    {
      id: 'lead',
      name: '리드 매니저',
      path: '/xtool-lead-manager',
      tag: '/xtool-lead-manager',
      rule: '활성 구성원 누구나',
      can: () => true,
      filter: 'all',
    },
    { id: 'cmip', name: 'CMIP', path: '/cmip', tag: '/cmip', rule: '관리자만', can: (m) => m.isAdmin, filter: 'admin' },
    {
      id: 'admin',
      name: '관리 화면',
      path: '/admin/xtool',
      tag: '/admin/xtool · /log · /admin/cafe24',
      rule: '관리자만 · 수정 기록 · Cafe24 정산',
      can: (m) => m.isAdmin,
      filter: 'admin',
    },
    pending('sales'),
    pending('callback'),
  ]
}

/** 허브 id → +N을 눌렀을 때 구성원 표 필터 */
export function systemFilter(hubId: string): MemberFilter {
  return systems().find((s) => s.id === hubId)?.filter ?? 'all'
}

/** 허브 id → 머리 자리 한 줄(목록 보기) */
export function systemRule(hubId: string): string {
  return systems().find((s) => s.id === hubId)?.rule ?? ''
}

const nameOf = (m: XtoolMember) => m.name.trim() || m.email.split('@')[0]

/**
 * 구성원 → 지도. 정지된 사람도 권한이 있는 허브에 넣는다(올리브 점, 맨 뒤) — 권한은 남아 있는데 정지라 못 들어간다는
 * 걸 보이려고. 준비 중 팀은 관리자 + 그 팀 권한(checkAccess와 같다), 정지가 아니면 모두 "준비 중 팀".
 */
export function buildSystemMap(members: readonly XtoolMember[], self: XtoolMember, now: number): BrainMapData {
  const states = new Map(members.map((m) => [m.email, personState(m, now)]))
  const defs = systems()
  const places = hubPlaces(defs.length)
  const inPending = new Set<string>()

  const hubs: BrainHub[] = defs.map((def, i) => {
    const seats: (BrainSeat & { rank: number; lastMs: number })[] = members.filter(def.can).map((m) => {
      const base = states.get(m.email) as PersonState
      const pending = def.team && base.status !== 'not-running'
      if (pending) inPending.add(m.email)
      const status: SeatStatus = pending ? 'in-head' : base.status
      const note = pending ? (m.teams[def.team as TeamKey] ? '팀 권한 · 준비 중' : '관리자 · 준비 중') : base.note
      return {
        id: m.email,
        name: nameOf(m),
        status,
        progress: pending ? undefined : base.progress,
        note,
        rank: SEAT_RANK[status],
        lastMs: base.lastMs,
      }
    })
    seats.sort((a, b) => a.rank - b.rank || b.lastMs - a.lastMs || a.name.localeCompare(b.name, 'ko'))
    return {
      id: def.id,
      name: def.name,
      sub: def.path,
      ...places[i],
      head: { name: def.name, tag: def.tag, sub: def.rule },
      seats: seats.map(({ id, name, status, progress, note }) => ({ id, name, status, progress, note })),
      count: seats.length,
    }
  })

  const counts: Record<SeatStatus, number> = {
    working: 0,
    'runs-itself': 0,
    waiting: 0,
    'not-running': 0,
    'in-head': 0,
  }
  for (const s of states.values()) counts[s.status]++
  counts['in-head'] = inPending.size
  const active = members.filter((m) => m.status === 'active').length
  const admins = members.filter((m) => m.isAdmin).length
  const waiting = counts.waiting

  return {
    hubs,
    core: {
      name: 'xtool 계정',
      sub: `등록 ${members.length} · 활성 ${active} · 관리자 ${admins}`,
      label: 'xtool',
      satellites: BRAIN_DEFAULTS.satellites,
    },
    you: {
      name: nameOf(self),
      sub: waiting ? `조치 필요 ${waiting}명` : '지금 보는 관리자',
      label: '나',
      badge: waiting,
      ...BRAIN_DEFAULTS.you,
      // 둘레 점 중 앞쪽 몇 개가 조치 필요(붉은 고리) — 배지와 같은 수, 9개까지
      topics: BRAIN_DEFAULTS.topics.map((t, i) => ({ at: t.at, waiting: i < waiting })),
    },
    statusText: SYSTEM_STATUS_TEXT,
    statusOrder: SYSTEM_STATUS_ORDER,
    hint: { walk: '시스템 사이 이동', click: '사람을 누르면 구성원 표에서 보여요', counts },
    bar: {
      brand: 'XTOOL',
      live: '실시간',
      stats: [
        { value: String(defs.length), unit: '시스템' },
        { value: String(members.length), unit: '계정' },
      ],
    },
    seatLimit: 8,
    more: { name: (n) => `외 ${n}명`, note: '구성원 표에서 보기' },
    empty: { name: '아직 없음', note: '권한을 준 사람이 없어요' },
    label: '시스템 지도 — ← → 로 시스템 사이를 옮겨 다니고, Esc로 전체 보기',
  }
}

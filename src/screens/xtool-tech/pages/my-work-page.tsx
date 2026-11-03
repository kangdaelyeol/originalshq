import { AlarmClock, CircleCheck, Hourglass, ListTodo, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MondayMyWork } from '../components/monday/monday-my-work'
import { MyWorkRow } from '../components/overview/my-work-card'
import { GlassCard } from '../components/ui/glass-card'
import { SegmentedControl } from '../components/ui/segmented-control'
import { StatCard } from '../components/ui/stat-card'
import { useCurrentMember } from '../context/member-context'
import { usePeriod } from '../context/period-context'
import { buildMyWork, MY_WORK_BOARDS, type MyWorkBoard } from '../data/my-work'
import { PERIOD_COMPARE } from '../data/period'
import { BOARD_TABS } from '../data/tech-boards'
import { useMyIdentity, useWorkPeople, useWorkSources } from '../data/use-my-work'
import { daysBetween, inRange, koreaToday, periodRange } from '../lib/dates'
import { myWorkPath } from '../paths'
import { useSettings } from '../settings/settings'

// 처음에 보여 줄 줄 수
const PAGE = 20
// 접수·요청한 지 이 날 수가 지나도 진행 중이면 "오래된 건"
const STALE_DAYS = 14

type State = 'open' | 'done' | 'all'
const STATES: readonly { value: State; label: string }[] = [
  { value: 'open', label: '진행 중' },
  { value: 'done', label: '완료' },
  { value: 'all', label: '전체' },
]

const labelOf = (key: MyWorkBoard) => BOARD_TABS.find((t) => t.key === key)?.label ?? key

/**
 * 내 업무 — 담당자 칸이 있는 보드 여섯 개에서 담당자가 그 사람인 건만 모은다. 기본은 나,
 * ?who=<이름>이면 그 직원(사이드바 내 업무 아래 직원 목록에서 고른다). 줄을 누르면 그 보드의 상세가 열린다.
 */
export function MyWorkPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const me = useMyIdentity()
  const { sources, loading } = useWorkSources()
  const { period } = usePeriod()
  const { layout } = useSettings()
  const today = koreaToday()

  const who = params.get('who')
  // 기술팀이 아닌 관리자는 개인 보드가 없다 — 내 업무로 오면 첫 기술팀원의 보드를 보여 준다.
  const isTech = useCurrentMember()?.teams.tech === true
  const mine = isTech && (!who || me.names.has(who))
  const names = useMemo(() => (mine ? me.names : new Set(who ? [who] : [])), [mine, me.names, who])
  const items = useMemo(() => buildMyWork(sources, names, today, { includeDone: true }), [sources, names, today])
  // 고를 수 있는 직원 — /admin/xtool에서 기술팀으로 등록한 사람만
  const people = useWorkPeople(sources, today)

  const [state, setState] = useState<State>('open')
  const [board, setBoard] = useState<'' | MyWorkBoard>('')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setLimit(PAGE)
    }

  const open = items.filter((i) => !i.done)
  const urgent = open.filter((i) => i.urgent)
  const stale = open.filter((i) => i.since && daysBetween(i.since.date, today) >= STALE_DAYS)
  const { current } = periodRange(period, today)
  const doneInPeriod = items.filter((i) => i.done && inRange(i.doneAt, current))

  const q = query.trim().toLowerCase()
  const shown = items.filter(
    (i) =>
      (state === 'all' || (state === 'done') === i.done) &&
      (!board || i.boardKey === board) &&
      (!q || `${i.name} ${i.boardLabel} ${i.stage ?? ''}`.toLowerCase().includes(q)),
  )
  const boardCounts = MY_WORK_BOARDS.map((key) => ({ key, count: open.filter((i) => i.boardKey === key).length }))

  // 고를 수 있는 사람 — 나는 맨 위, 지금 보는 사람이 목록에 없어도(최근 90일 밖) 넣는다.
  const myName = me.name
  const others = people.map((p) => p.name).filter((n) => !isTech || !me.names.has(n))
  const firstPerson = others[0]
  useEffect(() => {
    if (!isTech && !who && firstPerson) navigate(myWorkPath(firstPerson), { replace: true })
  }, [isTech, who, firstPerson, navigate])
  if (who && !mine && !others.includes(who)) others.unshift(who)
  const title = mine ? '내 담당 업무' : who ? `${who}님 담당 업무` : '직원 업무'

  // Monday 표 레이아웃 — 숫자 카드 없이 보드마다 Monday 표로(칸을 바로 고친다).
  if (layout === 'monday') {
    const entries = new Map<MyWorkBoard, Set<string>>()
    for (const item of items) {
      if (state !== 'all' && (state === 'done') !== item.done) continue
      const ids = entries.get(item.boardKey) ?? new Set<string>()
      ids.add(item.itemId)
      entries.set(item.boardKey, ids)
    }
    const meLabel = myName ? `나 · ${myName}` : '나'
    return (
      <MondayMyWork
        entries={entries}
        loading={loading}
        personLabel={mine ? meLabel : (who ?? '')}
        people={[...(isTech ? [{ value: null, label: meLabel }] : []), ...others.map((name) => ({ value: name, label: name }))]}
        onPerson={(next) => navigate(myWorkPath(next))}
        state={state}
        onState={setState}
        totalAll={items.length}
      />
    )
  }

  return (
    <>
      <div className="grid grid--kpi">
        <StatCard title="진행 중" value={`${open.length}건`} icon={ListTodo} tint="amber" />
        <StatCard title="임박·지남" value={`${urgent.length}건`} icon={AlarmClock} tint="violet" />
        <StatCard title={`${STALE_DAYS}일 넘은 건`} value={`${stale.length}건`} icon={Hourglass} tint="blue" />
        <StatCard title={`${PERIOD_COMPARE[period].current} 완료`} value={`${doneInPeriod.length}건`} icon={CircleCheck} tint="green" />
      </div>

      <GlassCard
        title={title}
        subtitle={
          loading
            ? '불러오는 중…'
            : `진행 중 ${open.length}건 · ${boardCounts
                .filter((b) => b.count > 0)
                .map((b) => `${labelOf(b.key)} ${b.count}`)
                .join(' · ') || '담당 보드 없음'}`
        }
        actions={<SegmentedControl ariaLabel="상태" size="sm" options={STATES} value={state} onChange={reset(setState)} />}
        className="my-work-board"
      >
        <div className="record-filters">
          <label className="record-search">
            <Search size={14} aria-hidden />
            <span className="sr-only">검색</span>
            <input type="search" value={query} placeholder="고객·업무 이름·단계 검색" onChange={(e) => reset(setQuery)(e.target.value)} />
          </label>
          <label className="record-select">
            <span className="sr-only">직원</span>
            <select value={mine ? '' : (who ?? '')} onChange={(e) => navigate(myWorkPath(e.target.value || null))}>
              {isTech && <option value="">{myName ? `나 (${myName})` : '나'}</option>}
              {others.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="record-select">
            <span className="sr-only">보드</span>
            <select value={board} onChange={(e) => reset(setBoard)(e.target.value as '' | MyWorkBoard)}>
              <option value="">보드 전체</option>
              {MY_WORK_BOARDS.map((key) => (
                <option key={key} value={key}>
                  {labelOf(key)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!loading && shown.length === 0 ? (
          <p className="bar-list__empty">
            {items.length === 0 ? '담당 업무가 없어요.' : '조건에 맞는 업무가 없어요.'}
            {mine && !me.linked && items.length === 0 &&
              ' (Monday 계정과 이메일로 이어지지 않아 구성원 이름으로 찾았어요 — 이름이 Monday와 다르면 안 보일 수 있어요)'}
          </p>
        ) : (
          <ul className="my-work__list">
            {shown.slice(0, limit).map((item) => (
              <MyWorkRow key={`${item.boardKey}:${item.itemId}`} item={item} today={today} />
            ))}
          </ul>
        )}
        {shown.length > limit && (
          <button type="button" className="record-more" onClick={() => setLimit((n) => n + PAGE)}>
            더 보기 <span>{shown.length - limit}건 남음</span>
          </button>
        )}
      </GlassCard>
    </>
  )
}

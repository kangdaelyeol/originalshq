import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buildMyWork, MY_WORK_BOARDS, urgencyText, type MyWorkBoard, type MyWorkItem } from '../../data/my-work'
import { BOARD_TABS } from '../../data/tech-boards'
import { koreaToday, shortDate } from '../../lib/dates'
import { cx } from '../../lib/cx'
import { xtPath } from '../../paths'
import { StagePill } from '../board/cells'
import { GlassCard } from '../ui/glass-card'
import { SegmentedControl } from '../ui/segmented-control'

// 처음에 보여 줄 줄 수
const PAGE = 8

type Filter = 'all' | MyWorkBoard

interface MyWorkCardProps {
  /** Monday 담당자 칸에서 나를 찾을 이름들(Monday 사용자 이름 · 구성원 이름) */
  names: ReadonlySet<string>
  sources: Parameters<typeof buildMyWork>[0]
  loading: boolean
  /** Monday 사용자와 이메일로 이어졌는지 — 아니면 구성원 이름으로만 찾는다 */
  linked: boolean
}

const labelOf = (key: MyWorkBoard) => BOARD_TABS.find((t) => t.key === key)?.label ?? key

/** 나의 진행 중 업무 — 보드별로 거르고, 누르면 그 보드의 상세가 열린다. */
export function MyWorkCard({ names, sources, loading, linked }: MyWorkCardProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [limit, setLimit] = useState(PAGE)
  const today = koreaToday()
  const items = buildMyWork(sources, names, today)
  const counts = Object.fromEntries(MY_WORK_BOARDS.map((k) => [k, items.filter((i) => i.boardKey === k).length]))
  const shown = filter === 'all' ? items : items.filter((i) => i.boardKey === filter)
  const urgent = items.filter((i) => i.urgent).length

  const options = [
    { value: 'all' as Filter, label: `전체 ${items.length}` },
    ...MY_WORK_BOARDS.filter((k) => counts[k] > 0).map((k) => ({ value: k as Filter, label: `${labelOf(k)} ${counts[k]}` })),
  ]

  return (
    <GlassCard
      title="나의 진행 중 업무"
      subtitle={
        loading
          ? '불러오는 중…'
          : `${items.length}건${urgent ? ` · 임박·지남 ${urgent}건` : ''}`
      }
      actions={
        items.length > 0 ? (
          <SegmentedControl
            ariaLabel="보드"
            options={options}
            value={filter}
            onChange={(v) => {
              setFilter(v)
              setLimit(PAGE)
            }}
          />
        ) : undefined
      }
      className="my-work"
    >
      {!loading && items.length === 0 ? (
        <p className="bar-list__empty">
          진행 중인 담당 업무가 없어요.
          {!linked && ' (Monday 계정과 이메일로 이어지지 않아 구성원 이름으로 찾았어요 — 이름이 Monday와 다르면 안 보일 수 있어요)'}
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
  )
}

export function MyWorkRow({ item, today }: { item: MyWorkItem; today: string }) {
  const urgency = urgencyText(item, today)
  const detail = [
    item.target && `${item.target.label} ${shortDate(item.target.date)}${item.target.time ? ` ${item.target.time}` : ''}`,
    item.since && `${item.since.label} ${shortDate(item.since.date)}`,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li>
      <Link className={cx('my-work__row', item.done && 'is-done')} to={`${xtPath(`/boards/${item.slug}`)}?item=${item.itemId}`}>
        <span className="my-work__board">{item.boardLabel}</span>
        <span className="my-work__body">
          <span className="my-work__name">{item.name || '(이름 없음)'}</span>
          <span className="my-work__meta">{detail}</span>
        </span>
        <StagePill stage={item.stage} status={item.status} />
        <span className={cx('my-work__when', `is-${urgency.tone}`)}>{urgency.text}</span>
        <ChevronRight size={14} className="my-work__chev" aria-hidden />
      </Link>
    </li>
  )
}

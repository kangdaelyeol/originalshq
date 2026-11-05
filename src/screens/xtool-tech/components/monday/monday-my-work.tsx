import { ArrowUpRight, CircleUserRound, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MyWorkBoard } from '../../data/my-work'
import { BOARD_TABS } from '../../data/tech-boards'
import { useTechBoard } from '../../data/tech-boards-store'
import { cx } from '@/ohq-ui/lib/cx'
import { BOARD_ICONS } from '../../nav'
import { xtPath } from '../../paths'
import { Topbar } from '../layout/topbar'
import { MonPopover } from './monday-popover'
import { MondaySection } from './monday-section'
import { MondayWorkboxSkeleton, SkeletonText } from './monday-skeleton'
import { SelectionProvider } from './monday-selection-bar'
import { matchesItem, nextSort, type MonSort } from './monday-values'
import { useCollapsedGroups } from './use-monday-prefs'

export type MyWorkState = 'open' | 'done' | 'all'

const STATES: readonly { value: MyWorkState; label: string }[] = [
  { value: 'open', label: '진행 중' },
  { value: 'done', label: '완료' },
  { value: 'all', label: '전체' },
]

interface MondayMyWorkProps {
  /** 보드마다 보여 줄 항목 id — 그 사람이 담당이고 상태(진행 중·완료)에 맞는 것 */
  entries: ReadonlyMap<MyWorkBoard, ReadonlySet<string>>
  loading: boolean
  /** 지금 보는 사람 표시("나 · 이재민" 등) */
  personLabel: string
  /** 고를 수 있는 사람 — value null은 나 */
  people: { value: string | null; label: string }[]
  onPerson: (who: string | null) => void
  state: MyWorkState
  onState: (state: MyWorkState) => void
  /** 상태가 안 맞아 지금 안 보이는 것까지 합한 담당 건수 */
  totalAll: number
}

/**
 * 내 업무(Monday 표 레이아웃) — 숫자 카드 없이 Monday 판 하나: 위 도구 줄(검색·사람·상태)과
 * 보드마다 제목 + 그 보드의 그룹 표(MondaySection). 칸은 보드 화면처럼 바로 고친다.
 */
export function MondayMyWork({ entries, loading, personLabel, people, onPerson, state, onState, totalAll }: MondayMyWorkProps) {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const needle = query.trim().toLowerCase()
  const total = [...entries.values()].reduce((s, ids) => s + ids.size, 0)
  const boards = BOARD_TABS.filter((t) => entries.get(t.key as MyWorkBoard)?.size)

  return (
    <section className="mon-board" aria-label={personLabel}>
      <Topbar embedded />
      <nav className="mon-board__views" aria-label="보기">
        <span className="mon-tab is-on">메인 테이블</span>
      </nav>
      <div className="mon-toolbar">
        <span className="mon-tool-group is-on">
          <button
            type="button"
            className="mon-tool"
            aria-haspopup="dialog"
            onClick={(e) => setMenu(menu ? null : e.currentTarget)}
          >
            <CircleUserRound size={15} aria-hidden />
            {personLabel}
          </button>
        </span>

        {searchOpen || query ? (
          <label className="mon-search">
            <Search size={15} aria-hidden />
            <input
              autoFocus
              value={query}
              placeholder="담당 업무에서 검색"
              aria-label="검색"
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => setSearchOpen(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('')
                  e.currentTarget.blur()
                }
              }}
            />
            {query && (
              <button type="button" aria-label="검색 지우기" onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery('')}>
                <X size={13} aria-hidden />
              </button>
            )}
          </label>
        ) : (
          <button type="button" className="mon-tool" onClick={() => setSearchOpen(true)}>
            <Search size={15} aria-hidden />
            검색
          </button>
        )}

        <span className="mon-tabs" role="radiogroup" aria-label="상태">
          {STATES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={state === s.value}
              className={cx('mon-tab', state === s.value && 'is-on')}
              onClick={() => onState(s.value)}
            >
              {s.label}
            </button>
          ))}
        </span>

        <span className="mon-toolbar__count">
          {loading ? <SkeletonText width={72} /> : `${total}개 항목${state !== 'all' ? ` · 전체 ${totalAll}개` : ''}`}
        </span>
      </div>

      <div className="mon-scroll">
        {!loading && boards.length === 0 && <p className="mon-empty">담당 업무가 없어요.</p>}
        <SelectionProvider>
          {boards.map((tab) => (
            <MyWorkBoardSection
              key={tab.key}
              boardKey={tab.key as MyWorkBoard}
              label={tab.label}
              slug={tab.slug}
              ids={entries.get(tab.key as MyWorkBoard)!}
              needle={needle}
            />
          ))}
        </SelectionProvider>
        {/* 아직 안 온 보드 자리 — 하나도 안 왔으면 두 개, 몇 개 왔으면 아래에 하나 */}
        {loading && (boards.length === 0 ? [5, 3] : [3]).map((rows, i) => <MondayWorkboxSkeleton key={i} rows={rows} />)}
      </div>

      {menu && (
        <MonPopover anchor={menu} width={240} onClose={() => setMenu(null)}>
          <p className="mon-menu__title">누구의 업무를 볼까요</p>
          <ul className="mon-menu">
            {people.map((p) => (
              <li key={p.value ?? '__me'}>
                <button
                  type="button"
                  className={cx('mon-menu__item', p.label === personLabel && 'is-on')}
                  onClick={() => {
                    onPerson(p.value)
                    setMenu(null)
                  }}
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        </MonPopover>
      )}
    </section>
  )
}

/**
 * 보드 하나 = 박스 하나 — 위에 머리말(아이콘·보드 이름·건수, 누르면 그 보드로), 아래 그룹 표. 박스는
 * 화면 높이 안으로 줄여서, 길면 머리말은 그대로 두고 표만 박스 안에서 스크롤된다(칸 머리글도 박스
 * 안에서 위에 붙는다). 옆 스크롤도 박스마다 따로 — 칸 수가 다른 보드가 같이 밀리지 않게.
 */
function MyWorkBoardSection({
  boardKey,
  label,
  slug,
  ids,
  needle,
}: {
  boardKey: MyWorkBoard
  label: string
  slug: string
  ids: ReadonlySet<string>
  needle: string
}) {
  const board = useTechBoard(boardKey)
  const [collapsed, setCollapsed] = useCollapsedGroups(boardKey)
  const [sort, setSort] = useState<MonSort>(null)
  const meta = board.meta
  const items = useMemo(
    () => (board.items ?? []).filter((item) => ids.has(item.itemId) && matchesItem(item, [], needle, null)),
    [board.items, ids, needle],
  )
  if (!meta || items.length === 0) return null

  const Icon = BOARD_ICONS[boardKey]

  return (
    <section className="mon-workbox" aria-label={label}>
      <header className="mon-workbox__head">
        <span className="mon-workbox__head-inner">
          <span className="mon-workbox__icon" aria-hidden>
            <Icon size={16} strokeWidth={2} />
          </span>
          <Link to={xtPath(`/boards/${slug}`)} className="mon-workbox__title" title={`${label} 보드로`}>
            {label}
            <ArrowUpRight size={15} aria-hidden />
          </Link>
          <span className="mon-workbox__count">{items.length}건</span>
        </span>
      </header>
      <MondaySection
        boardKey={boardKey}
        meta={meta}
        items={items}
        hideEmptyGroups
        allowAdd={false}
        boxed
        sort={sort}
        onSort={(id) => setSort((current) => nextSort(current, id))}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
    </section>
  )
}

import { ArrowUpRight, CircleUserRound, Search, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MyWorkBoard } from '../../data/my-work'
import { BOARD_TABS } from '../../data/tech-boards'
import { useTechBoard } from '../../data/tech-boards-store'
import { cx } from '../../lib/cx'
import { xtPath } from '../../paths'
import { BoardEditContext, type BoardEditState } from '../board/board-edit-context'
import { ItemEditor } from '../board/item-editor'
import { MonPopover } from './monday-popover'
import { MondaySection } from './monday-section'
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
          {loading ? '불러오는 중…' : `${total}개 항목${state !== 'all' ? ` · 전체 ${totalAll}개` : ''}`}
        </span>
      </div>

      <div className="mon-scroll">
        {!loading && boards.length === 0 && <p className="mon-empty">담당 업무가 없어요.</p>}
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

/** 보드 하나 — 제목(보드로 가는 링크) + 그 보드의 그룹 표. 편집 패널도 보드마다 따로 연다. */
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
  // 편집 패널 — itemId가 null이면 새로 만들기(내 업무에선 쓰지 않는다), editing이 null이면 닫힘.
  const [editing, setEditing] = useState<{ itemId: string | null } | null>(null)
  const meta = board.meta
  const itemsById = board.itemsById
  const openEditor = useCallback((itemId: string | null) => setEditing({ itemId }), [])
  const itemOf = useCallback((itemId: string) => itemsById.get(itemId), [itemsById])
  const editContext = useMemo<BoardEditState | null>(
    () => (meta ? { boardKey, meta, openEditor, itemOf } : null),
    [meta, boardKey, openEditor, itemOf],
  )
  const items = useMemo(
    () => (board.items ?? []).filter((item) => ids.has(item.itemId) && matchesItem(item, [], needle, null)),
    [board.items, ids, needle],
  )
  if (!meta || !editContext || items.length === 0) return null

  return (
    <BoardEditContext.Provider value={editContext}>
      <MondaySection
        boardKey={boardKey}
        meta={meta}
        items={items}
        hideEmptyGroups
        allowAdd={false}
        sort={sort}
        onSort={(id) => setSort((current) => nextSort(current, id))}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        title={
          <h2 className="mon-section__title">
            <Link to={xtPath(`/boards/${slug}`)}>
              {label}
              <ArrowUpRight size={15} aria-hidden />
            </Link>
            <span>{items.length}개</span>
          </h2>
        }
      />
      <ItemEditor
        open={editing !== null}
        boardKey={boardKey}
        meta={meta}
        item={editing?.itemId ? (itemsById.get(editing.itemId) ?? null) : null}
        onClose={() => setEditing(null)}
      />
    </BoardEditContext.Provider>
  )
}

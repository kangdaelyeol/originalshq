import { ArrowDownUp, ChevronsDownUp, ChevronsUpDown, CircleUserRound, Plus, Search, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { TechBoardKey, TechBoardMeta, TechItemDoc } from '../../data/tech-boards'
import { cx } from '../../lib/cx'
import { Topbar } from '../layout/topbar'
import { MonPopover } from './monday-popover'
import { useOptimistic } from './monday-optimistic'
import { MondaySection } from './monday-section'
import { selectionKey } from './monday-selection'
import { SelectionProvider } from './monday-selection-bar'
import {
  groupIdOf,
  matchesItem,
  NAME_TITLE,
  nextSort,
  OTHER_GROUP,
  splitNames,
  visibleColumns,
  type MonSort,
} from './monday-values'
import { useCollapsedGroups } from './use-monday-prefs'

interface MondayBoardProps {
  boardKey: TechBoardKey
  meta: TechBoardMeta
  items: TechItemDoc[]
}

/**
 * Monday 표 레이아웃(보드 화면) — 위 도구 줄(새 항목·검색·사람·정렬·모두 접기)과 보드 한 장
 * 분량의 표(MondaySection). 표는 자기 안에서 위아래·옆으로 스크롤된다.
 */
export function MondayBoard({ boardKey, meta, items: allItems }: MondayBoardProps) {
  // 지우는 중인 항목은 바로 뺀다(건수·사람 목록·거르기까지).
  const { hidden } = useOptimistic()
  const items = useMemo(
    () => (hidden.size ? allItems.filter((item) => !hidden.has(selectionKey(boardKey, item.itemId))) : allItems),
    [allItems, hidden, boardKey],
  )
  const boardRef = useRef<HTMLElement>(null)
  const nameTitle = NAME_TITLE[boardKey]
  const columns = useMemo(() => visibleColumns(meta), [meta])
  const peopleColumns = useMemo(() => columns.filter((c) => c.type === 'people'), [columns])

  const [collapsed, setCollapsed] = useCollapsedGroups(boardKey)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [person, setPerson] = useState<string | null>(null)
  const [sort, setSort] = useState<MonSort>(null)
  const [menu, setMenu] = useState<{ kind: 'person' | 'sort'; anchor: HTMLElement } | null>(null)

  // 담당자로 거를 사람 — 사람 칸에 나오는 이름, 많이 맡은 순
  const people = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      for (const c of peopleColumns) for (const name of splitNames(item.values[c.id]?.text)) counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  }, [items, peopleColumns])

  const needle = query.trim().toLowerCase()
  const filtering = Boolean(needle || person)
  const shown = useMemo(
    () => (filtering ? items.filter((item) => matchesItem(item, peopleColumns, needle, person)) : items),
    [items, peopleColumns, needle, person, filtering],
  )
  // "모두 접기"가 다루는 그룹 — 거르는 중이면 항목이 남은 그룹만
  const groupIds = filtering
    ? [...new Set(shown.map((item) => groupIdOf(meta, item)))]
    : [...meta.groups.map((g) => g.id), ...(items.some((i) => groupIdOf(meta, i) === OTHER_GROUP) ? [OTHER_GROUP] : [])]
  const allCollapsed = groupIds.every((id) => collapsed.has(id))
  const sortTitle = sort ? (sort.columnId === 'name' ? nameTitle : columns.find((c) => c.id === sort.columnId)?.title) : null

  return (
    <section ref={boardRef} className="mon-board" aria-label={meta.name}>
      <Topbar embedded />
      <nav className="mon-board__views" aria-label="보기">
        <span className="mon-tab is-on">메인 테이블</span>
      </nav>
      <div className="mon-toolbar">
        <button
          type="button"
          className="mon-primary"
          // Monday처럼 새 항목은 표 안에서 — 첫 그룹의 "+ 추가" 줄로 데려간다.
          onClick={() => {
            const input = boardRef.current?.querySelector<HTMLInputElement>('.mon-row--add .mon-add')
            input?.scrollIntoView({ block: 'center', behavior: 'smooth' })
            input?.focus({ preventScroll: true })
          }}
        >
          <Plus size={15} strokeWidth={2.4} aria-hidden />
          새로운 {nameTitle}
        </button>

        {searchOpen || query ? (
          <label className="mon-search">
            <Search size={15} aria-hidden />
            <input
              autoFocus
              value={query}
              placeholder="이 보드에서 검색"
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

        <span className={cx('mon-tool-group', person && 'is-on')}>
          <button
            type="button"
            className={cx('mon-tool', person && 'is-on')}
            aria-haspopup="dialog"
            onClick={(e) => setMenu(menu?.kind === 'person' ? null : { kind: 'person', anchor: e.currentTarget })}
          >
            <CircleUserRound size={15} aria-hidden />
            {person ?? '사람'}
          </button>
          {person && (
            <button type="button" className="mon-tool__clear" aria-label="사람 거르기 해제" onClick={() => setPerson(null)}>
              <X size={12} aria-hidden />
            </button>
          )}
        </span>

        <button
          type="button"
          className={cx('mon-tool', sort && 'is-on')}
          aria-haspopup="dialog"
          onClick={(e) => setMenu(menu?.kind === 'sort' ? null : { kind: 'sort', anchor: e.currentTarget })}
        >
          <ArrowDownUp size={15} aria-hidden />
          {sortTitle ? `${sortTitle} ${sort?.dir === 1 ? '↑' : '↓'}` : '정렬'}
        </button>

        <button
          type="button"
          className="mon-tool"
          onClick={() => setCollapsed(groupIds, !allCollapsed)}
        >
          {allCollapsed ? <ChevronsUpDown size={15} aria-hidden /> : <ChevronsDownUp size={15} aria-hidden />}
          {allCollapsed ? '모두 펼치기' : '모두 접기'}
        </button>

        <span className="mon-toolbar__count">{filtering ? `${shown.length}개 찾음` : `${items.length}개 항목`}</span>
      </div>

      <div className="mon-scroll">
        {filtering && shown.length === 0 && <p className="mon-empty">조건에 맞는 항목이 없어요.</p>}
        <SelectionProvider>
          <MondaySection
            boardKey={boardKey}
            meta={meta}
            items={shown}
            hideEmptyGroups={filtering}
            sort={sort}
            onSort={(id) => setSort((current) => nextSort(current, id))}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
          />
        </SelectionProvider>
      </div>

      {menu?.kind === 'person' && (
        <MonPopover anchor={menu.anchor} width={240} onClose={() => setMenu(null)}>
          <p className="mon-menu__title">담당자로 거르기</p>
          <ul className="mon-menu">
            {people.length === 0 && <li className="mon-pick__empty">사람 칸이 없는 보드예요</li>}
            {people.map(([name, count]) => (
              <li key={name}>
                <button
                  type="button"
                  className={cx('mon-menu__item', person === name && 'is-on')}
                  onClick={() => {
                    setPerson(person === name ? null : name)
                    setMenu(null)
                  }}
                >
                  {name}
                  <small>{count}</small>
                </button>
              </li>
            ))}
          </ul>
        </MonPopover>
      )}

      {menu?.kind === 'sort' && (
        <MonPopover anchor={menu.anchor} width={240} onClose={() => setMenu(null)}>
          <p className="mon-menu__title">정렬 — 한 번 더 누르면 반대로</p>
          <ul className="mon-menu">
            {[{ id: 'name', title: nameTitle }, ...columns].map((c) => {
              const on = sort?.columnId === c.id
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={cx('mon-menu__item', on && 'is-on')}
                    onClick={() => setSort(on ? { columnId: c.id, dir: sort.dir === 1 ? -1 : 1 } : { columnId: c.id, dir: 1 })}
                  >
                    {c.title}
                    {on && <small>{sort.dir === 1 ? '오름차순' : '내림차순'}</small>}
                  </button>
                </li>
              )
            })}
          </ul>
          {sort && (
            <button
              type="button"
              className="mon-menu__reset"
              onClick={() => {
                setSort(null)
                setMenu(null)
              }}
            >
              정렬 해제
            </button>
          )}
        </MonPopover>
      )}
    </section>
  )
}

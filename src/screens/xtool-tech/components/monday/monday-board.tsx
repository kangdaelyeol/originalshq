import { ArrowDownUp, ChevronsDownUp, ChevronsUpDown, CircleUserRound, Plus, Search, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { TechBoardKey, TechBoardMeta, TechCellValue, TechColumn, TechItemDoc } from '../../data/tech-boards'
import { toEditValue } from '../../data/tech-edit'
import { saveInBackground, usePendingSaves } from '../../data/tech-save-queue'
import { cx } from '../../lib/cx'
import { useBoardEdit } from '../board/board-edit-context'
import { groupColor } from './monday-colors'
import { defaultWidth, HIDDEN_TYPES, NAME_WIDTH, sortValue } from './monday-values'
import type { CellCommit } from './monday-editors'
import { GroupTable, type EditingCell, type MonGroup } from './monday-group'
import { MonPopover } from './monday-popover'
import { useCollapsedGroups, useColumnWidths } from './use-monday-prefs'

// 그룹마다 처음 그릴 줄 수 — 완료 그룹은 수천 건이라 나눠 그린다.
const PAGE = 50
// 저장에 성공한 뒤 먼저 보여 준 값을 지키는 시간 — 그 사이 실시간 구독으로 새 값이 온다.
const KEEP_PREVIEW_MS = 3000

/** 이름 칸 머리글 — Monday 이름 칸 제목은 캐시에 없어서 보드마다 정한다. */
const NAME_TITLE: Record<TechBoardKey, string> = {
  fieldService: '고객',
  repair: '고객',
  records: '업무',
  techInquiry: '고객',
  techTask: '업무',
  asRequests: '신청자',
  parts: '부품',
  rentals: '대여품',
  serials: 'SN',
}

interface Preview {
  /** 고치기 전 캐시 값 — 캐시가 이 값에서 바뀌면(저장 반영) 미리 보기를 버린다. */
  base: string
  cell: TechCellValue
}

const cellKey = (cell: TechCellValue | undefined) => `${cell?.text ?? ''}\u0000${cell?.value ?? ''}`
const splitNames = (text: string | undefined) => (text ?? '').split(', ').map((s) => s.trim()).filter(Boolean)

interface MondayBoardProps {
  boardKey: TechBoardKey
  meta: TechBoardMeta
  items: TechItemDoc[]
}

type Sort = { columnId: string; dir: 1 | -1 }

/**
 * Monday 표 레이아웃 — 보드 칸(meta.columns)과 그룹(meta.groups)을 Monday 그대로 늘어놓고,
 * 칸을 누르면 그 자리에서 고친다(저장은 편집 패널과 같은 길 — 뒤에서 보내고 토스트로 알림).
 * 저장이 끝나기 전에도 고친 값이 칸에 먼저 보인다.
 */
export function MondayBoard({ boardKey, meta, items }: MondayBoardProps) {
  const edit = useBoardEdit()
  const pending = usePendingSaves()
  const nameTitle = NAME_TITLE[boardKey]
  const columns = useMemo(() => meta.columns.filter((c) => !HIDDEN_TYPES.has(c.type)), [meta.columns])
  const peopleColumns = useMemo(() => columns.filter((c) => c.type === 'people'), [columns])

  const [widths, setWidth] = useColumnWidths(boardKey)
  const [collapsed, setCollapsed] = useCollapsedGroups(boardKey)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [person, setPerson] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort | null>(null)
  const [menu, setMenu] = useState<{ kind: 'person' | 'sort'; anchor: HTMLElement } | null>(null)
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [previews, setPreviews] = useState<ReadonlyMap<string, Preview>>(new Map())
  const [creating, setCreating] = useState<{ id: number; groupId: string; name: string }[]>([])
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [limits, setLimits] = useState<Record<string, number>>({})
  const createId = useRef(0)

  const widthOf = useCallback(
    (id: string) => widths[id] ?? (id === 'name' ? NAME_WIDTH : defaultWidth(columns.find((c) => c.id === id)!)),
    [widths, columns],
  )
  const template = `${widthOf('name')}px ${columns.map((c) => `${widthOf(c.id)}px`).join(' ')} minmax(48px, 1fr)`

  const cellOf = useCallback(
    (item: TechItemDoc, column: TechColumn) => {
      const actual = item.values[column.id]
      const preview = previews.get(`${item.itemId}:${column.id}`)
      return preview && preview.base === cellKey(actual) ? preview.cell : actual
    },
    [previews],
  )
  const nameOf = useCallback(
    (item: TechItemDoc) => {
      const preview = previews.get(`${item.itemId}:name`)
      return preview && preview.base === item.name ? preview.cell.text : item.name
    },
    [previews],
  )

  // 미리 보기 하나 걸고, 저장이 끝나면(실패면 바로, 성공이면 잠시 뒤) 뗀다 — 그 사이 같은 칸을
  // 또 고쳤으면 새 미리 보기는 남긴다.
  const showPreview = (key: string, preview: Preview) => {
    setPreviews((m) => new Map(m).set(key, preview))
    return (ok: boolean) => {
      const drop = () =>
        setPreviews((m) => {
          if (m.get(key) !== preview) return m
          const next = new Map(m)
          next.delete(key)
          return next
        })
      if (ok) setTimeout(drop, KEEP_PREVIEW_MS)
      else drop()
    }
  }

  const commitCell = (item: TechItemDoc, column: TechColumn, { state, preview }: CellCommit) => {
    const settle = showPreview(`${item.itemId}:${column.id}`, { base: cellKey(item.values[column.id]), cell: preview })
    saveInBackground(
      'update',
      { boardKey, itemId: item.itemId, columns: { [column.id]: toEditValue(column, state) } },
      `${item.name} · ${column.title}`,
      settle,
    )
  }

  const commitName = (item: TechItemDoc, name: string) => {
    if (name === item.name) return
    const settle = showPreview(`${item.itemId}:name`, { base: item.name, cell: { text: name, value: null } })
    saveInBackground('update', { boardKey, itemId: item.itemId, name }, name, settle)
  }

  const addItem = (groupId: string, name: string) => {
    const id = ++createId.current
    setCreating((list) => [...list, { id, groupId, name }])
    saveInBackground('create', { boardKey, name, groupId }, name, () =>
      setCreating((list) => list.filter((c) => c.id !== id)),
    )
  }

  // 담당자로 거를 사람 — 사람 칸에 나오는 이름, 많이 맡은 순
  const people = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      for (const c of peopleColumns) for (const name of splitNames(item.values[c.id]?.text)) counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  }, [items, peopleColumns])

  const groups: MonGroup[] = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const sortColumn = sort && sort.columnId !== 'name' ? columns.find((c) => c.id === sort.columnId) : null
    const matches = (item: TechItemDoc) =>
      (!person || peopleColumns.some((c) => splitNames(item.values[c.id]?.text).includes(person))) &&
      (!needle ||
        item.name.toLowerCase().includes(needle) ||
        Object.values(item.values).some((v) => v.text?.toLowerCase().includes(needle)))
    const valueOf = (item: TechItemDoc) => (sortColumn ? sortValue(sortColumn, item.values[sortColumn.id]) : item.name)
    const compare = (a: TechItemDoc, b: TechItemDoc) => {
      const x = valueOf(a)
      const y = valueOf(b)
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
      const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ko', { numeric: true })
      return d * (sort?.dir ?? 1)
    }
    const known = new Set(meta.groups.map((g) => g.id))
    const list = [
      ...meta.groups.map((g, i) => ({ id: g.id, title: g.title, color: groupColor(i) })),
      // Monday에서 그룹이 바뀐 뒤 아직 보드 정보가 다시 동기화되지 않았으면 여기 모은다.
      ...(items.some((item) => !item.groupId || !known.has(item.groupId))
        ? [{ id: '__other', title: '그 밖의 항목', color: groupColor(meta.groups.length) }]
        : []),
    ]
    return list.map((g) => {
      const inGroup = items.filter((item) =>
        g.id === '__other' ? !item.groupId || !known.has(item.groupId) : item.groupId === g.id,
      )
      const shown = inGroup.filter(matches)
      return { ...g, items: sort ? [...shown].sort(compare) : shown }
    })
  }, [items, meta.groups, columns, peopleColumns, query, person, sort])

  const filtering = Boolean(query.trim() || person)
  const visibleGroups = filtering ? groups.filter((g) => g.items.length > 0) : groups
  const allCollapsed = visibleGroups.every((g) => collapsed.has(g.id))
  const total = groups.reduce((s, g) => s + g.items.length, 0)
  const sortTitle = sort ? (sort.columnId === 'name' ? nameTitle : columns.find((c) => c.id === sort.columnId)?.title) : null

  return (
    <section className="mon-board" aria-label={meta.name}>
      <div className="mon-toolbar">
        <button type="button" className="mon-primary" onClick={() => edit?.openEditor(null)}>
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
          onClick={() => setCollapsed(visibleGroups.map((g) => g.id), !allCollapsed)}
        >
          {allCollapsed ? <ChevronsUpDown size={15} aria-hidden /> : <ChevronsDownUp size={15} aria-hidden />}
          {allCollapsed ? '모두 펼치기' : '모두 접기'}
        </button>

        <span className="mon-toolbar__count">{filtering ? `${total}개 찾음` : `${total}개 항목`}</span>
      </div>

      <div className="mon-scroll" style={{ '--mon-cols': template } as CSSProperties}>
        {visibleGroups.length === 0 && <p className="mon-empty">조건에 맞는 항목이 없어요.</p>}
        {visibleGroups.map((group) => (
          <GroupTable
            key={group.id}
            group={group}
            columns={columns}
            widthOf={widthOf}
            onResize={setWidth}
            nameTitle={nameTitle}
            collapsed={collapsed.has(group.id)}
            onToggle={() => setCollapsed([group.id], !collapsed.has(group.id))}
            limit={limits[group.id] ?? PAGE}
            onMore={() => setLimits((l) => ({ ...l, [group.id]: (l[group.id] ?? PAGE) + PAGE }))}
            editing={editing}
            setEditing={setEditing}
            cellOf={cellOf}
            nameOf={nameOf}
            commitCell={commitCell}
            commitName={commitName}
            openItem={(itemId) => edit?.openEditor(itemId)}
            addItem={addItem}
            creating={creating.filter((c) => c.groupId === group.id).map((c) => c.name)}
            pending={pending}
            subColumns={meta.subitems?.columns ?? null}
            expanded={expanded}
            toggleExpanded={(itemId) =>
              setExpanded((s) => {
                const next = new Set(s)
                if (!next.delete(itemId)) next.add(itemId)
                return next
              })
            }
          />
        ))}
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

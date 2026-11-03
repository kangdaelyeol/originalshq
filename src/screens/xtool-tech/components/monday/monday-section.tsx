import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { TechBoardKey, TechBoardMeta, TechCellValue, TechColumn, TechItemDoc } from '../../data/tech-boards'
import { toEditValue } from '../../data/tech-edit'
import { saveInBackground, usePendingSaves } from '../../data/tech-save-queue'
import { cx } from '../../lib/cx'
import { groupColor } from './monday-colors'
import type { CellCommit } from './monday-editors'
import { GroupTable, type EditingCell, type MonGroup } from './monday-group'
import {
  defaultWidth,
  groupIdOf,
  NAME_TITLE,
  NAME_WIDTH,
  OTHER_GROUP,
  PHONE_IN_NAME_BOARDS,
  sortValue,
  splitNamePhone,
  SUB_NAME_TITLE,
  UPDATE_BOARDS,
  visibleColumns,
  type MonSort,
} from './monday-values'
import { FilesModal } from './monday-files-modal'
import { useOptimistic } from './monday-optimistic'
import { selectionKey } from './monday-selection'
import { UpdatesPanel } from './monday-updates-panel'
import { useColumnWidths } from './use-monday-prefs'

// 그룹마다 처음 그릴 줄 수 — 완료 그룹은 수천 건이라 나눠 그린다.
const PAGE = 50
// 저장에 성공한 뒤 먼저 보여 준 값을 지키는 시간 — 그 사이 실시간 구독으로 새 값이 온다.
const KEEP_PREVIEW_MS = 3000

interface Preview {
  /** 고치기 전 캐시 값 — 캐시가 이 값에서 바뀌면(저장 반영) 미리 보기를 버린다. */
  base: string
  cell: TechCellValue
}

const cellKey = (cell: TechCellValue | undefined) => `${cell?.text ?? ''}\u0000${cell?.value ?? ''}`

export interface MondaySectionProps {
  boardKey: TechBoardKey
  meta: TechBoardMeta
  /** 보여 줄 항목 — 거르기(검색·사람·내 업무)는 부르는 쪽이 끝낸 것 */
  items: TechItemDoc[]
  /** 거르는 중이면 빈 그룹은 숨긴다. */
  hideEmptyGroups: boolean
  sort: MonSort
  onSort: (columnId: string) => void
  collapsed: ReadonlySet<string>
  setCollapsed: (ids: string[], collapsed: boolean) => void
  /** 옆·위아래 스크롤을 이 구역 안에서 — 내 업무의 보드 박스(칸 수가 다른 보드를 쌓는다) */
  ownScroll?: boolean
  /** 그룹 맨 아래 "+ 추가" 줄 — 내 업무에서는 끈다(새 항목은 담당자가 비어 있어 목록에서 사라진다). */
  allowAdd?: boolean
}

/**
 * 보드 한 장 분량의 Monday 표 — 그룹마다 색 막대·머리글·줄·요약. 칸을 누르면 그 자리에서 고친다
 * (저장은 편집 패널과 같은 길 — 뒤에서 보내고 토스트로 알림). 저장이 끝나기 전에도 고친 값이 먼저
 * 보인다. 칸 너비는 구역마다(--mon-cols) — 내 업무처럼 여러 보드를 쌓아도 보드마다 제 칸으로 그린다.
 */
export function MondaySection(props: MondaySectionProps) {
  const { boardKey, meta, items, hideEmptyGroups, sort, onSort, collapsed, setCollapsed, ownScroll = false, allowAdd = true } = props
  const pending = usePendingSaves()
  const nameTitle = NAME_TITLE[boardKey]
  const columns = useMemo(() => visibleColumns(meta), [meta])

  const [widths, setWidth] = useColumnWidths(boardKey)
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [previews, setPreviews] = useState<ReadonlyMap<string, Preview>>(new Map())
  const [creating, setCreating] = useState<{ id: number; groupId: string; name: string }[]>([])
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [limits, setLimits] = useState<Record<string, number>>({})
  // 만드는 중인 하위 아이템(저장이 끝나기 전에 먼저 보여 준다)
  const [creatingSubs, setCreatingSubs] = useState<{ id: number; itemId: string; name: string }[]>([])
  // 지우는 중(숨김)·그룹을 옮기는 중(새 그룹) — 선택 막대가 건다.
  const optimistic = useOptimistic()
  // 업데이트(말풍선) 패널을 연 항목
  const [updatesFor, setUpdatesFor] = useState<string | null>(null)
  // 파일 칸 모달을 연 항목·칸
  const [filesFor, setFilesFor] = useState<{ itemId: string; columnId: string } | null>(null)
  // 이름에 적힌 전화번호는 전화번호 칸에 있으니 이름 칸에서는 뗀다(Monday 이름은 그대로).
  const stripPhone = PHONE_IN_NAME_BOARDS.has(boardKey)
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
      const name = preview && preview.base === item.name ? preview.cell.text : item.name
      return stripPhone ? splitNamePhone(name).label : name
    },
    [previews, stripPhone],
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

  const commitName = (item: TechItemDoc, label: string) => {
    // 번호를 떼고 보여 준 이름이면 고친 이름 뒤에 원래 번호를 다시 붙여 Monday에 쓴다 — 고친 이름에
    // 번호를 직접 적었거나(번호를 바꾼 것), 번호만 있어 떼지 못한 이름이면 적은 그대로 쓴다.
    const original = stripPhone ? splitNamePhone(item.name) : { label: item.name, phones: '' }
    const reattach = original.phones && original.label !== item.name && !splitNamePhone(label).phones
    const name = reattach ? `${label} ${original.phones}` : label
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

  // 하위 아이템 "+ 추가" — 이름만 적어 그 항목 아래에 만든다. 끝날 때까지 하위 표에 먼저 보인다.
  const addSubitem = (item: TechItemDoc, name: string) => {
    const id = ++createId.current
    setCreatingSubs((list) => [...list, { id, itemId: item.itemId, name }])
    saveInBackground(
      'update',
      { boardKey, itemId: item.itemId, subitems: { create: [{ name }] } },
      `${item.name} · ${name}`,
      () => setCreatingSubs((list) => list.filter((c) => c.id !== id)),
    )
  }

  const groups: MonGroup[] = useMemo(() => {
    const sortColumn = sort && sort.columnId !== 'name' ? columns.find((c) => c.id === sort.columnId) : null
    const valueOf = (item: TechItemDoc) => (sortColumn ? sortValue(sortColumn, item.values[sortColumn.id]) : item.name)
    const compare = (a: TechItemDoc, b: TechItemDoc) => {
      const x = valueOf(a)
      const y = valueOf(b)
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
      const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ko', { numeric: true })
      return d * (sort?.dir ?? 1)
    }
    const live = items.filter((item) => !optimistic.hidden.has(selectionKey(boardKey, item.itemId)))
    const groupOf = (item: TechItemDoc) => optimistic.moved.get(selectionKey(boardKey, item.itemId)) ?? groupIdOf(meta, item)
    const list = [
      ...meta.groups.map((g, i) => ({ id: g.id, title: g.title, color: groupColor(i) })),
      ...(live.some((item) => groupOf(item) === OTHER_GROUP)
        ? [{ id: OTHER_GROUP, title: '그 밖의 항목', color: groupColor(meta.groups.length) }]
        : []),
    ]
    return list.map((g) => {
      const inGroup = live.filter((item) => groupOf(item) === g.id)
      return { ...g, items: sort ? [...inGroup].sort(compare) : inGroup }
    })
  }, [items, meta, columns, sort, optimistic, boardKey])

  const shown = hideEmptyGroups ? groups.filter((g) => g.items.length > 0) : groups
  const updatesItem = updatesFor ? items.find((item) => item.itemId === updatesFor) : undefined
  const filesItem = filesFor ? items.find((item) => item.itemId === filesFor.itemId) : undefined
  const filesColumn = filesFor ? columns.find((c) => c.id === filesFor.columnId) : undefined

  return (
    <div className={cx('mon-section', ownScroll && 'mon-section--own-scroll')} style={{ '--mon-cols': template } as CSSProperties}>
      {shown.map((group) => (
        <GroupTable
          key={group.id}
          boardKey={boardKey}
          group={group}
          sort={sort}
          onSort={onSort}
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
          openFiles={(item, column) => setFilesFor({ itemId: item.itemId, columnId: column.id })}
          addItem={allowAdd ? addItem : null}
          addSubitem={addSubitem}
          creatingSubs={(itemId) => creatingSubs.filter((c) => c.itemId === itemId).map((c) => c.name)}
          openUpdates={UPDATE_BOARDS.has(boardKey) ? (item) => setUpdatesFor(item.itemId) : null}
          updatesOpenFor={updatesFor}
          creating={creating.filter((c) => c.groupId === group.id).map((c) => c.name)}
          pending={pending}
          subColumns={meta.subitems?.columns ?? null}
          subNameTitle={SUB_NAME_TITLE[boardKey] ?? '하위 아이템'}
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
      {filesItem && filesColumn && (
        <FilesModal
          boardKey={boardKey}
          item={filesItem}
          column={filesColumn}
          itemName={nameOf(filesItem)}
          onClose={() => setFilesFor(null)}
        />
      )}
      {updatesItem && (
        // key — 다른 항목을 열면 새로 그린다(쓰던 글·답글 대상·늦게 온 응답이 섞이지 않게).
        <UpdatesPanel
          key={updatesItem.itemId}
          boardKey={boardKey}
          itemId={updatesItem.itemId}
          title={nameOf(updatesItem)}
          onClose={() => setUpdatesFor(null)}
        />
      )}
    </div>
  )
}

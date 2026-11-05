import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import type { TechBoardKey, TechBoardMeta, TechColumn, TechItemDoc, TechSubitemDoc } from '../../data/tech-boards'
import { initialState, toEditValue } from '../../data/tech-edit'
import { createItem, editItem } from '../../data/tech-outbox'
import { priceColumn, relationColumn } from '../../data/tech-subitems'
import { cx } from '@/ohq-ui/lib/cx'
import { useStableHandlers } from '../../lib/use-stable-handlers'
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
  previewCell,
  rowKey,
  sortValue,
  splitNamePhone,
  SUB_NAME_TITLE,
  UPDATE_BOARDS,
  visibleColumns,
  type MonSort,
} from './monday-values'
import { FilesModal } from './monday-files-modal'
import { UpdatesPanel } from './monday-updates-panel'
import { useColumnWidths } from './use-monday-prefs'

// 그룹마다 처음 그릴 줄 수 — 완료 그룹은 수천 건이라 나눠 그린다.
const PAGE = 50

/** 이 탭에서 만든 항목의 순서(임시 id 번호) — 아니면 null */
const createdRank = (item: TechItemDoc) => (item.localKey ? Number(item.localKey.replace(/\D/g, '')) : null)

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
  /** 내 업무의 보드 박스 안 — 박스 여백 안에 그린다(스크롤은 판 전체, 칸 머리글은 박스 머리 아래에 붙는다) */
  boxed?: boolean
  /** 그룹 맨 아래 "+ 추가" 줄 — 내 업무에서는 끈다(새 항목은 담당자가 비어 있어 목록에서 사라진다). */
  allowAdd?: boolean
  /** 숨길 칸 id — 고른 보기의 숨길 칸 */
  hiddenColumns?: readonly string[]
}

/**
 * 보드 한 장 분량의 Monday 표 — 그룹마다 색 막대·머리글·줄·요약. 칸을 누르면 그 자리에서 고친다.
 * 고친 값·새 항목은 저장 대기열(tech-outbox)이 바로 보이게 하고 Monday에는 뒤에서 쓴다 — 표는
 * 항목(items)에 덮인 값을 그리기만 한다. 칸 너비는 구역마다(--mon-cols) — 내 업무처럼 여러 보드를
 * 쌓아도 보드마다 제 칸으로 그린다.
 */
export function MondaySection(props: MondaySectionProps) {
  const { boardKey, meta, items, hideEmptyGroups, sort, onSort, collapsed, setCollapsed, boxed = false, allowAdd = true, hiddenColumns } = props
  const nameTitle = NAME_TITLE[boardKey]
  const allColumns = useMemo(() => visibleColumns(meta), [meta])
  // 그릴 칸 — 보기의 숨길 칸은 뺀다(정렬은 숨긴 칸으로도 된다 — allColumns)
  const columns = useMemo(() => allColumns.filter((c) => !hiddenColumns?.includes(c.id)), [allColumns, hiddenColumns])

  const [widths, setWidth] = useColumnWidths(boardKey)
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [limits, setLimits] = useState<Record<string, number>>({})
  // 업데이트(말풍선) 패널을 연 항목
  const [updatesFor, setUpdatesFor] = useState<string | null>(null)
  // 파일 칸 모달을 연 항목·칸
  const [filesFor, setFilesFor] = useState<{ itemId: string; columnId: string } | null>(null)
  // 이름에 적힌 전화번호는 전화번호 칸에 있으니 이름 칸에서는 뗀다(Monday 이름은 그대로).
  const stripPhone = PHONE_IN_NAME_BOARDS.has(boardKey)

  const widthOf = useCallback(
    (id: string) => widths[id] ?? (id === 'name' ? NAME_WIDTH : defaultWidth(columns.find((c) => c.id === id)!)),
    [widths, columns],
  )
  const template = `${widthOf('name')}px ${columns.map((c) => `${widthOf(c.id)}px`).join(' ')} minmax(48px, 1fr)`

  const nameOf = useCallback(
    (item: TechItemDoc) => (stripPhone ? splitNamePhone(item.name).label : item.name),
    [stripPhone],
  )

  const commitCell = (item: TechItemDoc, column: TechColumn, { state, preview }: CellCommit) => {
    editItem(boardKey, item.itemId, { columns: { [column.id]: { value: toEditValue(column, state), preview } } }, `${nameOf(item)} · ${column.title}`)
  }

  const commitName = (item: TechItemDoc, label: string) => {
    // 번호를 떼고 보여 준 이름이면 고친 이름 뒤에 원래 번호를 다시 붙여 Monday에 쓴다 — 고친 이름에
    // 번호를 직접 적었거나(번호를 바꾼 것), 번호만 있어 떼지 못한 이름이면 적은 그대로 쓴다.
    const original = stripPhone ? splitNamePhone(item.name) : { label: item.name, phones: '' }
    const reattach = original.phones && original.label !== item.name && !splitNamePhone(label).phones
    const name = reattach ? `${label} ${original.phones}` : label
    if (name === item.name) return
    editItem(boardKey, item.itemId, { name }, label)
  }

  // 새 항목 — 그 그룹 맨 아래에 바로 줄이 생기고 고칠 수 있다(만들기는 뒤에서).
  const addItem = (groupId: string, name: string) => {
    createItem(boardKey, { name, groupId: groupId === OTHER_GROUP ? undefined : groupId })
  }

  // 하위 아이템 "+ 추가" — 이름만 적어 그 항목 아래에 만든다.
  const addSubitem = (item: TechItemDoc, name: string) => {
    editItem(boardKey, item.itemId, { subitems: { create: [{ name }] } }, `${nameOf(item)} · ${name}`)
  }

  // 하위 아이템 고치기·지우기 — 항목 칸처럼 바로 보이고 뒤에서 쓴다. 고칠 칸·연결 칸·금액 칸은
  // 대시보드 편집 패널과 같은 규칙(tech-subitems).
  const subColumns = meta.subitems?.columns ?? null
  const updateSubitem = (item: TechItemDoc, sub: TechSubitemDoc, name: string | undefined, cells: [TechColumn, CellCommit][]) => {
    editItem(
      boardKey,
      item.itemId,
      {
        subitems: {
          update: [
            {
              id: sub.id,
              ...(name !== undefined ? { name } : {}),
              columns: Object.fromEntries(cells.map(([c, { state }]) => [c.id, toEditValue(c, state)])),
            },
          ],
        },
        subitemPreviews: { [sub.id]: Object.fromEntries(cells.map(([c, { preview }]) => [c.id, preview])) },
      },
      `${nameOf(item)} · ${name ?? sub.name}`,
    )
  }

  const commitSubCell = (item: TechItemDoc, sub: TechSubitemDoc, column: TechColumn, commit: CellCommit) => {
    const cells: [TechColumn, CellCommit][] = [[column, commit]]
    let name: string | undefined
    // 부품(연결 칸)을 고르면 줄 이름은 고른 부품 이름, 금액이 비어 있으면 부품 비용으로 채운다.
    const part = column.id === relationColumn(subColumns ?? [])?.id ? commit.picked?.[0] : undefined
    if (part) {
      const record = part.record as { name?: string; cost?: unknown }
      const partName = (record.name || part.name).trim()
      if (partName && partName !== sub.name) name = partName
      const price = priceColumn(subColumns ?? [])
      if (price && typeof record.cost === 'number' && !initialState(price, sub.values[price.id])) {
        const cost = String(record.cost)
        cells.push([price, { state: cost, preview: previewCell(price, cost) }])
      }
    }
    updateSubitem(item, sub, name, cells)
  }

  const commitSubName = (item: TechItemDoc, sub: TechSubitemDoc, name: string) => {
    if (name !== sub.name) updateSubitem(item, sub, name, [])
  }

  // 지우기 — 줄이 바로 빠지고 Monday 휴지통으로 보낸다(실패하면 다시 보인다).
  const removeSubitem = (item: TechItemDoc, sub: TechSubitemDoc) => {
    editItem(boardKey, item.itemId, { subitems: { remove: [sub.id] } }, `${nameOf(item)} · ${sub.name} 삭제`)
  }

  const groups: MonGroup[] = useMemo(() => {
    const sortColumn = sort && sort.columnId !== 'name' ? allColumns.find((c) => c.id === sort.columnId) : null
    const valueOf = (item: TechItemDoc) => (sortColumn ? sortValue(sortColumn, item.values[sortColumn.id]) : item.name)
    const compare = (a: TechItemDoc, b: TechItemDoc) => {
      const x = valueOf(a)
      const y = valueOf(b)
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
      const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ko', { numeric: true })
      return d * (sort?.dir ?? 1)
    }
    const list = [
      ...meta.groups.map((g, i) => ({ id: g.id, title: g.title, color: groupColor(i) })),
      ...(items.some((item) => groupIdOf(meta, item) === OTHER_GROUP)
        ? [{ id: OTHER_GROUP, title: '그 밖의 항목', color: groupColor(meta.groups.length) }]
        : []),
    ]
    return list.map((g) => {
      const inGroup = items.filter((item) => groupIdOf(meta, item) === g.id)
      if (sort) return { ...g, items: [...inGroup].sort(compare) }
      // 이 탭에서 만든 항목은 적은 자리(그룹 맨 아래)에 만든 순서로 — 새로고침하면 캐시 순서(새것 위)
      const made = inGroup.filter((item) => createdRank(item) !== null).sort((a, b) => createdRank(a)! - createdRank(b)!)
      return { ...g, items: made.length ? [...inGroup.filter((item) => createdRank(item) === null), ...made] : inGroup }
    })
  }, [items, meta, allColumns, sort])

  // 줄에 넘길 핸들러 — 늘 같은 함수로(줄이 memo라, 칸 하나를 고칠 때 다른 줄은 다시 그리지 않는다)
  const handlers = useStableHandlers({
    commitCell,
    commitName,
    openFiles: (item: TechItemDoc, column: TechColumn) => setFilesFor({ itemId: rowKey(item), columnId: column.id }),
    addItem: allowAdd ? addItem : null,
    addSubitem,
    commitSubCell,
    commitSubName,
    removeSubitem,
    openUpdates: UPDATE_BOARDS.has(boardKey) ? (item: TechItemDoc) => setUpdatesFor(rowKey(item)) : null,
    toggleExpanded: (itemId: string) =>
      setExpanded((s) => {
        const next = new Set(s)
        if (!next.delete(itemId)) next.add(itemId)
        return next
      }),
  })

  const shown = hideEmptyGroups ? groups.filter((g) => g.items.length > 0) : groups
  const updatesItem = updatesFor ? items.find((item) => rowKey(item) === updatesFor) : undefined
  const filesItem = filesFor ? items.find((item) => rowKey(item) === filesFor.itemId) : undefined
  const filesColumn = filesFor ? columns.find((c) => c.id === filesFor.columnId) : undefined

  return (
    <div className={cx('mon-section', boxed && 'mon-section--boxed')} style={{ '--mon-cols': template } as CSSProperties}>
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
          nameOf={nameOf}
          {...handlers}
          updatesOpenFor={updatesFor}
          subColumns={subColumns}
          subNameTitle={SUB_NAME_TITLE[boardKey] ?? '하위 아이템'}
          expanded={expanded}
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

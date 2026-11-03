import { ChevronDown, ChevronRight, LoaderCircle, MessageCircle, MessageCirclePlus } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { TechBoardKey, TechColumn, TechItemDoc, TechSubitemDoc } from '../../data/tech-boards'
import {
  formatPhoneTyping,
  initialState,
  isPartialPhone,
  isPhoneColumn,
  isPhoneLike,
  isWritable,
  type EditState,
} from '../../data/tech-edit'
import { pushToast } from '../../data/tech-save-queue'
import { cx } from '../../lib/cx'
import { isComposing } from '../../lib/ime'
import { formatInt } from '../../lib/format'
import { labelColor } from './monday-colors'
import { CellView } from './monday-cells'
import { CellEditor, InlineInput, type CellCommit } from './monday-editors'
import { selectionKey, useSelection } from './monday-selection'
import { cellClass, cellStyle, HIDDEN_TYPES, INLINE_TYPES, MIN_WIDTH, previewCell, rowKey, type MonSort } from './monday-values'

export interface MonGroup {
  id: string
  title: string
  color: string
  items: TechItemDoc[]
}

/** 지금 고치는 칸 — 팝오버는 그 칸 요소를 따라 뜬다. */
export interface EditingCell {
  key: string
  anchor: HTMLElement
}

export interface GroupTableProps {
  boardKey: TechBoardKey
  group: MonGroup
  sort: MonSort
  /** 머리글 정렬 단추 — 누를 때마다 오름차순 → 내림차순 → 해제 */
  onSort: (columnId: string) => void
  columns: TechColumn[]
  /** 칸 너비(px) — 이름 칸은 'name' */
  widthOf: (id: string) => number
  onResize: (id: string, width: number) => void
  /** 이름 칸 머리글(고객·업무 …) */
  nameTitle: string
  collapsed: boolean
  onToggle: () => void
  limit: number
  onMore: () => void
  editing: EditingCell | null
  setEditing: (editing: EditingCell | null) => void
  nameOf: (item: TechItemDoc) => string
  commitCell: (item: TechItemDoc, column: TechColumn, commit: CellCommit) => void
  commitName: (item: TechItemDoc, name: string) => void
  /** 파일 칸 모달 열기 */
  openFiles: (item: TechItemDoc, column: TechColumn) => void
  /** 그룹 맨 아래 "+ 추가" — null이면 줄을 그리지 않는다(내 업무). */
  addItem: ((groupId: string, name: string) => void) | null
  /** 하위 아이템 "+ 추가" — 이름만 적어 만든다. */
  addSubitem: (item: TechItemDoc, name: string) => void
  /** 하위 아이템 이름 칸 머리글(품목명·부품명) */
  subNameTitle: string
  /** 업데이트(말풍선) 패널 열기 — 말풍선이 없는 보드면 null */
  openUpdates: ((item: TechItemDoc) => void) | null
  /** 지금 패널이 열린 줄(rowKey) */
  updatesOpenFor: string | null
  subColumns: TechColumn[] | null
  /** 하위 아이템을 펼친 줄(rowKey) */
  expanded: ReadonlySet<string>
  toggleExpanded: (key: string) => void
}

/** 칸 머리글 오른쪽 끝을 끌어 너비를 바꾼다. */
function ResizeHandle({ id, width, onResize }: { id: string; width: number; onResize: (id: string, width: number) => void }) {
  const start = useRef<{ x: number; width: number } | null>(null)
  return (
    <span
      className="mon-resize"
      aria-hidden
      onPointerDown={(e: ReactPointerEvent) => {
        e.preventDefault()
        e.stopPropagation()
        start.current = { x: e.clientX, width }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        onResize(id, Math.max(MIN_WIDTH, start.current.width + e.clientX - start.current.x))
      }}
      onPointerUp={() => {
        start.current = null
      }}
      // 끌다가 포인터를 놓쳐도(창 밖·취소) 다음 움직임이 너비를 바꾸지 않게
      onPointerCancel={() => {
        start.current = null
      }}
      onLostPointerCapture={() => {
        start.current = null
      }}
    />
  )
}

const ariaSort = (sort: MonSort, id: string) =>
  sort?.columnId === id ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined

/**
 * 그룹 끝 자동 불러오기 — 이 줄이 스크롤 상자 바닥 근처(400px 전)에 오면 다음 줄들을 붙인다
 * ("더 보기"를 누르지 않게). 붙인 뒤에도 아직 보이면 다시 붙도록, 남은 수가 바뀔 때마다 새로 지켜본다.
 */
function AutoMore({ remaining, onMore }: { remaining: number; onMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const onMoreRef = useRef(onMore)
  useEffect(() => {
    onMoreRef.current = onMore
  })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // 표가 스스로 스크롤된다 — 내 업무의 보드 박스면 그 박스, 아니면 판
    const root = el.closest<HTMLElement>('.mon-section--own-scroll, .mon-scroll')
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onMoreRef.current()
      },
      { root, rootMargin: '0px 0px 400px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [remaining])
  return (
    <div ref={ref} className="mon-more" role="status">
      <LoaderCircle size={13} className="is-spinning" aria-hidden />
      {remaining}개 더 불러오는 중…
    </div>
  )
}

/** 줄 고르기 체크박스(Monday) — 머리글은 그룹 전체, 일부만 골랐으면 가운데 선(indeterminate). */
function RowCheck({ checked, mixed, label, onChange }: { checked: boolean; mixed?: boolean; label: string; onChange: (on: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(mixed)
  }, [mixed])
  return (
    <input
      ref={ref}
      type="checkbox"
      className="mon-check-row"
      checked={checked}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

/** 머리글에 올리면 위 테두리에 걸쳐 뜨는 정렬 단추(Monday) — 정렬 중이면 늘 보이고 방향 삼각형이 밝다. */
function SortButton({ id, title, sort, onSort }: { id: string; title: string; sort: MonSort; onSort: (id: string) => void }) {
  const dir = sort?.columnId === id ? sort.dir : 0
  return (
    <button
      type="button"
      className={cx('mon-sort', dir === 1 && 'is-asc', dir === -1 && 'is-desc')}
      aria-label={`${title} ${dir === 1 ? '내림차순으로' : dir === -1 ? '정렬 해제' : '오름차순으로'} 정렬`}
      title={dir === 1 ? '오름차순 — 누르면 내림차순' : dir === -1 ? '내림차순 — 누르면 정렬 해제' : '정렬'}
      onClick={() => onSort(id)}
    >
      <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden>
        <path className="mon-sort__up" d="M4 0.5 7.5 5H0.5z" />
        <path className="mon-sort__down" d="M4 11.5 0.5 7h7z" />
      </svg>
    </button>
  )
}

/** 그룹 아래 요약 — 상태 칸은 라벨 비율 막대, 숫자 칸은 합계(Monday 그룹 바닥 줄). */
function SummaryCell({ column, items }: { column: TechColumn; items: TechItemDoc[] }) {
  if (column.type === 'status') {
    const counts = new Map<string, number>()
    for (const item of items) {
      const label = item.values[column.id]?.text ?? ''
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    const total = items.length
    return (
      <div className="mon-cell mon-summary__cell">
        {total > 0 && (
          <span className="mon-battery" title={[...counts].map(([label, n]) => `${label || '비어 있음'} ${n}`).join(' · ')}>
            {[...counts].map(([label, n]) => (
              <span key={label} style={{ flexGrow: n, '--label': labelColor(label) } as CSSProperties} />
            ))}
          </span>
        )}
      </div>
    )
  }
  if (column.type === 'numbers') {
    const sum = items.reduce((s, item) => s + (Number((item.values[column.id]?.text ?? '').replace(/,/g, '')) || 0), 0)
    return (
      <div className="mon-cell mon-summary__cell">
        <span className="mon-summary__sum">
          {formatInt(sum)}
          <small>합계</small>
        </span>
      </div>
    )
  }
  return <div className="mon-cell mon-summary__cell" />
}

// 하위 표에 안 그리는 칸 — 생성 로그
const SUB_HIDDEN_TYPES = new Set(['creation_log'])
const SUB_NAME_WIDTH = 340
const SUB_WIDTH = 130

/**
 * 하위 아이템(출장 설치 품목·AS 청구 부품) — Monday처럼 줄 아래로 들여 펼친다. 왼쪽 줄기에서
 * 줄마다 둥글게 꺾인 가지가 나오고, 맨 아래 "+ 품목명 추가"로 이름만 적어 새 줄을 만든다(바로
 * 보이고 뒤에서 만든다). 칸 고치기는 "열기"의 편집 패널에서.
 */
function SubTable({
  columns,
  subitems,
  nameTitle,
  onAdd,
}: {
  columns: TechColumn[]
  subitems: TechSubitemDoc[]
  nameTitle: string
  onAdd: (name: string) => void
}) {
  const shown = columns.filter((c) => !HIDDEN_TYPES.has(c.type) && !SUB_HIDDEN_TYPES.has(c.type))
  const template = `${SUB_NAME_WIDTH}px ${shown.map(() => `${SUB_WIDTH}px`).join(' ')}`
  return (
    <div className="mon-sub" role="rowgroup" aria-label={`하위 아이템 ${subitems.length}개`} style={{ '--sub-cols': template } as CSSProperties}>
      <span className="mon-sub__trunk" aria-hidden />
      <div className="mon-sub__row mon-sub__row--head" role="row">
        <div className="mon-cell mon-sub__name" role="columnheader">
          <span className="mon-text">{nameTitle}</span>
        </div>
        {shown.map((c) => (
          <div key={c.id} className="mon-cell" role="columnheader" title={c.title}>
            <span className="mon-text">{c.title}</span>
          </div>
        ))}
      </div>
      {subitems.map((sub) => (
        <div key={sub.id} className="mon-sub__row mon-sub__row--item" role="row">
          <div className="mon-cell mon-sub__name" role="rowheader" title={sub.name}>
            <span className="mon-text">{sub.name}</span>
          </div>
          {shown.map((c) => (
            <div key={c.id} className={cellClass(c)} style={cellStyle(c, sub.values[c.id])} role="gridcell">
              <CellView column={c} cell={sub.values[c.id]} />
            </div>
          ))}
        </div>
      ))}
      <div className="mon-sub__row mon-sub__row--item mon-sub__row--add" role="row">
        <div className="mon-cell mon-sub__name" role="rowheader">
          <AddInput label={nameTitle} onAdd={onAdd} />
        </div>
      </div>
    </div>
  )
}

/** 그룹 하나 — 색 막대가 붙은 제목, 머리글, 줄들, "+ 추가" 줄, 요약 줄. */
export function GroupTable(props: GroupTableProps) {
  const { boardKey, group, columns, widthOf, onResize, nameTitle, collapsed, onToggle, limit, onMore, sort, onSort } = props
  const selection = useSelection()
  const groupIds = group.items.map(rowKey)
  const pickedCount = selection ? groupIds.filter((id) => selection.selected.has(selectionKey(boardKey, id))).length : 0
  const style = { '--group': group.color } as CSSProperties
  const Chevron = collapsed ? ChevronRight : ChevronDown

  return (
    <section className={cx('mon-group', collapsed && 'is-collapsed')} style={style} role="table" aria-label={group.title}>
      {/* 제목 줄은 위에 붙고(그 아래 칸 머리글), 안의 글자는 옆으로 밀어도 왼쪽에 붙는다. */}
      <div className="mon-group__title">
        <div className="mon-group__title-inner">
          <button type="button" className="mon-group__toggle" aria-expanded={!collapsed} onClick={onToggle}>
            <Chevron size={18} strokeWidth={2.2} aria-hidden />
            <span className="mon-group__name">{group.title}</span>
          </button>
          <span className="mon-group__count">{group.items.length}개 항목</span>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="mon-row mon-row--head" role="row">
            <div className="mon-cell mon-cell--name" role="columnheader" aria-sort={ariaSort(sort, 'name')}>
              {selection && (
                <RowCheck
                  checked={groupIds.length > 0 && pickedCount === groupIds.length}
                  mixed={pickedCount > 0 && pickedCount < groupIds.length}
                  label={`${group.title} 모두 고르기`}
                  onChange={(on) => selection.set(boardKey, groupIds, on)}
                />
              )}
              <SortButton id="name" title={nameTitle} sort={sort} onSort={onSort} />
              <span className="mon-text">{nameTitle}</span>
              <ResizeHandle id="name" width={widthOf('name')} onResize={onResize} />
            </div>
            {columns.map((c) => (
              <div key={c.id} className="mon-cell" role="columnheader" title={c.title} aria-sort={ariaSort(sort, c.id)}>
                <SortButton id={c.id} title={c.title} sort={sort} onSort={onSort} />
                <span className="mon-text">{c.title}</span>
                <ResizeHandle id={c.id} width={widthOf(c.id)} onResize={onResize} />
              </div>
            ))}
            <div className="mon-cell mon-cell--end" aria-hidden />
          </div>

          {group.items.slice(0, limit).map((item) => (
            <ItemRow key={rowKey(item)} item={item} {...props} />
          ))}

          {group.items.length > limit && <AutoMore remaining={group.items.length - limit} onMore={onMore} />}

          {props.addItem && <AddRow nameTitle={nameTitle} onAdd={(name) => props.addItem?.(group.id, name)} />}

          <div className="mon-row mon-summary" role="row" aria-label="요약">
            <div className="mon-cell mon-cell--name mon-summary__lead" />
            {columns.map((c) => (
              <SummaryCell key={c.id} column={c} items={group.items} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/**
 * "+ 고객 추가" 입력 — 이름만 적고 엔터(또는 바깥 누르기)면 만든다. Esc는 취소 — blur가 같은 차례에
 * 저장을 부르므로(아직 지우기 전 값) 취소 표시를 ref로 먼저 세운다.
 */
function AddInput({ label, onAdd }: { label: string; onAdd: (name: string) => void }) {
  const [value, setValue] = useState('')
  const cancelled = useRef(false)
  const submit = () => {
    const name = value.trim()
    if (cancelled.current) {
      cancelled.current = false
      return
    }
    if (!name) return
    onAdd(name)
    setValue('')
  }
  return (
    <input
      className="mon-add"
      placeholder={`+ ${label} 추가`}
      aria-label={`${label} 추가`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isComposing(e)) {
          e.preventDefault()
          submit()
        } else if (e.key === 'Escape') {
          cancelled.current = true
          setValue('')
          e.currentTarget.blur()
        }
      }}
    />
  )
}

/** 맨 아래 "+ 고객 추가" 줄 — 이 그룹에 새 항목을 만든다. */
function AddRow({ nameTitle, onAdd }: { nameTitle: string; onAdd: (name: string) => void }) {
  return (
    <div className="mon-row mon-row--add" role="row">
      <div className="mon-cell mon-cell--name" role="rowheader">
        <AddInput label={nameTitle} onAdd={onAdd} />
      </div>
      <div className="mon-cell mon-row__fill" aria-hidden />
    </div>
  )
}

// 서버가 업데이트를 이 수까지만 센다(functions-xtool monday-api.ts UPDATE_COUNT_LIMIT)
const UPDATE_COUNT_LIMIT = 20

/** 이름 칸 오른쪽 말풍선 — 업데이트가 있으면 개수 배지, 없으면 +가 붙은 말풍선(Monday). */
function UpdatesButton({ count, active, label, onClick }: { count: number; active: boolean; label: string; onClick: () => void }) {
  const Icon = count > 0 ? MessageCircle : MessageCirclePlus
  return (
    <button
      type="button"
      className={cx('mon-updates', count > 0 && 'has-updates', active && 'is-active')}
      aria-label={`${label} 업데이트 ${count}개`}
      title={count > 0 ? `업데이트 ${count}개` : '업데이트 쓰기'}
      onClick={onClick}
    >
      <Icon size={19} strokeWidth={2.6} aria-hidden />
      {count > 0 && <span className="mon-updates__count">{count >= UPDATE_COUNT_LIMIT ? `${UPDATE_COUNT_LIMIT}+` : count}</span>}
    </button>
  )
}

function ItemRow({ item, ...props }: GroupTableProps & { item: TechItemDoc }) {
  const { columns, editing, setEditing, nameOf, commitName, subColumns, expanded } = props
  const key = rowKey(item)
  const nameKey = `${key}:name`
  const subCount = item.subitems?.length ?? 0
  const open = expanded.has(key)
  const Chevron = open ? ChevronDown : ChevronRight
  const selection = useSelection()
  const picked = selection?.selected.has(selectionKey(props.boardKey, key)) ?? false

  return (
    <>
      <div className={cx('mon-row', picked && 'is-selected')} role="row" aria-selected={picked}>
        <div className="mon-cell mon-cell--name" role="rowheader">
          {selection && (
            <RowCheck
              checked={picked}
              label={`${nameOf(item)} 고르기`}
              onChange={(on) => selection.set(props.boardKey, [key], on)}
            />
          )}
          {subColumns && (
            <button
              type="button"
              className={cx('mon-expand', subCount === 0 && !open && 'is-empty')}
              aria-expanded={open}
              aria-label={`하위 아이템 ${subCount}개 ${open ? '접기' : '펼치기'}`}
              onClick={() => props.toggleExpanded(key)}
            >
              <Chevron size={14} strokeWidth={2.2} aria-hidden />
            </button>
          )}
          {editing?.key === nameKey ? (
            <InlineInput
              initial={nameOf(item)}
              label="이름"
              onCommit={(name) => {
                setEditing(null)
                if (name.trim()) commitName(item, name.trim())
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <button
              type="button"
              className="mon-name"
              title={nameOf(item)}
              onClick={(e) => setEditing({ key: nameKey, anchor: e.currentTarget })}
            >
              {nameOf(item)}
            </button>
          )}
          {subCount > 0 && <span className="mon-subcount">{subCount}</span>}
          {/* 만드는 중인 항목은 Monday에 아직 없어 업데이트를 쓸 곳이 없다. */}
          {props.openUpdates && !item.draft && (
            <UpdatesButton
              count={item.updateCount ?? 0}
              active={props.updatesOpenFor === key}
              label={nameOf(item)}
              onClick={() => props.openUpdates?.(item)}
            />
          )}
        </div>
        {columns.map((column) => (
          <ItemCell key={column.id} item={item} column={column} {...props} />
        ))}
        <div className="mon-cell mon-cell--end" aria-hidden />
      </div>
      {open && subColumns && (
        <SubTable
          columns={subColumns}
          subitems={item.subitems ?? []}
          nameTitle={props.subNameTitle}
          onAdd={(name) => props.addSubitem(item, name)}
        />
      )}
    </>
  )
}

function ItemCell({
  item,
  column,
  editing,
  setEditing,
  commitCell,
  openFiles,
}: GroupTableProps & { item: TechItemDoc; column: TechColumn }) {
  const key = `${rowKey(item)}:${column.id}`
  const cell = item.values[column.id]
  const writable = isWritable(column)
  const active = editing?.key === key
  const commit = (c: CellCommit) => {
    setEditing(null)
    commitCell(item, column, c)
  }

  const start = (target: HTMLElement) => {
    if (column.type === 'file') {
      // 만드는 중인 항목은 Monday에 아직 없어 파일을 올릴 곳이 없다.
      if (!item.draft) openFiles(item, column)
      return
    }
    if (!writable) return
    if (column.type === 'checkbox') {
      // 연달아 눌러도 저장 대기열이 순서대로(마지막 값으로) 보낸다.
      const next = !(initialState(column, cell) as boolean)
      commitCell(item, column, { state: next, preview: previewCell(column, next) })
      return
    }
    setEditing({ key, anchor: target })
  }

  if (active && INLINE_TYPES.has(column.type)) {
    const initial = initialState(column, cell) as string
    return (
      <div className={cx(cellClass(column), 'is-editing')} role="gridcell">
        <InlineInput
          initial={initial}
          label={column.title}
          inputMode={column.type === 'numbers' ? 'decimal' : isPhoneColumn(column) ? 'tel' : column.type === 'email' ? 'email' : undefined}
          // 번호 하나로 적힌 값만 치는 대로 하이픈을 넣는다(번호 두 개 등은 적힌 그대로).
          format={isPhoneColumn(column) && isPhoneLike(initial) ? formatPhoneTyping : undefined}
          onCommit={(value) => {
            if (isPhoneColumn(column) && isPhoneLike(value) && isPartialPhone(value)) {
              setEditing(null)
              pushToast({ tone: 'error', title: `${column.title}: 번호를 끝까지 적어 주세요`, message: '9자리가 안 되는 번호는 저장하지 않았어요.' })
              return
            }
            commit({ state: value as EditState, preview: previewCell(column, value) })
          }}
          onCancel={() => setEditing(null)}
        />
      </div>
    )
  }

  return (
    <div
      className={cx(cellClass(column), writable && 'is-writable', active && 'is-active')}
      style={cellStyle(column, cell)}
      role="gridcell"
      tabIndex={writable || column.type === 'file' ? 0 : -1}
      title={writable || column.type === 'file' ? undefined : `${column.title} — Monday에서만 고칠 수 있어요`}
      onClick={(e) => start(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'F2') {
          e.preventDefault()
          start(e.currentTarget)
        }
      }}
    >
      <CellView column={column} cell={cell} />
      {active && editing && (
        <CellEditor column={column} cell={cell} anchor={editing.anchor} onCommit={commit} onCancel={() => setEditing(null)} />
      )}
    </div>
  )
}

import { ChevronDown, ChevronRight, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, type CSSProperties } from 'react'
import type { TechBoardKey, TechColumn, TechItemDoc, TechSubitemDoc } from '../../data/tech-boards'
import { cx } from '@/ohq-ui/lib/cx'
import { formatInt } from '@/ohq-ui/lib/format'
import { AddRow } from './monday-add-row'
import { labelColor } from './monday-colors'
import type { CellCommit } from './monday-editors'
import { ItemRow } from './monday-item-row'
import { selectionKey, useSelection } from './monday-selection'
import { ResizeHandle, RowCheck, SortButton } from './monday-table-controls'
import { rowKey, type MonSort } from './monday-values'

// Monday 표의 그룹 하나(GroupTable) — 제목·머리글·줄·"+ 추가"·요약. 줄과 칸은 monday-item-row ·
// monday-editable-cell, 하위 아이템은 monday-subitems, 작은 부품은 monday-table-controls · monday-add-row.

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
  /** 하위 아이템 칸 고치기 — 없으면 하위 표는 보기만 한다. */
  commitSubCell?: (item: TechItemDoc, sub: TechSubitemDoc, column: TechColumn, commit: CellCommit) => void
  /** 하위 아이템 이름 고치기 */
  commitSubName?: (item: TechItemDoc, sub: TechSubitemDoc, name: string) => void
  /** 하위 아이템 지우기(Monday 휴지통) */
  removeSubitem?: (item: TechItemDoc, sub: TechSubitemDoc) => void
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
              {/* 줄과 같은 자리 — 하위 줄이 있는 보드는 펼치기 단추 자리를 비워 두어 이름 글자와 머리글 글자를 맞춘다 */}
              {props.subColumns && <span className="mon-expand mon-expand--ghost" aria-hidden />}
              <SortButton id="name" title={nameTitle} sort={sort} onSort={onSort} />
              <span className="mon-text mon-name-head">{nameTitle}</span>
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

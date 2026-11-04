import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  LoaderCircle,
  MessageCircle,
  MessageCirclePlus,
  Plus,
  Search,
} from 'lucide-react'
import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { usePendingSaves } from '../../../data/tech-save-queue'
import { isDone } from '../../../data/tech-stage'
import { UPDATE_BOARDS } from '../../../data/use-item-updates'
import { useItemParam } from '../../../lib/use-item-param'
import { useBoardEdit } from '../../board/board-edit-context'
import { useRecordSelection } from '../../board/record-selection'
import type { RecordColumn } from '../../board/record-table'
import { cx } from '@/ohq-ui/lib/cx'
import type { WaterDropEffect } from '@/ohq-ui/water/fx'
import {
  useReducedMotion,
  useWaterFx,
  useWaterIndicator,
} from '@/ohq-ui/water/hooks'
import { waterClock } from '@/ohq-ui/water/motion'
import {
  WaterButton,
  WaterCheck,
  WaterChips,
  WaterTextField,
} from '@/ohq-ui/water/controls'
import { RECORD_PAGE, compareValues, type SortDir } from './record-sort'
import { WaterSelectionBar } from './water-selection-bar'

type View = 'open' | 'done' | 'all'

interface RecordLike {
  itemId: string
  stage: string | null
  status: string | null
}

interface WaterRecordTableProps<T extends RecordLike> {
  title: string
  records: readonly T[]
  columns: readonly RecordColumn<T>[]
  assigneesOf: (record: T) => string[]
  /** 검색에 쓰는 글자(이름·기기·내용 등을 이어 붙인 것) */
  searchOf: (record: T) => string
  /** 진행 중 / 완료 목록의 순서 — 생략하면 Monday 순서 그대로. */
  sortOpen?: (a: T, b: T) => number
  sortDone?: (a: T, b: T) => number
  onSelect: (record: T) => void
  selectedId?: string | null
  searchPlaceholder?: string
  /** 진행 중/완료 구분이 없는 보드(부품·대여품·SN 등)는 false — 칩 없이 전체를 보인다. */
  progress?: boolean
  /** 처음 보일 줄 수(물 판만) — 기본 30, "더 보기"마다 이만큼 는다 */
  pageSize?: number
  /** 줄을 고를 때 표시 알약 위로 떨어지는 물방울(물 판만) — 없으면 알약만 옮긴다 */
  effect?: WaterDropEffect
}

/** 표시 알약이 줄 위아래로 남기는 틈(px) */
const INSET_Y = 3
/** 물방울이 늦게 나오는 정도를 셀 때 이 칸 수까지만(먼 줄로 가도 너무 늦지 않게) */
const MAX_DROP_STEPS = 4
/**
 * D7 표시 알약의 옆 길이(가로로 달리는 알약의 높이 50.5px) — 달릴 때 옆이 0.64 × 28% = 18% 줄어 9px쯤 준다.
 * 세로로 달리는 표 줄 알약은 옆(폭)이 800px 넘게 길어 같은 비율이면 150px 가까이 줄어든다 — 폭이 달라도 D7처럼
 * 옆으로 9px쯤만 줄게 찌그러짐 배율을 50.5 / 폭으로 둔다(800px 줄 0.063)
 */
const D7_INDICATOR_ACROSS = 50.5

/**
 * 보드 기록 표(물) — 기존 RecordTable과 같은 props·동작(진행 중·완료·전체 / 담당자 / 검색으로 거르고, 머리글로
 * 정렬하고, 줄을 누르면 상세를 연다). 고른 줄 뒤의 어두운 표시 알약이 D7 표시 알약 스프링(ζ0.65·ω30.5, 7%
 * 넘침)으로 세로로 따라가며 달리는 빠르기만큼 늘어난다(WaterIndicatorEngine axis 'y'). 알약은 따로 층이라
 * 움직여도 줄들은 다시 칠하지 않는다.
 *
 * 키보드 — 줄 첫 칸 단추에서 ↑↓로 줄을 옮기고 Home·End로 처음·끝, Enter·Space로 연다.
 */
export function WaterRecordTable<T extends RecordLike>({
  title,
  records,
  columns,
  assigneesOf,
  searchOf,
  sortOpen,
  sortDone,
  onSelect,
  selectedId,
  searchPlaceholder = '이름·내용 검색',
  progress = true,
  pageSize = RECORD_PAGE,
  effect,
}: WaterRecordTableProps<T>) {
  const edit = useBoardEdit()
  const saving = usePendingSaves()
  const reduced = useReducedMotion()
  const [, openItem] = useItemParam()
  // 말풍선 보드(출장업무·아톡문의)는 이름 칸 옆에 업데이트 수 — 누르면 서랍이 업데이트 탭으로 열린다
  const updatesBoard = !!edit && UPDATE_BOARDS.has(edit.boardKey)
  const openUpdates = useCallback(
    (record: RecordLike) => openItem(record.itemId, 'updates'),
    [openItem],
  )
  // 줄 고르기(물 체크) — 고르면 아래에 이동·삭제 막대(Monday 표 선택 막대와 같은 기능). 고칠 수 있는 보드만
  const ids = useMemo(() => records.map((r) => r.itemId), [records])
  const selection = useRecordSelection(ids)
  const setSelected = selection.set
  const pickBox = useCallback(
    (itemId: string, on: boolean) => setSelected([itemId], on),
    [setSelected],
  )
  const [view, setView] = useState<View>(progress ? 'open' : 'all')
  const [assignee, setAssignee] = useState('')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(pageSize)
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null)
  // 단계 칸은 이름이 아니라 Monday 그룹 순서(신규 → … → 완료)로 정렬한다.
  const groupOrder = edit?.meta.groups.map((g) => g.title)

  const openCount = records.filter((r) => !isDone(r)).length
  const viewOptions = [
    { value: 'open' as const, label: `진행 중 ${openCount}` },
    { value: 'done' as const, label: `완료 ${records.length - openCount}` },
    { value: 'all' as const, label: `전체 ${records.length}` },
  ]

  // 담당자 목록 — 맡은 건이 많은 순.
  const people = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of records)
      for (const name of assigneesOf(r))
        counts.set(name, (counts.get(name) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  }, [records, assigneesOf])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = records.filter(
      (r) =>
        (view === 'all' || (view === 'done') === isDone(r)) &&
        (!assignee || assigneesOf(r).includes(assignee)) &&
        (!needle || searchOf(r).toLowerCase().includes(needle)),
    )
    const column = sort && columns.find((c) => c.key === sort.key)
    if (sort && column?.sortValue) {
      const valueOf =
        column.key === 'stage' && groupOrder
          ? (r: T) => {
              const i = groupOrder.indexOf(r.stage ?? '')
              return i < 0 ? null : i
            }
          : column.sortValue
      return [...filtered].sort((a, b) =>
        compareValues(valueOf(a), valueOf(b), sort.dir),
      )
    }
    if (view === 'open' && sortOpen) return [...filtered].sort(sortOpen)
    if (view !== 'open' && sortDone) return [...filtered].sort(sortDone)
    return filtered
  }, [
    records,
    view,
    assignee,
    query,
    assigneesOf,
    searchOf,
    sortOpen,
    sortDone,
    sort,
    columns,
    groupOrder,
  ])

  const visible = rows.slice(0, limit)
  const selIndex = selectedId
    ? visible.findIndex((r) => r.itemId === selectedId)
    : -1

  // ── 표시 알약 ──
  // 줄 폭(알약 옆 길이) — 폭 감시자가 알려 준다. 찌그러짐 배율이 바뀌면 엔진을 새로 만든다(드물다)
  const [across, setAcross] = useState(0)
  const squash = across > 0 ? Math.min(1, D7_INDICATOR_ACROSS / across) : 1
  const { ref: indRef, engine: indEngine } = useWaterIndicator<HTMLDivElement>({
    axis: 'y',
    squash,
  })
  const { ref: fxRef, engine: fxEngine } = useWaterFx()
  const inner = useRef<HTMLDivElement>(null)
  // 누른 시각·자리 — 효과가 그 시각부터 잰다
  const pressed = useRef<{ at: number; x: number | null } | null>(null)
  // 알약이 마지막으로 앉은 줄과 그 자리 — 서랍을 닫아 알약이 걷혀도 자리는 기억해 두었다가, 다음에 고른 줄로
  // 그 자리에서 달려가며 나타난다(서랍이 막으로 표를 가려 열린 채로는 다른 줄을 못 고르니, 고를 때마다
  // 스프링·늘어남이 보이게)
  const placed = useRef<{ index: number; pos: number; size: number } | null>(
    null,
  )
  const shown = useRef(false)

  useLayoutEffect(() => {
    const engine = indEngine.current
    const el = indRef.current
    const box = inner.current
    if (!engine || !el || !box) return
    const press = pressed.current
    pressed.current = null
    if (selIndex < 0) {
      el.classList.remove('is-shown')
      shown.current = false
      return
    }
    const row = box.querySelector<HTMLElement>(`tr[data-row="${selIndex}"]`)
    if (!row) return
    const b = box.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    const target = {
      pos: r.top - b.top + r.height / 2,
      size: r.height - INSET_Y * 2,
    }
    const prev = placed.current
    const same =
      prev !== null &&
      Math.abs(prev.pos - target.pos) < 0.5 &&
      Math.abs(prev.size - target.size) < 0.5
    // 자리가 그대로면(실시간 갱신으로 다시 그려졌을 뿐) 엔진을 깨우지 않는다
    if (shown.current && same) return
    const travel = prev !== null && !same && !reduced
    engine.set(target, { instant: !travel, at: press?.at, step: r.height })
    el.classList.add('is-shown')
    shown.current = true
    placed.current = { index: selIndex, ...target }
    // 물방울 — 다른 줄로 달려갈 때(D7: 고를 때마다 알약 윗변에서)
    const drops = fxEngine.current
    if (effect && travel && press && drops) {
      const firstCell = row.querySelector('td')?.getBoundingClientRect()
      const x =
        press.x ??
        (firstCell ? firstCell.left - b.left + firstCell.width / 2 : 40)
      drops.trigger({
        effect,
        x,
        surface: target.pos - target.size / 2,
        rippleY: target.pos,
        scale: r.height / 50.5,
        steps: Math.min(
          MAX_DROP_STEPS,
          Math.max(1, Math.abs(selIndex - prev.index)),
        ),
        clip: { x: 0, y: 0, width: b.width, height: b.height, radius: 14 },
        at: press.at,
      })
    }
  }, [
    selIndex,
    visible.length,
    rows,
    reduced,
    effect,
    indEngine,
    indRef,
    fxEngine,
  ])

  // 폭이 바뀌면(창 크기·글꼴) 줄 높이가 바뀔 수 있다 — 알약을 바로 맞춘다. 처음 폭은 감시자의 첫
  // 알림에서 받는다(붙일 때 offsetWidth를 읽으면 수백 줄 표를 그 자리에서 한 번 더 배치한다)
  useLayoutEffect(() => {
    const box = inner.current
    if (!box) return
    let width: number | null = null
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      const first = width === null
      if (w === width) return
      width = w
      setAcross(Math.round(w))
      if (first) return
      const cur = placed.current
      const row =
        cur && box.querySelector<HTMLElement>(`tr[data-row="${cur.index}"]`)
      if (!cur || !row) return
      const b = box.getBoundingClientRect()
      const r = row.getBoundingClientRect()
      const target = {
        pos: r.top - b.top + r.height / 2,
        size: r.height - INSET_Y * 2,
      }
      indEngine.current?.set(target, { instant: true })
      placed.current = { index: cur.index, ...target }
    })
    ro.observe(box)
    return () => ro.disconnect()
  }, [indEngine])

  const select = (record: T, e: MouseEvent) => {
    const box = inner.current
    pressed.current = {
      at: waterClock(),
      x:
        box && e.detail > 0
          ? e.clientX - box.getBoundingClientRect().left
          : null,
    }
    onSelect(record)
  }

  // 줄 사이를 키보드로
  const onRowKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next =
      e.key === 'ArrowDown'
        ? index + 1
        : e.key === 'ArrowUp'
          ? index - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? visible.length - 1
              : null
    if (next === null || next < 0 || next >= visible.length) return
    e.preventDefault()
    inner.current
      ?.querySelector<HTMLButtonElement>(
        `tr[data-row="${next}"] .water-record-table__open`,
      )
      ?.focus()
  }

  // 줄에 넘기는 처리기는 늘 같은 것 — 줄(memo)이 고른 줄이 바뀔 때 두 줄만 다시 그리게
  const handlers = useRef({ select, onRowKey })
  useLayoutEffect(() => {
    handlers.current = { select, onRowKey }
  })
  const onPick = useCallback(
    (record: T, e: MouseEvent) => handlers.current.select(record, e),
    [],
  )
  const onKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, index: number) =>
      handlers.current.onRowKey(e, index),
    [],
  )

  // 머리글 클릭 — 오름차순 → 내림차순 → 기본 순서
  const toggleSort = (key: string) => {
    pressed.current = { at: waterClock(), x: null }
    setSort((s) =>
      s?.key !== key
        ? { key, dir: 'asc' }
        : s.dir === 'asc'
          ? { key, dir: 'desc' }
          : null,
    )
    setLimit(pageSize)
  }

  // 거르는 조건이 바뀌면 다시 처음 줄 수로.
  const reset =
    <V,>(set: (value: V) => void) =>
    (value: V) => {
      set(value)
      setLimit(pageSize)
    }

  return (
    <section className="water-record">
      <header className="water-record__header">
        <div className="water-record__heading">
          <h2 className="water-record__title">{title}</h2>
          <p className="water-record__count">{rows.length}건</p>
        </div>
        <div className="water-record__actions">
          {progress && (
            <WaterChips
              ariaLabel="진행 상태"
              options={viewOptions}
              value={view}
              onChange={reset(setView)}
            />
          )}
          {edit && (
            <WaterButton
              size="sm"
              icon={Plus}
              onClick={() => edit.openEditor(null)}
            >
              새로 만들기
            </WaterButton>
          )}
        </div>
      </header>

      <div className="water-record__filters">
        <WaterTextField
          className="water-board-quiet-label water-record__search"
          label="검색"
          icon={Search}
          type="search"
          value={query}
          placeholder={searchPlaceholder}
          onChange={(e) => reset(setQuery)(e.target.value)}
        />
        {people.length > 0 && (
          // 기본 부품에 고르기 칸(select)이 없어 로컬 — 모양은 WaterTextField 유리 알약과 같게
          <label className="water-board-select">
            <span className="sr-only">담당자</span>
            <select
              className="water-board-select__input"
              value={assignee}
              onChange={(e) => reset(setAssignee)(e.target.value)}
            >
              <option value="">담당자 전체</option>
              {people.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="water-record-table">
        <div ref={inner} className="water-record-table__inner">
          <div
            ref={indRef}
            className="water-record-table__indicator"
            aria-hidden
          />
          <table className="water-record-table__table">
            <thead>
              <tr>
                {edit && (
                  <th scope="col" className="water-record-table__check">
                    <PickAll
                      ids={visible.map((r) => r.itemId)}
                      selected={selection.selected}
                      onChange={setSelected}
                    />
                  </th>
                )}
                {columns.map((column) => {
                  const active = sort?.key === column.key ? sort.dir : null
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      className={column.className}
                      aria-sort={
                        active === 'asc'
                          ? 'ascending'
                          : active === 'desc'
                            ? 'descending'
                            : undefined
                      }
                    >
                      {column.sortValue ? (
                        <button
                          type="button"
                          className={cx(
                            'water-record-table__sort',
                            active && 'is-active',
                          )}
                          onClick={() => toggleSort(column.key)}
                          title={
                            active === 'asc'
                              ? '내림차순으로'
                              : active === 'desc'
                                ? '정렬 해제'
                                : '오름차순으로'
                          }
                        >
                          {column.header}
                          {active === 'asc' ? (
                            <ArrowUp size={12} aria-hidden />
                          ) : active === 'desc' ? (
                            <ArrowDown size={12} aria-hidden />
                          ) : (
                            <ArrowUpDown
                              size={12}
                              aria-hidden
                              className="water-record-table__sort-idle"
                            />
                          )}
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + (edit ? 1 : 0)}
                    className="water-record-table__empty"
                  >
                    {query || assignee
                      ? '조건에 맞는 기록이 없어요.'
                      : view === 'open'
                        ? '진행 중인 건이 없어요.'
                        : '기록이 없어요.'}
                  </td>
                </tr>
              )}
              {visible.map((record, index) => (
                <RecordRow
                  key={record.itemId}
                  record={record}
                  index={index}
                  columns={columns}
                  selected={record.itemId === selectedId}
                  saving={saving.has(record.itemId)}
                  updateCount={
                    updatesBoard
                      ? (edit?.itemOf(record.itemId)?.updateCount ?? 0)
                      : null
                  }
                  picked={edit ? selection.selected.has(record.itemId) : null}
                  onPickBox={pickBox}
                  onPick={onPick}
                  onKey={onKey}
                  onUpdates={openUpdates}
                />
              ))}
            </tbody>
          </table>
          <svg
            ref={fxRef}
            className="water-record-table__fx"
            aria-hidden
            focusable="false"
          />
        </div>
      </div>

      {edit && (
        <WaterSelectionBar
          boardKey={edit.boardKey}
          meta={edit.meta}
          selected={selection.selected}
          onClear={selection.clear}
        />
      )}

      {rows.length > limit && (
        <button
          type="button"
          className="water-record__more"
          onClick={() => setLimit((n) => n + pageSize)}
        >
          더 보기 <span>{rows.length - limit}건 남음</span>
        </button>
      )}
    </section>
  )
}

interface RecordRowProps<T extends RecordLike> {
  record: T
  index: number
  columns: readonly RecordColumn<T>[]
  selected: boolean
  saving: boolean
  /** 업데이트 수 — 말풍선 보드가 아니면 null(말풍선을 그리지 않는다) */
  updateCount: number | null
  /** 체크했는지 — 고를 수 없는 표면 null(체크 칸을 그리지 않는다) */
  picked: boolean | null
  onPickBox: (itemId: string, on: boolean) => void
  onPick: (record: T, e: MouseEvent) => void
  onKey: (e: KeyboardEvent<HTMLButtonElement>, index: number) => void
  onUpdates: (record: T) => void
}

/** 줄 하나 — memo라 고른 줄이 바뀌어도 그 두 줄만 다시 그린다(수백 줄 표에서 한 번에 다 그리지 않게) */
function RecordRowView<T extends RecordLike>({
  record,
  index,
  columns,
  selected,
  saving,
  updateCount,
  picked,
  onPickBox,
  onPick,
  onKey,
  onUpdates,
}: RecordRowProps<T>) {
  return (
    <tr
      data-row={index}
      className={cx('water-record-table__row', selected && 'is-selected')}
      aria-current={selected || undefined}
      onClick={(e) => onPick(record, e)}
    >
      {picked !== null && (
        <td
          className="water-record-table__check"
          onClick={(e) => e.stopPropagation()}
        >
          <WaterCheck
            size="sm"
            aria-label="이 줄 고르기"
            checked={picked}
            onChange={(e) => onPickBox(record.itemId, e.target.checked)}
          />
        </td>
      )}
      {columns.map((column, i) => (
        <td key={column.key} className={column.className}>
          {i === 0 ? (
            <>
              {/* 키보드로도 열 수 있게 첫 칸은 버튼으로(줄 전체 클릭은 마우스용). */}
              <button
                type="button"
                className="water-record-table__open"
                aria-haspopup="dialog"
                onClick={(e) => {
                  e.stopPropagation()
                  onPick(record, e)
                }}
                onKeyDown={(e) => onKey(e, index)}
              >
                {column.cell(record)}
                {saving && (
                  <span
                    className="water-record-table__saving"
                    title="Monday에 저장하는 중"
                  >
                    <LoaderCircle
                      size={12}
                      className="is-spinning"
                      aria-hidden
                    />
                    저장 중
                  </span>
                )}
              </button>
              {updateCount !== null && (
                <button
                  type="button"
                  className={cx(
                    'water-record-table__updates',
                    !updateCount && 'is-empty',
                  )}
                  aria-label={
                    updateCount ? `업데이트 ${updateCount}개` : '업데이트 쓰기'
                  }
                  title={
                    updateCount ? `업데이트 ${updateCount}개` : '업데이트 쓰기'
                  }
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdates(record)
                  }}
                >
                  {updateCount ? (
                    <MessageCircle size={14} aria-hidden />
                  ) : (
                    <MessageCirclePlus size={14} aria-hidden />
                  )}
                  {updateCount > 0 && <span>{updateCount}</span>}
                </button>
              )}
            </>
          ) : (
            column.cell(record)
          )}
        </td>
      ))}
    </tr>
  )
}

const RecordRow = memo(RecordRowView) as typeof RecordRowView

/** 보이는 줄 전체 고르기 — 일부만 골랐으면 가로줄(indeterminate) */
function PickAll({
  ids,
  selected,
  onChange,
}: {
  ids: string[]
  selected: ReadonlySet<string>
  onChange: (ids: readonly string[], on: boolean) => void
}) {
  const picked = ids.filter((id) => selected.has(id)).length
  const all = ids.length > 0 && picked === ids.length
  return (
    <WaterCheck
      size="sm"
      aria-label={all ? '보이는 줄 고르기 해제' : '보이는 줄 모두 고르기'}
      checked={all}
      indeterminate={picked > 0 && !all}
      disabled={ids.length === 0}
      onChange={() => onChange(ids, !all)}
    />
  )
}

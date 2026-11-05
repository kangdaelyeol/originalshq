import { ArrowDownUp, ChevronDown, ChevronsDownUp, ChevronsUpDown, CircleUserRound, Filter, Plus, Search, X } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { TechBoardKey, TechBoardMeta, TechItemDoc } from '../../data/tech-boards'
import { pushToast } from '../../data/tech-save-queue'
import { applyViewRules, deleteBoardView, ruleReady, useBoardViews, type BoardView, type BoardViewSpec } from '../../data/tech-views'
import { errorText } from '../../lib/error-text'
import { ConfirmDialog } from '@/ohq-ui/components/confirm-dialog'
import { cx } from '@/ohq-ui/lib/cx'
import { Topbar } from '../layout/topbar'
import { MonPopover } from './monday-popover'
import { MondaySection } from './monday-section'
import { SelectionProvider } from './monday-selection-bar'
import { ViewModal } from './monday-view-modal'
import {
  groupIdOf,
  ITEM_NOUN,
  matchesItem,
  NAME_TITLE,
  nextSort,
  OTHER_GROUP,
  splitNames,
  viewColumns,
  visibleColumns,
  type MonSort,
} from './monday-values'
import { useCollapsedGroups, useSelectedView } from './use-monday-prefs'

interface MondayBoardProps {
  boardKey: TechBoardKey
  meta: TechBoardMeta
  items: TechItemDoc[]
  /** 보기 탭 아래·도구 줄 위에 넣을 것 — 보드 화면이 숫자 요약 줄(MondayNumbers)을 준다. */
  summary?: ReactNode
}

/** 보기 모달 — 새 보기(initial은 복제할 때 처음 값) 또는 고칠 보기 */
type ViewEditor = { view: BoardView | null; initial?: BoardViewSpec }

/**
 * Monday 표 레이아웃(보드 화면) — 보기 탭(메인 테이블 + 팀이 저장한 보기), 위 도구 줄(새 항목·검색·사람·정렬·
 * 모두 접기)과 보드 한 장 분량의 표(MondaySection). 표는 자기 안에서 위아래·옆으로 스크롤된다. summary가
 * 있으면 보기 탭과 도구 줄 사이에 넣는다. 보기를 고르면 그 조건으로 거른 항목에 검색·사람 거르기를 더한다.
 */
export function MondayBoard({ boardKey, meta, items, summary }: MondayBoardProps) {
  const boardRef = useRef<HTMLElement>(null)
  const nameTitle = NAME_TITLE[boardKey]
  const columns = useMemo(() => visibleColumns(meta), [meta])
  const peopleColumns = useMemo(() => columns.filter((c) => c.type === 'people' || c.type === 'assignee'), [columns])

  const [collapsed, setCollapsed] = useCollapsedGroups(boardKey)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [person, setPerson] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ kind: 'person' | 'sort' | 'view'; anchor: HTMLElement } | null>(null)

  // 보기 — 팀이 같이 쓰는 목록(Firestore), 어느 것을 보는지는 이 브라우저에. 지워진 보기면 메인 테이블.
  const { views } = useBoardViews(boardKey)
  const [selectedId, selectView] = useSelectedView(boardKey)
  const view = views?.find((v) => v.id === selectedId) ?? null
  const [editor, setEditor] = useState<ViewEditor | null>(null)
  const [deleting, setDeleting] = useState<BoardView | null>(null)
  const conditionColumns = useMemo(() => viewColumns(meta, boardKey), [meta, boardKey])
  const readyRules = view?.rules.filter(ruleReady).length ?? 0

  // 정렬 — 보기를 고르면(또는 보기의 정렬이 바뀌면) 그 보기의 정렬로 시작하고, 도구 줄·머리글로 잠깐 바꿀 수 있다
  const sortKey = view ? `${view.id}:${JSON.stringify(view.sort)}` : ''
  const [sortState, setSortState] = useState<{ key: string; sort: MonSort }>({ key: '', sort: null })
  const sort = sortState.key === sortKey ? sortState.sort : (view?.sort ?? null)
  const setSort = (next: MonSort | ((current: MonSort) => MonSort)) =>
    setSortState({ key: sortKey, sort: typeof next === 'function' ? next(sort) : next })

  // 담당자로 거를 사람 — 사람 칸에 나오는 이름, 많이 맡은 순
  const people = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      for (const c of peopleColumns) for (const name of splitNames(item.values[c.id]?.text)) counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  }, [items, peopleColumns])

  const needle = query.trim().toLowerCase()
  const searching = Boolean(needle || person)
  const filtering = searching || readyRules > 0
  const viewItems = useMemo(
    () => (view ? applyViewRules(items, view, conditionColumns, (item) => groupIdOf(meta, item)) : items),
    [items, view, conditionColumns, meta],
  )
  const shown = useMemo(
    () => (searching ? viewItems.filter((item) => matchesItem(item, peopleColumns, needle, person)) : viewItems),
    [viewItems, peopleColumns, needle, person, searching],
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
        <button type="button" className={cx('mon-tab', !view && 'is-on')} aria-current={!view || undefined} onClick={() => selectView(null)}>
          메인 테이블
        </button>
        {views?.map((v) => {
          const on = v.id === view?.id
          return (
            <span key={v.id} className={cx('mon-viewtab', on && 'is-on')}>
              <button type="button" className={cx('mon-tab', on && 'is-on')} aria-current={on || undefined} onClick={() => selectView(v.id)}>
                {v.name}
              </button>
              {on && (
                <button
                  type="button"
                  className="mon-viewtab__more"
                  aria-label={`${v.name} 보기 메뉴`}
                  aria-haspopup="menu"
                  onClick={(e) => setMenu(menu?.kind === 'view' ? null : { kind: 'view', anchor: e.currentTarget })}
                >
                  <ChevronDown size={14} aria-hidden />
                </button>
              )}
            </span>
          )
        })}
        <button type="button" className="mon-tab mon-tab--add" aria-label="보기 추가" title="보기 추가" onClick={() => setEditor({ view: null })}>
          <Plus size={16} aria-hidden />
        </button>
      </nav>
      {summary}
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
          새로운 {ITEM_NOUN[boardKey]}
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

        {view && (
          <button type="button" className={cx('mon-tool', readyRules > 0 && 'is-on')} onClick={() => setEditor({ view })}>
            <Filter size={15} aria-hidden />
            {readyRules > 0 ? `조건 / ${readyRules}` : '조건'}
          </button>
        )}

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

        <span className="mon-toolbar__count">{searching ? `${shown.length}개 찾음` : `${shown.length}개 항목`}</span>
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
            hiddenColumns={view?.hidden}
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
      {menu?.kind === 'view' && view && (
        <MonPopover anchor={menu.anchor} width={200} onClose={() => setMenu(null)}>
          <ul className="mon-menu">
            <li>
              <button
                type="button"
                className="mon-menu__item"
                onClick={() => {
                  setMenu(null)
                  setEditor({ view })
                }}
              >
                보기 고치기
              </button>
            </li>
            <li>
              <button
                type="button"
                className="mon-menu__item"
                onClick={() => {
                  setMenu(null)
                  setEditor({ view: null, initial: { ...view, name: `${view.name} 복사`.slice(0, 40) } })
                }}
              >
                복제하기
              </button>
            </li>
            <li>
              <button
                type="button"
                className="mon-menu__item mon-menu__item--danger"
                onClick={() => {
                  setMenu(null)
                  setDeleting(view)
                }}
              >
                보기 지우기
              </button>
            </li>
          </ul>
        </MonPopover>
      )}

      {editor && (
        <ViewModal
          boardKey={boardKey}
          meta={meta}
          items={items}
          view={editor.view}
          initial={editor.initial}
          onClose={() => setEditor(null)}
          onSaved={(id) => {
            setEditor(null)
            selectView(id)
          }}
          onDeleted={() => {
            setEditor(null)
            selectView(null)
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`"${deleting?.name ?? ''}" 보기를 지울까요?`}
        message="기술팀 모두의 보드에서 이 보기 탭이 사라져요. 항목은 그대로예요."
        confirmLabel="지우기"
        onConfirm={() => {
          const target = deleting
          setDeleting(null)
          if (!target) return
          selectView(null)
          deleteBoardView(target.id).catch((e: unknown) =>
            pushToast({ tone: 'error', title: `"${target.name}" 보기를 지우지 못했어요`, message: errorText(e) }),
          )
        }}
        onCancel={() => setDeleting(null)}
      />
    </section>
  )
}

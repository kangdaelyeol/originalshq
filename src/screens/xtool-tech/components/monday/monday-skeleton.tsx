import type { CSSProperties, ReactNode } from 'react'
import type { TechBoardKey, TechBoardMeta, TechColumn } from '@xtool-core/tech-boards'
import { cx } from '@/ohq-ui/lib/cx'
import { Topbar } from '../layout/topbar'
import { defaultWidth, NAME_WIDTH, visibleColumns } from './monday-values'
import { useColumnWidths } from './use-monday-prefs'

// 불러오는 중(스켈레톤) — sample/skeleton처럼 내용이 올 자리에 둥근 회색 블록을 같은 배치로 그리고,
// 빛줄기 하나가 모든 블록을 한꺼번에 지나간다(styles/monday/_skeleton.scss .mon-skel). 표는 진짜 표와 같은 줄
// 높이·칸 너비라 데이터가 오면 그 자리가 그대로 채워진다.

/** 보드 정보가 아직 없을 때의 칸 — 업무 보드에 흔한 모양 */
const FALLBACK: TechColumn[] = [
  { id: 'phone', title: '', type: 'phone', writable: false },
  { id: 'people', title: '', type: 'people', writable: false },
  { id: 'status', title: '', type: 'status', writable: false },
  { id: 'date', title: '', type: 'date', writable: false },
  { id: 'text', title: '', type: 'text', writable: false },
  { id: 'status2', title: '', type: 'status', writable: false },
  { id: 'long', title: '', type: 'long_text', writable: false },
]

interface SkelColumn {
  type: string
  width: number
}

const fallbackColumns = (): SkelColumn[] => FALLBACK.map((c) => ({ type: c.type, width: defaultWidth(c) }))

// 줄·칸마다 다른 글 길이(%) — 고르게 들쭉날쭉하게
const LENGTHS = [72, 48, 64, 56, 80, 40, 68]
const length = (row: number, col: number) => `${LENGTHS[(row * 3 + col) % LENGTHS.length]}%`

function Block({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span className={cx('mon-skel', className)} style={style} />
}

/** 칸 하나 — 사람은 동그라미, 상태는 칸을 채운 블록, 나머지는 글 한 줄 */
function CellBlock({ type, row, col }: { type: string; row: number; col: number }) {
  if (type === 'people') return <Block className="mon-skel--circle" />
  if (type === 'status') return <Block className="mon-skel--fill" />
  if (type === 'checkbox') return <Block className="mon-skel--check" />
  return <Block style={{ width: length(row, col) }} />
}

/** 그룹 몇 개 분량의 표 — groups는 그룹마다 줄 수 */
function SkeletonTable({
  columns,
  nameWidth,
  groups,
  boxed = false,
}: {
  columns: SkelColumn[]
  nameWidth: number
  groups: number[]
  boxed?: boolean
}) {
  const template = `${nameWidth}px ${columns.map((c) => `${c.width}px`).join(' ')} minmax(48px, 1fr)`
  return (
    <div
      className={cx('mon-section mon-section--skel', boxed && 'mon-section--boxed')}
      style={{ '--mon-cols': template } as CSSProperties}
      aria-hidden
    >
      {groups.map((rows, g) => (
        <div key={g} className="mon-group">
          <div className="mon-group__title">
            <div className="mon-group__title-inner">
              <Block className="mon-skel--title" style={{ width: [150, 118, 170][g % 3] }} />
              <Block style={{ width: 52 }} />
            </div>
          </div>
          <div className="mon-row mon-row--head">
            <div className="mon-cell mon-cell--name">
              <Block style={{ width: 64 }} />
            </div>
            {columns.map((_, i) => (
              <div key={i} className="mon-cell">
                <Block style={{ width: '46%' }} />
              </div>
            ))}
            <div className="mon-cell mon-cell--end" />
          </div>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="mon-row">
              <div className="mon-cell mon-cell--name">
                <Block className="mon-skel--check" />
                <Block style={{ width: length(r + g, 0) }} />
              </div>
              {columns.map((c, i) => (
                <div key={i} className="mon-cell">
                  <CellBlock type={c.type} row={r + g} col={i + 1} />
                </div>
              ))}
              <div className="mon-cell mon-cell--end" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * 보드 화면을 불러오는 중 — 머리말(보드 이름은 이미 안다)과 보기 탭은 그대로, 도구 줄과 표는
 * 블록으로. 보드 정보(칸)가 먼저 와 있으면 그 칸 종류·너비(내가 줄인 너비까지)대로 그린다.
 */
export function MondayBoardSkeleton({
  boardKey,
  meta,
  summary,
}: {
  boardKey: TechBoardKey
  meta: TechBoardMeta | null
  /** 보기 탭 아래 요약 줄 자리(MondayBoard summary와 같은 자리) — 다 불러온 순간 표가 밀리지 않게 */
  summary?: ReactNode
}) {
  const [widths] = useColumnWidths(boardKey)
  const columns = meta
    ? visibleColumns(meta).map((c) => ({ type: c.type, width: widths[c.id] ?? defaultWidth(c) }))
    : fallbackColumns()
  return (
    <section className="mon-board" aria-busy="true" aria-label="보드를 불러오는 중">
      <Topbar embedded />
      <nav className="mon-board__views" aria-label="보기">
        <span className="mon-tab is-on">메인 테이블</span>
      </nav>
      {summary}
      <div className="mon-toolbar" aria-hidden>
        <Block className="mon-skel--button" />
        <Block className="mon-skel--tool" />
        <Block className="mon-skel--tool" />
        <Block className="mon-skel--tool" />
      </div>
      <div className="mon-scroll">
        <SkeletonTable columns={columns} nameWidth={widths.name ?? NAME_WIDTH} groups={[7, 4, 3]} />
      </div>
      <p className="sr-only" role="status">
        보드를 불러오는 중…
      </p>
    </section>
  )
}

/** 내 업무에서 아직 안 온 보드 자리 — 보드 박스 하나 */
export function MondayWorkboxSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <section className="mon-workbox" aria-hidden>
      <header className="mon-workbox__head">
        <span className="mon-workbox__head-inner">
          <Block className="mon-skel--icon" />
          <Block className="mon-skel--title" style={{ width: 96 }} />
          <Block style={{ width: 28 }} />
        </span>
      </header>
      <SkeletonTable columns={fallbackColumns()} nameWidth={NAME_WIDTH} groups={[rows]} boxed />
    </section>
  )
}

/** 도구 줄 건수 자리 */
export function SkeletonText({ width }: { width: number }) {
  return <Block style={{ width }} />
}

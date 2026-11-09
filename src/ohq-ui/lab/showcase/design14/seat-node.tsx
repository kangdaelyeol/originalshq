import { cx } from '../../../lib/cx'
import { STATUS_TEXT, type SeatStatus } from './design14-data'

interface SeatNodeProps {
  name: string
  status: SeatStatus
  /** 상태 줄 글 — 없으면 STATUS_TEXT(영상 글) */
  statusText?: string
  /** 머리 자리 — 점이 크고, 이름 위에 HEAD, 상태 줄이 없다 */
  head?: boolean
  /** 머리 자리 이름 위 작은 글 — 기본 HEAD */
  tag?: string
  /** 머리 자리 이름 아래 한 줄(없으면 안 보인다) */
  sub?: string
  /** 사람 자리가 아닌 칸 — more: 넘친 사람 묶음(고리 안 badge), empty: 빈 허브 표시(점선 고리) */
  variant?: 'more' | 'empty'
  /** more 고리 안 글(+N) */
  badge?: string
  /** working 호 길이(0~1) */
  progress?: number
  /** 이름표 자리 — 부서 가운데 왼쪽 자리면 left, 오른쪽이면 right, 머리면 top */
  side?: 'left' | 'right' | 'top'
  /** 이름표 보이기(초점 부서만 — 전체 보기에서는 점만) */
  labelled?: boolean
  /** 누른 자리 */
  selected?: boolean
  dim?: boolean
  onSelect?: () => void
  tabIndex?: number
  className?: string
}

// 점·고리 크기(w) — 초점 화면 F248 Lead Responder: 점 반지름 7, 고리 14(앞쪽 원근 1.125배를 뺀 값)
const DOT = 6.2
const HEAD_DOT = 8
const RING = 12.4
const ARC_START = -70 // working 호가 시작하는 각도 — Scriptwriter 2시 방향, Proposal Writer 1시 방향(t=33.17)

/** 자리 하나 — 상태마다 점·고리 모양이 다르다. 가운데가 (0,0). */
export function SeatNode({
  name,
  status,
  statusText = STATUS_TEXT[status],
  head = false,
  tag = 'HEAD',
  sub,
  variant,
  badge,
  progress = 1,
  side = 'right',
  labelled = true,
  selected = false,
  dim = false,
  onSelect,
  tabIndex,
  className,
}: SeatNodeProps) {
  const ringed = head || status === 'runs-itself' || status === 'waiting' || (status === 'working' && progress >= 1)
  const arc = !head && status === 'working' && progress < 1
  const headLabel = sub ? `${tag} — ${name}, ${sub}` : `${tag} — ${name}`
  return (
    <button
      type="button"
      className={cx('d14-seat', className)}
      data-status={head ? 'head' : (variant ?? status)}
      data-side={head ? 'top' : side}
      data-labelled={labelled || undefined}
      data-selected={selected || undefined}
      data-dim={dim || undefined}
      tabIndex={tabIndex}
      aria-label={head ? headLabel : statusText ? `${name} — ${statusText}` : name}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
    >
      {variant ? (
        <svg className="d14-seat__mark" viewBox="-30 -30 60 60" aria-hidden="true">
          <circle className="d14-seat__ring" r={RING} />
          {variant === 'more' && badge && (
            <text className="d14-seat__count" dy="0.35em">
              {badge}
            </text>
          )}
        </svg>
      ) : (
        <svg className="d14-seat__mark" viewBox="-30 -30 60 60" aria-hidden="true">
          {!head && status === 'waiting' && <circle className="d14-seat__pulse" r={RING + 4} />}
          {!head && status === 'runs-itself' && <circle className="d14-seat__outer" r={RING + 4.5} />}
          {ringed && <circle className="d14-seat__ring" r={head ? HEAD_DOT + 3 : RING} />}
          {arc && (
            <circle
              className="d14-seat__arc"
              r={RING}
              pathLength={100}
              strokeDasharray={`${(progress * 100).toFixed(1)} 100`}
              transform={`rotate(${ARC_START})`}
            />
          )}
          <circle
            className="d14-seat__dot"
            r={head ? HEAD_DOT : status === 'in-head' ? DOT - 1 : status === 'not-running' ? DOT - 0.6 : DOT}
          />
          {!head && status === 'waiting' && <path className="d14-seat__flag" d="M0 -28.5 L4.6 -20.6 L-4.6 -20.6 Z" />}
        </svg>
      )}
      <span className="d14-seat__label" aria-hidden="true">
        {head && <span className="d14-seat__tag">{tag}</span>}
        <span className="d14-seat__name">{name}</span>
        {head && sub && <span className="d14-seat__sub">{sub}</span>}
        {!head && statusText && <span className="d14-seat__status">{statusText}</span>}
      </span>
    </button>
  )
}

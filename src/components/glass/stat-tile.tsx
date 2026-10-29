import './stat-tile.scss'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Link, type To } from 'react-router-dom'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'

/**
 * 숫자 타일 — 왼쪽 아이콘 상자, 오른쪽에 이름과 값, 그 아래 보조 줄.
 *
 * 갈 곳(to)이 있는 타일만 오른쪽 위 모서리를 홈처럼 파고 그 자리에 ↗ 버튼을
 * 둔다. 홈은 타일 몸통을 마스크로 깎아 만들어서, 버튼은 깎이지 않게 몸통
 * 밖(감싸는 상자)에 둔다.
 *
 * 값은 한 줄로만 — 칸보다 길면(↗ 버튼 옆이라 좁을 때 등) 글자를 한 단계씩
 * 줄여 맞춘다(최소 16px). 타일 높이가 늘어나 옆 타일과 어긋나지 않게.
 */
const MIN_VALUE_SIZE = 16

const useFitText = <T extends HTMLElement>(content: ReactNode) => {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const fit = () => {
      element.style.fontSize = ''
      let size = parseFloat(getComputedStyle(element).fontSize)
      while (
        element.scrollWidth > element.clientWidth &&
        size > MIN_VALUE_SIZE
      ) {
        size -= 1
        element.style.fontSize = `${size}px`
      }
    }
    fit()
    // 폭이 바뀔 때만 다시 맞춘다 — 글자를 줄이면 높이가 바뀌어 또 불리므로.
    let width = element.clientWidth
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return
      width = element.clientWidth
      fit()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [content])
  return ref
}

export const StatTile = ({
  icon: Icon,
  label,
  value,
  warn = false,
  sub,
  to,
  onGo,
  linkLabel,
}: {
  icon: LucideIcon
  label: ReactNode
  value: ReactNode
  /** 값을 주의색으로(확인이 필요한 건수 등). */
  warn?: boolean
  sub?: ReactNode
  to?: To
  /** ↗ 버튼을 누르면 할 일 — 주소 이동(to) 대신 화면 안에서(필터 바꾸기 등). */
  onGo?: () => void
  /** ↗ 버튼의 읽어 주는 이름(어디로 가는지). */
  linkLabel?: string
}) => {
  const valueRef = useFitText<HTMLElement>(value)
  return (
    <div className={`glass_stat_tile${to || onGo ? ' has-link' : ''}`}>
      <div className="glass_stat_tile_body">
        <span className="glass_stat_tile_icon" aria-hidden="true">
          <Icon strokeWidth={1.6} />
        </span>
        <span className="glass_stat_tile_label">{label}</span>
        <strong
          ref={valueRef}
          className={`glass_stat_tile_value${warn ? ' is-warn' : ''}`}
        >
          {value}
        </strong>
        {sub && <span className="glass_stat_tile_sub">{sub}</span>}
      </div>
      {onGo && !to && (
        <button
          type="button"
          className="glass_stat_tile_go"
          aria-label={linkLabel}
          onClick={onGo}
        >
          <ArrowUpRight strokeWidth={1.8} />
        </button>
      )}
      {to && (
        <Link className="glass_stat_tile_go" to={to} aria-label={linkLabel}>
          <ArrowUpRight strokeWidth={1.8} />
        </Link>
      )}
    </div>
  )
}

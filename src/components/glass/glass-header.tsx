import './glass-header.scss'
import type { ReactNode } from 'react'

/**
 * 화면 맨 위 줄 — [왼쪽(로고) | 가운데(탭) | 오른쪽(테마 고르기·회사 로고)].
 * 페이지 배경 빛(ambient)을 그대로 깔아 아래 메뉴 줄과 경계 없이 이어지고,
 * 위에 붙어 있다(sticky). 화면 전환(startGlassTransition) 동안에는 그대로
 * 남는다.
 *
 * 가운데는 늘 화면 한가운데 — 양쪽 칸이 같은 폭(1fr)이다.
 */
export const GlassHeader = ({
  start,
  center,
  end,
  className,
}: {
  start: ReactNode
  center?: ReactNode
  end?: ReactNode
  className?: string
}) => (
  <header className={`glass_header${className ? ` ${className}` : ''}`}>
    <div className="glass_header_start">{start}</div>
    <div className="glass_header_center">{center}</div>
    <div className="glass_header_end">{end}</div>
  </header>
)

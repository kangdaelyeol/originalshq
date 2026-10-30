import './spinner.scss'
import type { CSSProperties } from 'react'

const BARS = Array.from({ length: 12 }, (_, index) => index)

/**
 * 불러오는 중 — 둥근 막대 12개가 원을 이루고, 진한 막대가 시계 방향으로 돈다
 * (흔한 시스템 로딩 모양). 막대마다 움직이지 않고 상자 하나만 12단계로 돌려서
 * 애니메이션은 하나뿐이다(스켈레톤처럼 막대마다 빛이 흐르면 브라우저가 무겁다).
 * 색은 글자색(테마를 따른다).
 */
export const Spinner = ({
  size = 30,
  label = '불러오는 중',
}: {
  size?: number
  /** 읽어 주는 이름. */
  label?: string
}) => (
  <span
    className="glass_spinner"
    role="status"
    aria-label={label}
    style={{ '--size': `${size}px` } as CSSProperties}
  >
    {BARS.map((index) => (
      <span key={index} style={{ '--i': index } as CSSProperties} />
    ))}
  </span>
)

/**
 * 섹션 하나가 불러오는 중일 때 그 자리에 두는 판 — 가운데 Spinner와 짧은 안내.
 * 스켈레톤 대신 큰 섹션(표·카드·탭 내용)마다 하나씩 둔다. 다 받으면 AutoHeight로
 * 감싼 자리가 내용 높이로 부드럽게 자라고, 내용은 glass_reveal로 흐릿하게
 * 떠오른다.
 *
 * 빨리 끝나는 조회에서 깜빡 보였다 사라지지 않게 잠깐 늦게 나타난다.
 */
export const LoadingPanel = ({
  label = '불러오는 중',
  minHeight = 200,
  className,
}: {
  label?: string
  /** 자리 높이(px) — 내용이 올 자리를 대강 잡아 둔다. */
  minHeight?: number
  className?: string
}) => (
  <div
    className={['glass_loading', className ?? ''].join(' ').trim()}
    style={{ minHeight }}
    aria-busy="true"
  >
    <Spinner label={label} />
    <span className="glass_loading_label" aria-hidden="true">
      {label}
    </span>
  </div>
)

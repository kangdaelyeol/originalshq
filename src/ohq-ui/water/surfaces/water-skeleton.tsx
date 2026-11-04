import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { WaterCard } from './water-card'

type SkeletonShape = 'line' | 'title' | 'circle' | 'pill' | 'block'

interface WaterSkeletonBlockProps {
  /** line 10px 글 한 줄 · title 16px 제목 · circle 24px 사람 · pill 22px 칩 · block 크기를 직접 */
  shape?: SkeletonShape
  width?: number | string
  height?: number | string
  className?: string
}

/**
 * 내용이 올 자리 — 유리에 파인 빈 홈(D7 track, w-groove). 크기는 tech 보드 스켈레톤(.mon-skel)과 같다: 글 한 줄
 * 10px · 제목 16px · 사람 24px. 블록은 움직이지 않고, 빛은 감싼 판(WaterSkeleton·WaterCard busy)이 한 번에 낸다.
 */
export function WaterSkeletonBlock({ shape = 'line', width, height, className }: WaterSkeletonBlockProps) {
  const style: CSSProperties | undefined = width !== undefined || height !== undefined ? { width, height } : undefined
  return <span className={cx('water-skel', `water-skel--${shape}`, className)} style={style} aria-hidden />
}

// 줄마다 다른 글 길이(%) — tech 보드 스켈레톤(monday-skeleton.tsx LENGTHS)과 같은 들쭉날쭉
const LENGTHS = [72, 48, 64, 56, 80, 40, 68]
const len = (i: number, shift = 0) => `${LENGTHS[(i * 3 + shift) % LENGTHS.length]}%`

type SkeletonVariant = 'list' | 'stat' | 'bars' | 'text'

function Rows({ variant, rows }: { variant: SkeletonVariant; rows: number }) {
  const list = Array.from({ length: rows }, (_, i) => i)
  if (variant === 'stat') {
    return (
      <div className="water-skeleton__stat">
        <div className="water-skeleton__row">
          <WaterSkeletonBlock width="42%" />
          <WaterSkeletonBlock shape="circle" width={36} height={36} />
        </div>
        <WaterSkeletonBlock shape="block" width="46%" height={26} />
        <WaterSkeletonBlock width="30%" />
      </div>
    )
  }
  if (variant === 'bars') {
    return (
      <div className="water-skeleton__bars">
        {list.map((i) => (
          <div key={i} className="water-skeleton__bar">
            <div className="water-skeleton__row">
              <WaterSkeletonBlock width={len(i)} className="water-skeleton__grow" />
              <WaterSkeletonBlock width={34} />
            </div>
            <WaterSkeletonBlock shape="block" width="100%" height={12} />
          </div>
        ))}
      </div>
    )
  }
  if (variant === 'text') {
    return (
      <div className="water-skeleton__text">
        {list.map((i) => (
          <WaterSkeletonBlock key={i} width={len(i)} />
        ))}
      </div>
    )
  }
  return (
    <div className="water-skeleton__list">
      {list.map((i) => (
        <div key={i} className="water-skeleton__item">
          <WaterSkeletonBlock shape="block" width={40} height={40} />
          <div className="water-skeleton__lines">
            <WaterSkeletonBlock width={len(i)} />
            <WaterSkeletonBlock width={len(i, 2)} className="water-skeleton__meta" />
          </div>
          <WaterSkeletonBlock shape="pill" width={44} />
        </div>
      ))}
    </div>
  )
}

interface WaterSkeletonProps {
  /** list: 목록 줄 · stat: 숫자 카드 · bars: 막대 목록 · text: 글 줄 */
  variant?: SkeletonVariant
  /** 줄 수(stat은 무시) */
  rows?: number
  /** 판 제목 — 이미 알면(없으면 제목 자리도 홈으로) */
  title?: ReactNode
  /** 유리 판까지 그린다(기본). false면 이미 있는 판 안에 내용 자리만 */
  card?: boolean
  /** 화면 낭독기에 읽어 줄 말 */
  label?: string
  className?: string
}

/**
 * 불러오는 중(D7) — 내용이 올 자리를 빈 홈으로 같은 배치로 그리고, 유리 위로 은은한 빛(D7 버튼의 사선 윤광 —
 * 흰 50%·흐림 2.4)이 한 줄 지나간다. 빛은 판마다 transform 애니메이션 하나(합성 단계)라 블록이 많아도 다시
 * 칠하지 않는다(.mon-skel의 background-position 애니메이션은 블록마다 매 프레임 칠한다). 동작 줄이기면 빛 없음.
 */
export function WaterSkeleton({
  variant = 'list',
  rows = 3,
  title,
  card = true,
  label = '불러오는 중…',
  className,
}: WaterSkeletonProps) {
  const body = (
    <>
      {!title && variant !== 'stat' && (
        <WaterSkeletonBlock shape="title" width="38%" className="water-skeleton__head" />
      )}
      <Rows variant={variant} rows={rows} />
      <span className="sr-only" role="status">
        {label}
      </span>
    </>
  )
  if (!card) {
    return (
      <div className={cx('water-skeleton', 'water-skeleton--bare', className)} aria-busy="true">
        <span className="water-card__sheen" aria-hidden />
        {body}
      </div>
    )
  }
  return (
    <WaterCard busy title={title} className={cx('water-skeleton', `water-skeleton--${variant}`, className)}>
      {body}
    </WaterCard>
  )
}

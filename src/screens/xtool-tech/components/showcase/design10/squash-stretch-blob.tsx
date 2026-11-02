import { cx } from '../../../lib/cx'

export type BlobExpression = 'neutral' | 'strain' | 'happy'

interface SquashStretchBlobProps {
  /** 주면 멈춘 채 그 표정만 보인다(부품 견본용). 없으면 영상처럼 2초마다 튄다. */
  expression?: BlobExpression
  className?: string
}

/**
 * 01 스퀴시 앤 스트레치 — 초록 젤리가 웅크렸다가 튀어 올라 떨어지고, 착지해서 출렁이다 멈춘다.
 * 몸은 너비 × 높이가 늘 같게(눌리면 넓고 낮게) 바뀌고, 눈·입은 몸 크기를 따라 자리만 옮긴다.
 * 바닥(땅)을 기준점으로 놓이니 부모가 자리를 잡아 준다.
 */
export function SquashStretchBlob({ expression, className }: SquashStretchBlobProps) {
  return (
    <div className={cx('d10-squash', expression && `is-still is-${expression}`, className)} aria-hidden>
      <span className="d10-squash__shadow" />
      <div className="d10-squash__body">
        <span className="d10-face d10-face--neutral">
          <i className="d10-face__eye d10-face__eye--l" />
          <i className="d10-face__eye d10-face__eye--r" />
          <svg className="d10-face__mouth" viewBox="0 0 12 5" preserveAspectRatio="none">
            <path d="M1 1.3Q6 5.4 11 1.3" />
          </svg>
        </span>
        <span className="d10-face d10-face--strain">
          <svg className="d10-face__eye d10-face__eye--l" viewBox="0 0 10 12">
            <path d="M1.6 1.6L8.4 6L1.6 10.4M3 6H8.4" />
          </svg>
          <svg className="d10-face__eye d10-face__eye--r" viewBox="0 0 10 12">
            <path d="M8.4 1.6L1.6 6L8.4 10.4M7 6H1.6" />
          </svg>
          <svg className="d10-face__mouth" viewBox="0 0 20 5" preserveAspectRatio="none">
            <path d="M1 3.6L4 1.4L7 3.6L10 1.4L13 3.6L16 1.4L19 3.6" />
          </svg>
        </span>
        <span className="d10-face d10-face--happy">
          <svg className="d10-face__eye d10-face__eye--l" viewBox="0 0 12 6">
            <path d="M1.5 5.2Q6 -1.6 10.5 5.2" />
          </svg>
          <svg className="d10-face__eye d10-face__eye--r" viewBox="0 0 12 6">
            <path d="M1.5 5.2Q6 -1.6 10.5 5.2" />
          </svg>
          <svg className="d10-face__mouth" viewBox="0 0 24 11" preserveAspectRatio="none">
            <path className="d10-face__lip" d="M0.6 0.6H23.4Q20.6 10.6 12 10.6Q3.4 10.6 0.6 0.6Z" />
            <path className="d10-face__teeth" d="M3.2 1.2H20.8V3.4H3.2Z" />
          </svg>
        </span>
      </div>
    </div>
  )
}

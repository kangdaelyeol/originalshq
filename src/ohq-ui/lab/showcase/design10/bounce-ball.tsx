import { cx } from '../../../lib/cx'

/**
 * 02 바운스 — 땅에서 튀어 오른 공이 점점 낮게 여덟 번 튀다 멈춘다.
 * 공은 찌그러지지 않고, 땅에 닿는 순간마다 눈을 질끈 감는다(큰 튐일수록 깊게). 그림자는 높이를 따라 옅어진다.
 */
export function BounceBall({ className }: { className?: string }) {
  return (
    <div className={cx('d10-bounce', className)} aria-hidden>
      <span className="d10-bounce__ground" />
      <span className="d10-bounce__shadow" />
      <span className="d10-bounce__ball">
        <span className="d10-bounce__eyes">
          <i />
          <i />
        </span>
      </span>
    </div>
  )
}

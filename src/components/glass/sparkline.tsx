import './sparkline.scss'
import { GlassLine } from './glass-line'
import { useElementSize } from './use-element-size'

// 위아래 여백(px) — 굵은 선이 상자 끝에서 잘리지 않게.
const PAD = 3

/**
 * 작은 추이 그래프 — 값들(오래된 것부터)을 상자 크기에 맞춘 유리 선과 아래로
 * 옅어지는 면으로. 축·눈금 없이 모양만(카드·타일 안의 추이). 상자 크기는
 * 부르는 쪽 CSS가 정한다(.glass_sparkline 기본 80×34).
 *
 * 눌러서 크게 보려면 칸들을 TrendGrid로 묶는다(칸 전체가 누르는 자리).
 *
 * 값이 모두 같으면 가운데 평평한 선, 하나뿐이면 그리지 않는다.
 */
export const Sparkline = ({
  values,
  className,
}: {
  values: readonly number[]
  className?: string
}) => {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>()
  const finite = values.map((value) => (Number.isFinite(value) ? value : 0))
  const max = Math.max(...finite)
  const min = Math.min(...finite)
  const span = max - min
  const points: [number, number][] =
    finite.length < 2
      ? []
      : finite.map((value, index) => [
          (index / (finite.length - 1)) * width,
          span === 0
            ? height / 2
            : PAD + (1 - (value - min) / span) * (height - PAD * 2),
        ])

  return (
    <div
      ref={ref}
      className={['glass_sparkline', className ?? ''].join(' ').trim()}
      aria-hidden="true"
    >
      <GlassLine points={points} width={width} height={height} weight="sm" />
    </div>
  )
}

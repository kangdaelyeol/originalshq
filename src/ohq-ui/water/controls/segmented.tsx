import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { cx } from '../../lib/cx'
import { WaterFxEngine, type WaterDropOptions } from '../fx'
import { useReducedMotion, useWaterIndicator } from '../hooks'
import type { IndicatorPose, IndicatorTarget } from '../indicator'
import { round3, waterClock } from '../motion'
import { WaterChips } from './chips'
import { rovingIndex } from './keys'
import { boxWithin, cssWidth, layoutScale } from './measure'
import type { WaterEffect, WaterOption } from './types'

interface WaterSegmentedProps<T extends string> {
  options: readonly WaterOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  size?: 'sm' | 'md' | 'lg'
  /** segmented: 유리 알약 안에서 표시 알약이 옮겨 간다(D7 펼친 메뉴) · chips: 따로 떨어진 칩(WaterChips) */
  variant?: 'segmented' | 'chips'
  /** 고를 때 물방울 — bounce(기본)·splash·none */
  effect?: WaterEffect
  /** 아이콘만 — 칸 폭이 D7 표시 알약 비(71:50.5)가 되고 label은 읽어 주기로만 쓴다 */
  iconOnly?: boolean
  /** D7 펼친 메뉴 모양 그대로 — 알약 아래 홈이 파이고 표시 알약이 위쪽에 붙는다 */
  groove?: boolean
  disabled?: boolean
  className?: string
}

/**
 * 물 고르기(D7 펼친 메뉴) — 유리 알약 안에서 어두운 표시 알약이 스프링(ζ0.65·ω30.5, 7% 넘침)으로 옮겨 가며
 * 달리는 빠르기만큼 늘어나고, 고른 글자·아이콘은 흰색이 되며 1.15배로 커진다(0.1s). 고르면 표시 알약 윗변에서
 * 물방울이 튀거나(bounce) 떨어져 흩어지고(splash) 유리에 물결이 두 겹 퍼진다. SegmentedControl과 같은 props로
 * 바꿔 끼울 수 있다(variant="chips"면 WaterChips).
 */
export function WaterSegmented<T extends string>({ variant = 'segmented', ...props }: WaterSegmentedProps<T>) {
  if (variant === 'chips') {
    const { options, value, onChange, ariaLabel, size, disabled, className } = props
    return (
      <WaterChips
        options={options}
        value={value}
        onChange={onChange}
        ariaLabel={ariaLabel}
        size={size}
        disabled={disabled}
        className={className}
      />
    )
  }
  return <WaterSegmentedPill {...props} />
}

/** 잰 모양(px, 알약 왼쪽 위 기준) — 크기가 바뀔 때만 다시 잰다(ResizeObserver) */
interface Geometry {
  width: number
  height: number
  /** 칸마다 가운데 x·폭 = 표시 알약이 놓일 자리 */
  items: IndicatorTarget[]
  /** 표시 알약 윗변 y·높이 */
  top: number
  ih: number
  /** 한 칸 거리(가운데 사이 평균) — 늘어남을 재는 기준(D7 ICON_STEP) */
  step: number
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.01
const sameGeometry = (a: Geometry, b: Geometry) =>
  near(a.width, b.width) &&
  near(a.height, b.height) &&
  near(a.top, b.top) &&
  near(a.ih, b.ih) &&
  a.items.length === b.items.length &&
  a.items.every((t, i) => near(t.pos, b.items[i].pos) && near(t.size, b.items[i].size))

/** D7 표시 알약 높이 — 물방울·물결 값(fx.ts)의 기준 */
const D7_INDICATOR_H = 50.5
/** 고른 글자·아이콘 배율(_controls.scss .water-seg__label) — 아이콘이 덮였는지 볼 때 커진 크기로 잡는다 */
const ON_SCALE = 1.15
/** 움직임이 끝났다고 보는 때 — 표시 알약 엔진과 같다(0.9s) */
const SETTLE = 0.9

function WaterSegmentedPill<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  effect = 'bounce',
  iconOnly = false,
  groove = false,
  disabled = false,
  className,
}: Omit<WaterSegmentedProps<T>, 'variant'>) {
  const index = options.findIndex((o) => o.value === value)
  const count = options.length
  const reduced = useReducedMotion()
  // 물결은 표시 알약 밑(D7: 유리 속 고리 위에 표시 알약), 물방울은 맨 위에 그린다 — 엔진 두 개를 같은
  // 시각으로 돌리고 한쪽씩만 보인다(_controls.scss .water-seg__fx--under·--over). 엔진(SVG 노드 약 40개씩)은
  // 처음 고를 때 만든다 — 한 번도 안 누른 고르기·effect="none"은 빈 <svg> 두 장뿐
  const underRef = useRef<SVGSVGElement>(null)
  const overRef = useRef<SVGSVGElement>(null)
  const fxEngines = useRef<WaterFxEngine[] | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLSpanElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const geo = useRef<Geometry | null>(null)
  /** 누른 시각(waterClock) — 값이 바뀐 뒤 효과에서 엔진의 at으로 넘긴다 */
  const pressedAt = useRef<number | undefined>(undefined)
  /** 표시 알약이 가 있는(가는 중인) 칸 */
  const shown = useRef(-1)
  const movedAt = useRef(-Infinity)
  const latest = useRef({ index, effect, reduced })
  /** 아이콘만 — 칸마다 표시 알약이 이만큼(알약 기준 x 왼쪽·오른쪽 끝)을 덮어야 아이콘이 다 가려진다 */
  const iconSpans = useRef<[number, number][]>([])
  /** 표시 알약이 다 덮은 아이콘 — 바뀐 칸에만 data-under를 고친다 */
  const under = useRef<boolean[]>([])

  // 아이콘만 — 그릴 때마다(같은 프레임) 표시 알약이 아이콘을 다 덮었는지 보고 data-under를 단다. 덮인 아이콘은
  // D7 그대로, 나머지는 둘레 그림자(_controls.scss) — 고른 값이 아니라 알약 위치로 나눠서, 그림자는 늘 어두운
  // 알약 밑에서만 켜지고 꺼진다(누르자마자 꺼지지 않는다)
  const markUnder = (pose: IndicatorPose) => {
    const half = (pose.size * pose.along) / 2
    iconSpans.current.forEach(([a, b], i) => {
      const covered = pose.pos - half <= a && pose.pos + half >= b
      if (covered === under.current[i]) return
      under.current[i] = covered
      items.current[i]?.toggleAttribute('data-under', covered)
    })
  }

  // 고른 글자 창 — 표시 알약이 그려질 때마다(엔진 onDraw, 같은 rAF 안) 같은 모양으로 따라가고, 안쪽 흰 글자
  // 줄은 거꾸로 옮겨 제자리에 둔다(창이 늘어나도 글자는 그대로, 알약과 겹친 만큼만 흰 글자). 창 transform은
  // 알약 문자열을 그대로 쓰고, 안쪽은 그 역(scale(1/a, 1/b) · translate(-x))이다
  const followIndicator = (pose: IndicatorPose) => {
    if (iconOnly) markUnder(pose)
    const ind = indicatorRef.current
    const win = windowRef.current
    const inner = innerRef.current
    if (!ind || !win || !inner) return
    win.style.width = ind.style.width
    win.style.transform = ind.style.transform
    const g = geo.current
    if (!g) return
    const width = round3(pose.size)
    const along = round3(pose.along)
    const across = round3(pose.across)
    inner.style.transformOrigin = `${round3(width / 2)}px ${round3(g.top + g.ih / 2)}px`
    inner.style.transform = `scale(${1 / along}, ${1 / across}) translate(${-round3(pose.pos - pose.size / 2)}px, 0)`
  }
  const { ref: indicatorRef, engine: indicatorEngine } = useWaterIndicator<HTMLSpanElement>({ onDraw: followIndicator })

  useLayoutEffect(() => {
    latest.current = { index, effect, reduced }
  })

  // 재기 — 처음 한 번과 크기가 바뀔 때(창·글꼴·글자). 움직이는 중이면 끊지 않고 새 자리로 이어 간다
  const layoutKey = `${size}|${iconOnly}|${groove}|${options.map((o) => `${o.value}:${o.label}`).join('|')}`
  useLayoutEffect(() => {
    const root = rootRef.current
    const ind = indicatorRef.current
    // 흰 글자 창은 글자 모드에만 있다(아이콘만이면 아이콘이 늘 흰색이라 창이 필요 없다)
    const win = windowRef.current
    const inner = innerRef.current
    if (!root || !ind) return
    // 효과가 붙을 때마다 엔진이 새로 생긴다(StrictMode는 두 번 붙인다) — 첫 재기는 모양이 같아도 놓는다
    let placed = false
    const measure = () => {
      const btns = items.current.slice(0, count)
      if (btns.length === 0 || btns.some((b) => !b)) return
      // 소수까지 잰다(offset 값은 정수로 반올림돼 표시 알약이 글자에서 0.5px까지 어긋난다)
      const scale = layoutScale(root)
      const boxes = (btns as HTMLButtonElement[]).map((b) => boxWithin(b, root, scale))
      const list = boxes.map((b) => ({ pos: round3(b.x + b.width / 2), size: round3(b.width) }))
      const last = list[list.length - 1]
      const g: Geometry = {
        width: round3(cssWidth(root)),
        height: round3(boxWithin(root, root, scale).height),
        items: list,
        top: round3(boxes[0].y),
        ih: round3(boxes[0].height),
        step: list.length > 1 ? (last.pos - list[0].pos) / (list.length - 1) : list[0].size,
      }
      const prev = geo.current
      // ResizeObserver는 처음 붙일 때도 한 번 부른다 — 모양이 그대로면 움직임을 다시 걸지 않는다
      if (placed && prev && sameGeometry(prev, g)) return
      placed = true
      geo.current = g
      if (iconOnly) {
        // 아이콘 상자(고르면 1.15배)가 알약 둥근 끝(반지름 = 높이 / 2)에 걸리지 않을 만큼 끝에서 안쪽으로 잡는다.
        // 가운데는 커져도 그대로라 상자 가운데를 쓰고, 크기는 transform을 빼고 잰 CSS 폭·높이로 잡는다
        const r = g.ih / 2
        const cy = g.top + r
        iconSpans.current = (btns as HTMLButtonElement[]).map((b) => {
          const icon = b.querySelector('.water-seg__icon') ?? b
          const box = boxWithin(icon, root, scale)
          const half = (parseFloat(getComputedStyle(icon).height) * ON_SCALE) / 2
          const dy = Math.min(r, Math.abs(box.y + box.height / 2 - cy) + half)
          const hw = (cssWidth(icon) * ON_SCALE) / 2 + r - Math.sqrt(r * r - dy * dy)
          const cx = box.x + box.width / 2
          return [round3(cx - hw), round3(cx + hw)]
        })
        // 칸이 새로 생겼을 수도 있다 — 다음 그리기에서 모두 다시 단다
        under.current = []
      }
      if (!prev || !near(prev.top, g.top) || !near(prev.ih, g.ih) || !near(prev.width, g.width)) {
        for (const el of [ind, win]) {
          if (!el) continue
          el.style.top = `${g.top}px`
          el.style.height = `${g.ih}px`
        }
        if (inner) {
          inner.style.top = `${-g.top}px`
          inner.style.width = `${g.width}px`
        }
      }
      const e = indicatorEngine.current
      const i = latest.current.index
      const t = g.items[i]
      if (!e || !t) return
      const moving = waterClock() - movedAt.current < SETTLE && !latest.current.reduced
      e.set(t, moving ? { step: g.step } : { instant: true })
      shown.current = i
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(root)
    items.current.slice(0, count).forEach((b) => b && ro.observe(b))
    return () => ro.disconnect()
  }, [layoutKey, count, iconOnly, indicatorRef, indicatorEngine])

  // 고른 칸이 바뀌면 — 표시 알약을 옮기고 물방울을 띄운다(누른 시각부터 잰다)
  useLayoutEffect(() => {
    const e = indicatorEngine.current
    const g = geo.current
    const prev = shown.current
    const t = g?.items[index]
    if (!e || !g || !t || prev === index) return
    shown.current = index
    const at = pressedAt.current
    pressedAt.current = undefined
    if (prev < 0 || latest.current.reduced) {
      e.set(t, { instant: true })
      return
    }
    e.set(t, { at, step: g.step })
    movedAt.current = at ?? waterClock()
    const fx = latest.current.effect
    if (fx === 'none') return
    const opts: WaterDropOptions = {
      effect: fx,
      x: t.pos,
      // 물방울은 아직 넘쳐 있는 표시 알약을 따라 솟는다(D7)
      follow: (now) => e.posAt(now),
      surface: g.top,
      rippleY: g.top + g.ih / 2,
      scale: g.ih / D7_INDICATOR_H,
      steps: Math.abs(index - prev),
      clip: { x: 0, y: 0, width: g.width, height: g.height, radius: g.height / 2 },
      at,
    }
    if (!fxEngines.current) {
      const u = underRef.current
      const o = overRef.current
      if (!u || !o) return
      fxEngines.current = [new WaterFxEngine(u), new WaterFxEngine(o)]
    }
    fxEngines.current.forEach((fxe) => fxe.trigger(opts))
  }, [index, indicatorEngine])

  // 물방울 엔진 정리 — 떼면 rAF를 멈추고 SVG를 비운다
  useLayoutEffect(
    () => () => {
      fxEngines.current?.forEach((fxe) => fxe.destroy())
      fxEngines.current = null
    },
    [],
  )

  const select = (i: number) => {
    const o = options[i]
    if (!o || disabled || o.value === value) return
    pressedAt.current = waterClock()
    onChange(o.value)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = rovingIndex(e.key, index, count)
    if (next === null || disabled) return
    e.preventDefault()
    items.current[next]?.focus()
    select(next)
  }

  return (
    <div
      ref={rootRef}
      className={cx(
        'water-seg',
        `water-seg--${size}`,
        groove && 'water-seg--groove',
        iconOnly && 'water-seg--icons',
        disabled && 'is-disabled',
        className,
      )}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
    >
      <svg ref={underRef} className="water-seg__fx water-seg__fx--under" aria-hidden focusable="false" />
      {groove && <span className="water-seg__groove" aria-hidden />}
      <span ref={indicatorRef} className="water-seg__indicator" aria-hidden />
      <div className="water-seg__row">
        {options.map((o, i) => (
          <button
            key={o.value}
            ref={(el) => {
              items.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={i === index}
            aria-label={iconOnly ? o.label : undefined}
            tabIndex={i === index || (index < 0 && i === 0) ? 0 : -1}
            disabled={disabled}
            className={cx('water-seg__item', i === index && 'is-on')}
            onClick={() => select(i)}
          >
            <SegmentLabel option={o} iconOnly={iconOnly} overlay={!iconOnly} />
          </button>
        ))}
      </div>
      {/* 아이콘만이면 D7처럼 모든 아이콘이 흰색이라 흰 글자 창이 없다(한 겹) */}
      {!iconOnly && (
        <span ref={windowRef} className="water-seg__window" aria-hidden>
          <span ref={innerRef} className="water-seg__row water-seg__row--on">
            {options.map((o, i) => (
              <span key={o.value} className={cx('water-seg__item', i === index && 'is-on')}>
                <SegmentLabel option={o} iconOnly={iconOnly} />
              </span>
            ))}
          </span>
        </span>
      )}
      <svg ref={overRef} className="water-seg__fx water-seg__fx--over" aria-hidden focusable="false" />
    </div>
  )
}

/** 칸 글자 — overlay면 고를 때 opacity로 떠오르는 흰 겹을 위에 얹는다(바깥 줄, 읽어 주기에서는 뺀다) */
function SegmentLabel<T extends string>({
  option,
  iconOnly,
  overlay = false,
}: {
  option: WaterOption<T>
  iconOnly: boolean
  overlay?: boolean
}) {
  const Icon = option.icon
  const face = (
    <>
      {Icon && <Icon className="water-seg__icon" />}
      {!iconOnly && <span className="water-seg__text">{option.label}</span>}
    </>
  )
  return (
    <span className="water-seg__label">
      <span className={cx('water-seg__face', overlay && 'water-seg__face--ink')}>{face}</span>
      {overlay && (
        <span className="water-seg__face water-seg__face--on" aria-hidden>
          {face}
        </span>
      )}
    </span>
  )
}

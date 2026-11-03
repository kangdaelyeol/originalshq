import { motion, useAnimation, type MotionStyle, type TargetAndTransition, type Variants } from 'motion/react'
import { createElement, useEffect, useId, useImperativeHandle, type ElementType, type ReactNode } from 'react'
import { ICON_NODES, type IconName } from './icon-nodes'
import { restOf, subscribeLoop } from './icon-motion'
import type { AnimatedIconProps, IconNode, IconPart, IconSpec } from './icon-types'

const MOTION_TAGS: Record<IconNode[0], ElementType> = {
  path: motion.path,
  line: motion.line,
  circle: motion.circle,
  rect: motion.rect,
  polyline: motion.polyline,
  polygon: motion.polygon,
  ellipse: motion.ellipse,
}

/** 부품 굵기 배수를 움직이는 CSS 변수 이름 — 스펙의 play에 이 키로 키프레임을 준다 */
const THICK_VAR = '--d3-k'

// 스펙은 모듈 상수라 객체가 바뀌지 않는다 — variants를 부품마다 한 번만 만든다.
const variantCache = new WeakMap<object, Variants>()
const EMPTY_VARIANTS: Variants = { normal: {}, animate: {} }

function variantsOf(owner: object, play: TargetAndTransition | undefined): Variants {
  if (!play) return EMPTY_VARIANTS
  let variants = variantCache.get(owner)
  if (!variants) {
    variants = { normal: restOf(play), animate: play }
    variantCache.set(owner, variants)
  }
  return variants
}

// 부품이 쓰지 않는 원본 도형 번호 — 움직이지 않으니 평범한 요소로 그린다.
const staticCache = new WeakMap<IconSpec, number[]>()

function staticNodes(spec: IconSpec, count: number): number[] {
  let list = staticCache.get(spec)
  if (!list) {
    const used = new Set<number>()
    const walk = (parts: readonly IconPart[]) =>
      parts.forEach((part) => {
        if (typeof part.node === 'number') used.add(part.node)
        else part.node?.forEach((i) => used.add(i))
        if (part.parts) walk(part.parts)
      })
    walk(spec.parts)
    list = Array.from({ length: count }, (_, i) => i).filter((i) => !used.has(i))
    staticCache.set(spec, list)
  }
  return list
}

/**
 * 회전·확대 기준점 — view-box 기준이라 24 뷰박스 좌표를 그대로 쓴다.
 * motion은 style의 transformOrigin을 자기 값(originX/originY)으로 덮어쓰므로 그 두 값으로 넘긴다.
 */
function originStyle(origin: IconPart['origin']): MotionStyle | undefined {
  return origin ? { transformBox: 'view-box', originX: `${origin[0]}px`, originY: `${origin[1]}px` } : undefined
}

function renderPart(part: IconPart, nodes: readonly IconNode[], key: string, uid: string): ReactNode {
  const variants = variantsOf(part, part.play)
  // 굵기 배수는 아이콘 굵기(--d3-stroke)에 곱한다 — 쓰는 쪽이 strokeWidth를 바꿔도 비율이 유지된다.
  // 재생 중에 굵기가 변하는 부품은 CSS 변수 --d3-k를 키프레임으로 움직이고 그 값을 한 번 더 곱한다.
  const animThick = !!part.play && THICK_VAR in part.play
  const thick: MotionStyle | undefined =
    part.stroke || animThick ? { strokeWidth: `calc(var(--d3-stroke) * ${part.stroke ?? 1}${animThick ? ` * var(${THICK_VAR}, 1)` : ''})` } : undefined
  const style = part.origin || thick ? { ...originStyle(part.origin), ...thick } : undefined
  const ids = part.node === undefined ? [] : typeof part.node === 'number' ? [part.node] : part.node
  const shapes: IconNode[] = ids.map((i) => nodes[i])
  if (part.shape) shapes.push(part.shape)
  let body: ReactNode
  // 도형 하나뿐이면 그 도형이 직접 움직인다 — pathLength·x1 같은 속성은 g에 걸 수 없다.
  if (!part.parts && shapes.length === 1) {
    const [tag, attrs] = shapes[0]
    body = createElement(MOTION_TAGS[tag], { key, ...attrs, ...part.attrs, variants, style })
  } else {
    body = (
      <motion.g key={key} {...part.attrs} variants={variants} style={style}>
        {shapes.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
        {part.parts?.map((child, i) => renderPart(child, nodes, `${key}.${i}`, uid))}
      </motion.g>
    )
  }
  if (!part.clip) return body
  // 잘라 보이기 — 움직이는 부품 바깥의 고정된 창(클립)이라 변형이 걸리지 않는 g에 단다.
  const clipId = `${uid}${key.replace(/\./g, '-')}`
  return (
    <g key={key} clipPath={`url(#${clipId})`}>
      <clipPath id={clipId}>{part.clip.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}</clipPath>
      {body}
    </g>
  )
}

interface AnimatedIconBaseProps extends AnimatedIconProps {
  icon: IconName
  spec: IconSpec
}

/**
 * 움직이는 아이콘의 몸통 — 스펙(부품별 키프레임)을 motion 요소로 그린다.
 * 재생은 세 갈래: 마우스 hover, active 신호, 공용 시계(loop). 모두 같은 'animate' 상태를 건다.
 */
export function AnimatedIcon({
  icon,
  spec,
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  animateOnHover = true,
  active,
  loop = false,
  ref,
  style,
  onMouseEnter,
  ...rest
}: AnimatedIconBaseProps) {
  const controls = useAnimation()
  // 클립 id가 아이콘마다 달라야 한다(같은 아이콘이 한 화면에 여러 번 나와도)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  useImperativeHandle(
    ref,
    () => ({
      play: () => void controls.start('animate'),
      stop: () => {
        controls.stop()
        controls.set('normal')
      },
    }),
    [controls],
  )

  useEffect(() => {
    if (!loop) return
    return subscribeLoop(() => void controls.start('animate'))
  }, [loop, controls])

  useEffect(() => {
    if (active) void controls.start('animate')
  }, [active, controls])

  const nodes = spec.nodes ?? ICON_NODES[icon]
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={rest['aria-label'] ? undefined : true}
      {...rest}
      style={{ ...(spec.overflow && { overflow: 'visible' }), '--d3-stroke': strokeWidth, ...style } as MotionStyle}
      variants={variantsOf(spec, spec.root)}
      initial="normal"
      animate={controls}
      onMouseEnter={(event) => {
        if (animateOnHover) void controls.start('animate')
        onMouseEnter?.(event)
      }}
    >
      {staticNodes(spec, nodes.length).map((i) => createElement(nodes[i][0], { key: `s${i}`, ...nodes[i][1] }))}
      {spec.parts.map((part, i) => renderPart(part, nodes, `p${i}`, uid))}
    </motion.svg>
  )
}

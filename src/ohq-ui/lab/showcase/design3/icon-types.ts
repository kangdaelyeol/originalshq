import type { TargetAndTransition } from 'motion/react'
import type { Ref, SVGProps } from 'react'

export type IconTag = 'path' | 'line' | 'circle' | 'rect' | 'polyline' | 'polygon' | 'ellipse'

/** 도형 하나 — [태그, 속성]. Feather/Lucide의 iconNode와 같은 꼴 */
export type IconNode = readonly [IconTag, Readonly<Record<string, string | number>>]

/**
 * 움직이는 단위. 도형 하나(node가 숫자 하나)면 그 도형이 직접 움직이고(pathLength도 가능),
 * 여럿이거나 parts가 있으면 g로 묶어 함께 움직인다.
 */
export interface IconPart {
  /** 그릴 도형 — 아이콘 도형 목록의 번호 */
  node?: number | readonly number[]
  /** 원본에 없는 도형(쪼갠 조각·복제본) */
  shape?: IconNode
  /** 묶음 안의 부품들 — 묶음 전체 움직임(play) 위에 각자 움직임이 겹친다 */
  parts?: readonly IconPart[]
  /**
   * 재생 때 키프레임 — motion의 TargetAndTransition(play() 도우미로 만든다).
   * '--d3-k' 키를 주면 선 굵기 배수가 그 값을 따라 변한다(재생 중 굵어지는 도형).
   */
  play?: TargetAndTransition
  /** 변형 기준점(24 뷰박스 좌표). 없으면 도형 자기 상자의 가운데 */
  origin?: readonly [number, number]
  /** 이 부품만 이 도형들 안쪽으로 잘라 보인다(고정된 창 — 부품이 움직여도 창은 그대로) */
  clip?: readonly IconNode[]
  /** 요소에 더 줄 속성(처음 값 opacity 등) */
  attrs?: Readonly<Record<string, string | number>>
  /** 선 굵기 배수 — 아이콘 strokeWidth에 곱한다(굵은 글씨처럼 굵어지는 겹 등) */
  stroke?: number
}

export interface IconSpec {
  /** 도형 목록을 통째로 바꿀 때(조각낸 경로 등). 없으면 ICON_NODES[name] */
  nodes?: readonly IconNode[]
  parts: readonly IconPart[]
  /** svg 전체 움직임 */
  root?: TargetAndTransition
  /** 뷰박스 밖으로 나가도 잘리지 않게(기본은 svg가 24 상자에서 자른다) */
  overflow?: boolean
}

export interface AnimatedIconHandle {
  /** 한 번 재생 */
  play: () => void
  /** 멈추고 제자리로 */
  stop: () => void
}

export interface AnimatedIconProps extends Omit<SVGProps<SVGSVGElement>, 'ref' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'values'> {
  /** 한 변 길이(px 숫자 또는 CSS 길이) — 기본 24 */
  size?: number | string
  /** 선 색 — 기본 currentColor */
  color?: string
  /** 선 굵기(24 뷰박스 기준) — 기본 2 */
  strokeWidth?: number | string
  /** 마우스를 올리면 한 번 재생 — 기본 true */
  animateOnHover?: boolean
  /** false→true로 바뀔 때 한 번 재생 — 부모 버튼 hover 같은 바깥 신호로 조종할 때 */
  active?: boolean
  /** 공용 시계에 맞춰 반복 재생 — 견본처럼 여러 아이콘을 함께 돌릴 때 */
  loop?: boolean
  ref?: Ref<AnimatedIconHandle>
}

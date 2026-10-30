import { stagger, useAnimate, useMotionValue, type ValueAnimationTransition } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'
import { useElementSize } from '../../lib/use-element-size'
import { PIECE } from './shape'

const HALF = PIECE / 2
// 조각이 모서리 ↔ 가운데를 오가는 스프링 — 살짝 튕기며 멈춘다. restDelta·restSpeed를
// 넉넉히 줘서, 눈에 안 보이는 미세한 떨림까지 기다리지 않고 다음 단계로 넘어가게 한다.
const TRAVEL: ValueAnimationTransition = {
  type: 'spring',
  stiffness: 210,
  damping: 23,
  mass: 0.9,
  restDelta: 0.5,
  restSpeed: 12,
}
// 출발 후 조각이 가운데서 만나는 데 걸리는 시간(위 스프링 기준, 실측 ~250ms + 여유).
const ARRIVE_MS = 300
// 실패 표시(✕ · 붉은 링)를 보여 주는 시간 — 그 뒤 조각이 모서리로 돌아간다.
const REJECT_HOLD_MS = 260

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * 샘플 영상의 "좌상·우하 조각" 연출.
 *   gather    — 내용이 흐려지며 사라지고, 두 조각이 빛나며 가운데로 모인다(검증 중).
 *   celebrate — 성공: ◩ 위에 로고가 뜨고 링이 퍼진다.
 *   reject    — 실패: 조각이 빨갛게 물들어 떨리고, ✕ · 붉은 링 · 카드 흔들림.
 *   split     — 조각이 다시 모서리로 돌아가고 내용이 선명하게 나타난다.
 *   exit      — 로그인 성공 뒤 화면을 넘기기 전 사라지기.
 *
 * 조각은 카드 "가운데"를 기준점으로 두고, 쉬는 동안엔 ±(폭/2, 높이/2)만큼 밀어 모서리에 둔다.
 * 그래서 폼이 바뀌어 카드 높이가 달라져도 가운데 모인 조각은 제자리에 있다(카드가 화면
 * 가운데 정렬이라 중심이 움직이지 않는다).
 */
export function useLoginChoreography() {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const [glassRef, size] = useElementSize<HTMLDivElement>()
  const tlX = useMotionValue(0)
  const tlY = useMotionValue(0)
  const brX = useMotionValue(0)
  const brY = useMotionValue(0)
  // 카드 전체 좌우 흔들림(실패) — 기울기(rotateX/Y)와 따로 겹친다.
  const shakeX = useMotionValue(0)
  // 연출 중에는 크기가 바뀌어도 조각을 모서리로 되돌리지 않는다.
  const restingRef = useRef(true)

  useEffect(() => {
    if (!restingRef.current || size.width === 0) return
    const dx = size.width / 2 - HALF
    const dy = size.height / 2 - HALF
    tlX.set(-dx)
    tlY.set(-dy)
    brX.set(dx)
    brY.set(dy)
  }, [size.width, size.height, tlX, tlY, brX, brY])

  const gather = useCallback(async () => {
    restingRef.current = false
    // 테두리 번쩍임은 기다리지 않는다 — 조각이 바로 출발하게.
    animate('.login-card__flash', { opacity: [0, 1, 0.6] }, { duration: 0.5 })
    await Promise.all([
      animate('.login-content', { opacity: 0, filter: 'blur(12px)', scale: 0.97 }, { duration: 0.26, ease: 'easeIn' }),
      animate('.corner__active, .corner__glow', { opacity: 1 }, { duration: 0.26 }),
    ])
    animate(tlX, 0, TRAVEL)
    animate(tlY, 0, TRAVEL)
    animate(brX, 0, TRAVEL)
    animate(brY, 0, TRAVEL)
    // 스프링이 완전히 멈추길(살짝 튕기는 꼬리까지) 기다리면 다음 표시가 늦게 떠서, 눈으로
    // 보기에 조각이 만나는 시점에 맞춰 넘긴다.
    await wait(ARRIVE_MS)
  }, [animate, tlX, tlY, brX, brY])

  const celebrate = useCallback(() => {
    animate('.login-logo--ok', { opacity: 1, scale: [0.6, 1] }, { duration: 0.3, ease: 'easeOut' })
    // 링은 기다리지 않는다 — 퍼지는 동안 다음 단계(화면 이동·폼 교체)가 이어진다.
    animate('.login-ring--ok', { opacity: [0.95, 0], scale: [0.45, 2.7] }, { duration: 0.9, ease: 'easeOut', delay: stagger(0.17) })
  }, [animate])

  const merge = useCallback(async () => {
    await gather()
    celebrate()
  }, [gather, celebrate])

  const reject = useCallback(async () => {
    animate('.login-card__flash', { opacity: 0 }, { duration: 0.15 })
    animate('.login-card__flash-error', { opacity: [0, 1, 0.5] }, { duration: 0.45 })
    await animate('.corner__error, .corner__error-glow', { opacity: 1 }, { duration: 0.16 })
    animate('.login-logo--fail', { opacity: 1, scale: [0.6, 1] }, { duration: 0.24, ease: 'easeOut' })
    animate('.login-ring--fail', { opacity: [0.95, 0], scale: [0.5, 2] }, { duration: 0.6, ease: 'easeOut' })
    animate(shakeX, [0, -14, 12, -9, 6, -3, 0], { duration: 0.5, ease: 'easeInOut' })
    // 맞물렸던 두 조각이 서로 어긋나듯 떨린다.
    await Promise.all([
      animate(tlX, [0, -7, 6, -4, 2, 0], { duration: 0.42 }),
      animate(brX, [0, 7, -6, 4, -2, 0], { duration: 0.42 }),
    ])
    await wait(REJECT_HOLD_MS)
  }, [animate, shakeX, tlX, brX])

  const split = useCallback(async () => {
    // transform 영향 없는 레이아웃 크기 — 폼이 막 바뀐 직후라 ResizeObserver보다 먼저 읽는다.
    const glass = glassRef.current
    const dx = (glass?.offsetWidth ?? 0) / 2 - HALF
    const dy = (glass?.offsetHeight ?? 0) / 2 - HALF
    animate('.login-logo', { opacity: 0, scale: 0.7 }, { duration: 0.2 })
    await Promise.all([
      animate(tlX, -dx, TRAVEL),
      animate(tlY, -dy, TRAVEL),
      animate(brX, dx, TRAVEL),
      animate(brY, dy, TRAVEL),
      animate('.corner__active, .corner__glow, .corner__error, .corner__error-glow', { opacity: 0 }, { duration: 0.6, delay: 0.25 }),
      animate('.login-card__flash, .login-card__flash-error', { opacity: 0 }, { duration: 0.6 }),
      animate('.login-content', { opacity: 1, filter: 'blur(0px)', scale: 1 }, { duration: 0.42, delay: 0.18, ease: 'easeOut' }),
    ])
    restingRef.current = true
  }, [animate, glassRef, tlX, tlY, brX, brY])

  /** 로그인 직후 화면을 넘기기 전 — 유리는 살짝 커지며 사라지고, 로고는 앞으로 튀어나오며 흩어진다.
   * 겉 motion.div 대신 겹마다 opacity를 건다(겉에 걸면 유리 흐림이 풀린다 — login-card.tsx 주석). */
  const exit = useCallback(async () => {
    await Promise.all([
      animate('.login-card__glass, .login-card__rim, .login-card__shadow', { opacity: 0, scale: 1.04 }, { duration: 0.34, ease: 'easeIn' }),
      animate('.corner, .login-logo--ok', { opacity: 0, scale: 1.6 }, { duration: 0.34, ease: 'easeIn' }),
    ])
  }, [animate])

  /** 이름을 주면 그 칸을 골라 내용을 선택해 둔다(실패 뒤 바로 다시 입력하게), 없으면 첫 칸. */
  const focusField = useCallback(
    (name?: string) => {
      const selector = name ? `.login-content input[name="${name}"]` : '.login-content input'
      const input = scope.current?.querySelector<HTMLInputElement>(selector)
      input?.focus()
      if (name) input?.select()
    },
    [scope],
  )

  return {
    scope,
    glassRef,
    size,
    pieces: { tlX, tlY, brX, brY },
    shakeX,
    gather,
    celebrate,
    merge,
    reject,
    split,
    exit,
    focusField,
  }
}

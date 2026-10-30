import type { Transition, Variants } from 'motion/react'

// ⚠️ 페이지 감싸개(부모)에는 opacity를 걸지 않는다. opacity<1인 조상은 backdrop-filter의
// "backdrop root"가 돼서, 그 안의 유리 카드가 배경을 못 보고 흐림이 사라진다. 그래서
// 등장 애니메이션은 카드 하나하나(cardEnter)에만 걸고, 부모는 순서(stagger)만 준다.
export const pageStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
}

export const cardEnter: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
}

/** 카드 hover 들어올림 — 샘플 코드의 whileHover={{ y: -5 }}. */
export const liftSpring: Transition = { type: 'spring', stiffness: 380, damping: 28 }

import {
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react'
import { useEffect } from 'react'

// 화면 가장자리에서의 최대 기울기(도).
const MAX_TILT_X = 7
const MAX_TILT_Y = 9
const SPRING = { stiffness: 150, damping: 20, mass: 0.6 }

/** 마우스 위치에 따라 카드를 3D로 기울인다 — 화면 가운데가 0°, 가장자리로 갈수록 최대.
 * 커서 쪽 면이 안으로 눌리고, 빛 반사(glare)는 커서를 따라 카드 위를 움직인다.
 * 터치 입력과 "동작 줄이기" 설정에서는 움직이지 않는다. */
export function usePointerTilt() {
  const reduceMotion = useReducedMotion()
  const px = useMotionValue(0)
  const py = useMotionValue(0)

  const rotateX = useSpring(useTransform(py, [-1, 1], [MAX_TILT_X, -MAX_TILT_X]), SPRING)
  const rotateY = useSpring(useTransform(px, [-1, 1], [-MAX_TILT_Y, MAX_TILT_Y]), SPRING)
  const glareX = useSpring(useTransform(px, [-1, 1], [8, 92]), SPRING)
  const glareY = useSpring(useTransform(py, [-1, 1], [4, 96]), SPRING)
  const glare = useMotionTemplate`radial-gradient(560px circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.15), transparent 55%)`

  useEffect(() => {
    if (reduceMotion) return
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      px.set((e.clientX / window.innerWidth) * 2 - 1)
      py.set((e.clientY / window.innerHeight) * 2 - 1)
    }
    const onLeave = () => {
      px.set(0)
      py.set(0)
    }
    const root = document.documentElement
    window.addEventListener('pointermove', onMove)
    root.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
    }
  }, [px, py, reduceMotion])

  return { rotateX, rotateY, glare }
}

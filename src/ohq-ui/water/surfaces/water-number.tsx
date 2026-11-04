import { useLayoutEffect, useRef, useState } from 'react'
import { cx } from '../../lib/cx'
import { useReducedMotion } from '../hooks'
import { WATER_REVEAL, WATER_SPRING, round3 } from '../motion'
import {
  ROLL_CELL,
  ROLL_STRIP,
  planRoll,
  rollNormalize,
  rollRest,
  rollTarget,
  type RollPlan,
  type RollToken,
} from './roll'
import { runSpring, type SpringRun } from '../spring-run'

interface WaterNumberProps {
  /** 보여 줄 값 — 글자 안의 첫 숫자만 굴린다("12건", "1.4일", "1,284") */
  value: string | number
  className?: string
}

const stripTransform = (p: number) => `translate(-50%, ${round3(-p * ROLL_CELL)}em)`

/**
 * 숫자 굴림 — 값이 바뀌면 바뀐 숫자 칸만 띠를 굴린다(오도미터). 한 칸씩 자리를 옮기는 움직임이라 D7 표시 알약
 * 스프링(ζ0.65·ω30.5 — 7% 넘쳤다가 F+7에 제자리)을 쓰고, 왼쪽 칸부터 WATER_REVEAL.stagger(21ms) 간격으로
 * 출발한다(D7 아이콘이 왼쪽부터 차례로 — F82 → F86). extend(16% 넘침)는 0 → 9 굴림에서 1.4칸이나 넘쳐 과하다.
 * 쉬는 동안은 그냥 글자(비례 숫자)이고 굴리는 동안만 칸을 그린다 — 칸 너비는 새 숫자 글자 너비라 다 굴러간 뒤
 * 글자로 돌아와도 자리가 그대로다. 동작 줄이기면 바로 바꾼다.
 */
export function WaterNumber({ value, className }: WaterNumberProps) {
  const text = String(value)
  const reduced = useReducedMotion()
  const [prev, setPrev] = useState(text)
  const [plan, setPlan] = useState<RollPlan | null>(null)
  if (text !== prev) {
    setPrev(text)
    setPlan(reduced ? null : planRoll(prev, text))
  }

  const strips = useRef(new Map<string, HTMLSpanElement>())
  const runs = useRef(new Map<string, SpringRun>())

  useLayoutEffect(() => {
    const live = runs.current
    if (!plan) {
      live.clear()
      return
    }
    let pending = 0
    plan.moves.forEach((move, i) => {
      const el = strips.current.get(move.key)
      if (!el) return
      // 굴리는 도중이면 지금 자리·빠르기에서 이어 간다
      const old = live.get(move.key)
      const cur = old?.busy() ? old.sample() : null
      old?.cancel()
      const from = cur ? rollNormalize(cur.x) : rollRest(move.from)
      const to = rollTarget(from, move.digit, plan.up)
      el.style.transform = stripTransform(to)
      if (Math.abs(to - from) < 1e-3 && !cur?.v) return
      pending += 1
      live.set(
        move.key,
        runSpring(el, {
          from,
          to,
          v0: cur?.v ?? 0,
          spec: WATER_SPRING.indicator,
          delay: cur ? 0 : i * WATER_REVEAL.stagger,
          frame: (x) => ({ transform: stripTransform(x) }),
          onDone: () => {
            pending -= 1
            if (pending === 0) setPlan(null)
          },
        }),
      )
    })
    if (pending === 0) void Promise.resolve().then(() => setPlan(null))
  }, [plan])

  useLayoutEffect(() => {
    const live = runs.current
    return () => {
      live.forEach((r) => r.cancel())
      live.clear()
    }
  }, [])

  if (!plan) return <span className={cx('water-number', className)}>{text}</span>
  const moving = new Set(plan.moves.map((m) => m.key))
  return (
    <span className={cx('water-number', 'is-rolling', className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {plan.tokens.map((t: RollToken) =>
          t.kind === 'text' ? (
            <span key={t.key}>{t.text}</span>
          ) : moving.has(t.key) ? (
            <span key={t.key} className="water-number__col">
              <span className="water-number__size">{t.digit}</span>
              <span
                ref={(el) => {
                  if (el) strips.current.set(t.key, el)
                  else strips.current.delete(t.key)
                }}
                className="water-number__strip"
              >
                {ROLL_STRIP}
              </span>
            </span>
          ) : (
            <span key={t.key}>{t.digit}</span>
          ),
        )}
      </span>
    </span>
  )
}

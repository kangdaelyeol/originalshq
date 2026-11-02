import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
} from 'react'
import { cx } from '../../../lib/cx'
import { JellyEngine } from './jelly-engine'
import type { JellyLayers } from './jelly-renderer'

export interface JellySliderHandle {
  /** 영상 속 끌기(48% → 끝까지 → 34% → 48%, 2.5초)를 처음부터 */
  playDemo: () => void
  stopDemo: () => void
  /** 영상의 한 프레임(F36~F110)으로 맞춰 멈춘다 — 영상과 나란히 비교할 때 */
  seekDemo: (frame: number) => void
}

interface JellySliderProps {
  /** 0~100 — 주면 controlled */
  value?: number
  defaultValue?: number
  onChange?: (value: number) => void
  /** 영상 끌기 재생이 시작·끝날 때 */
  onDemoChange?: (playing: boolean) => void
  /** 읽어 줄 이름 */
  label?: string
  className?: string
  /** 견본용 — 부품을 끄고 켠다(처음 값만 쓴다) */
  layers?: JellyLayers
  /** 레이마칭 해상도(CSS 1px당 픽셀, 기본 1) — 처음 값만 쓴다 */
  resolution?: number
  ref?: Ref<JellySliderHandle>
}

const KEY_STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  PageUp: 10,
  PageDown: -10,
}

/**
 * 젤리 슬라이더(Design 4) — 회색 판에 파인 홈 속 주황 젤리. 끝(손잡이)을 잡고 끌면 젤리가 늘어나
 * 홈에 눕고, 왼쪽으로 밀면 남는 길이가 혹처럼 솟아 출렁인다. 바닥에 지금 값(%)이 새겨져 있다.
 * 장면 전체가 하나의 슬라이더다: 아무 데나 누르면 그 자리로, 손잡이를 잡으면 그대로 끈다.
 * 키보드 ←/→(1) · PageUp/PageDown(10) · Home/End.
 */
export function JellySlider({
  value,
  defaultValue = 48,
  onChange,
  onDemoChange,
  label = '젤리 슬라이더',
  className,
  layers,
  resolution,
  ref,
}: JellySliderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<JellyEngine | null>(null)
  const [inner, setInner] = useState(() => value ?? defaultValue)
  const [cursor, setCursor] = useState<'none' | 'grab' | 'grabbing'>('none')
  const [error, setError] = useState<string | null>(null)
  const current = value ?? inner

  // 엔진은 한 번만 만든다 — 처음 값·최신 콜백은 ref로 넘긴다
  const initial = useRef({ value: current, layers, resolution })
  const callbacks = useRef({ onChange, onDemoChange })
  useLayoutEffect(() => {
    callbacks.current = { onChange, onDemoChange }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { value: start, layers: startLayers, resolution: startResolution } = initial.current
    const engine = new JellyEngine(canvas, {
      value: start,
      layers: startLayers,
      resolution: startResolution,
      onValue: (v) => {
        setInner(v)
        callbacks.current.onChange?.(v)
      },
      onDemo: (playing) => callbacks.current.onDemoChange?.(playing),
      onError: setError,
    })
    engineRef.current = engine
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  // controlled 값이 밖에서 바뀌면 손잡이를 그리로
  useEffect(() => {
    if (value !== undefined) engineRef.current?.setValue(value)
  }, [value])

  useImperativeHandle(
    ref,
    () => ({
      playDemo: () => engineRef.current?.playDemo(),
      stopDemo: () => engineRef.current?.stopDemo(),
      seekDemo: (frame) => engineRef.current?.seekDemo(frame),
    }),
    [],
  )

  const toUV = (e: PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] as const
  }

  const release = (e: PointerEvent) => {
    const engine = engineRef.current
    if (!engine) return
    engine.pointerUp()
    const [u, v] = toUV(e)
    setCursor(engine.isOverKnob(u, v) ? 'grab' : 'none')
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const engine = engineRef.current
    let next: number
    if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = 100
    else if (KEY_STEPS[e.key]) next = current + KEY_STEPS[e.key]
    else return
    e.preventDefault()
    next = Math.min(100, Math.max(0, next))
    if (next === current || !engine) return
    engine.setValue(next)
    setInner(next)
    onChange?.(next)
  }

  return (
    <div
      className={cx('d4-slider', cursor !== 'none' && `is-${cursor}`, className)}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={current}
      aria-valuetext={`${current}%`}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        const engine = engineRef.current
        if (e.button !== 0 || !engine) return
        e.currentTarget.setPointerCapture(e.pointerId)
        const [u, v] = toUV(e)
        engine.pointerDown(u, v)
        setCursor('grabbing')
      }}
      onPointerMove={(e) => {
        const engine = engineRef.current
        if (!engine) return
        const [u, v] = toUV(e)
        if (cursor === 'grabbing') engine.pointerMove(u, v)
        else setCursor(engine.isOverKnob(u, v) ? 'grab' : 'none')
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={() => {
        if (cursor === 'grab') setCursor('none')
      }}
    >
      <canvas ref={canvasRef} className="d4-slider__canvas" aria-hidden />
      {error && <p className="d4-slider__error">이 브라우저에서는 그릴 수 없어요({error})</p>}
    </div>
  )
}

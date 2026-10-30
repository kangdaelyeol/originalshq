import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { ParticleField } from './particle-field'

interface UseParticleFieldOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  slotRef: RefObject<HTMLElement | null>
  logoUrl: string
  fallbackText: string
  subtitle?: string
  accentColor: string
  reducedMotion: boolean
  onSettle: () => void
}

/** 입자 엔진을 화면에 붙였다 뗀다 — 건너뛰기·다시 모으기만 바깥에 내준다. */
export function useParticleField({
  canvasRef,
  slotRef,
  logoUrl,
  fallbackText,
  subtitle,
  accentColor,
  reducedMotion,
  onSettle,
}: UseParticleFieldOptions) {
  const engineRef = useRef<ParticleField | null>(null)
  // 엔진은 한 번만 만들고, 콜백이 바뀌어도 다시 만들지 않게 최신 것만 ref로 넘긴다.
  const onSettleRef = useRef(onSettle)
  useEffect(() => {
    onSettleRef.current = onSettle
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const slot = slotRef.current
    if (!canvas || !slot) return
    const engine = new ParticleField({
      canvas,
      slot,
      logoUrl,
      fallbackText,
      subtitle,
      accentColor,
      reducedMotion,
      onSettle: () => onSettleRef.current(),
    })
    engineRef.current = engine
    engine.start()
    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [canvasRef, slotRef, logoUrl, fallbackText, subtitle, accentColor, reducedMotion])

  const skip = useCallback(() => engineRef.current?.skip(), [])
  const replay = useCallback(() => engineRef.current?.replay(), [])
  return { skip, replay }
}

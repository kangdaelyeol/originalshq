import { motion, type MotionValue } from 'motion/react'
import { X } from 'lucide-react'
import { useId, useMemo, type ReactNode, type RefObject } from 'react'
import type { ElementSize } from '../../lib/use-element-size'
import { cx } from '../../lib/cx'
import { XMark } from '../brand/brand-mark'
import { cardPath, PIECE, PIECE_PATH } from './shape'

interface LoginCardProps {
  /** useAnimate 범위 — 연출이 이 안의 클래스(.login-content 등)를 찾아 움직인다. */
  scope: RefObject<HTMLDivElement | null>
  glassRef: RefObject<HTMLDivElement | null>
  size: ElementSize
  tilt: { rotateX: MotionValue<number>; rotateY: MotionValue<number>; glare: MotionValue<string> }
  pieces: Record<'tlX' | 'tlY' | 'brX' | 'brY', MotionValue<number>>
  /** 로그인 실패 때 카드 전체 좌우 흔들림 */
  shakeX: MotionValue<number>
  /** 연출 중엔 폼을 못 누르게 */
  busy: boolean
  /** false면 자리만 차지하고 숨어 있다(입자 인트로 중) — true가 되는 순간 떠오른다. */
  revealed: boolean
  children: ReactNode
}

/**
 * 로그인 카드 겉모습 — 겹 순서(아래 → 위): 그림자 · 유리판(배경 흐림 + 반사 + 입자) ·
 * 외곽선(흐르는 빛) · 모서리 조각 둘 · 링 · 로고.
 *
 * ⚠️ 바깥 motion.div(기울기)에는 opacity·filter를 걸지 않는다 — 그러면 그 안의 유리들이
 * 페이지 배경을 못 보고 흐림이 사라진다(lib/motion.ts 주석과 같은 이유).
 */
export function LoginCard({ scope, glassRef, size, tilt, pieces, shakeX, busy, revealed, children }: LoginCardProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const { width, height } = size
  const shape = useMemo(() => (width > 0 ? cardPath(width, height) : null), [width, height])

  return (
    <motion.div
      ref={scope}
      className={cx('login-card', revealed && 'is-revealed')}
      // 숨어 있는 동안에도 크기는 재야 해서(조각 위치·외곽선) display 대신 visibility로 감춘다.
      style={{ x: shakeX, rotateX: tilt.rotateX, rotateY: tilt.rotateY, visibility: revealed ? 'visible' : 'hidden' }}
      initial={{ y: 28, scale: 0.97 }}
      animate={revealed ? { y: 0, scale: 1 } : { y: 28, scale: 0.97 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="login-card__shadow" aria-hidden />

      <motion.div
        ref={glassRef}
        className="login-card__glass"
        style={{ clipPath: shape ? `path('${shape}')` : undefined }}
        initial={{ opacity: 0 }}
        animate={{ opacity: revealed ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div className="login-card__glare" style={{ background: tilt.glare }} aria-hidden />
        <div className="login-card__grain" aria-hidden />
        <div className="login-content" inert={busy}>
          {children}
        </div>
      </motion.div>

      {shape && (
        <svg className="login-card__rim" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
          <defs>
            <linearGradient id={`${uid}-edge`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity={0.55} />
              <stop offset="45%" stopColor="#fff" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#fff" stopOpacity={0.3} />
            </linearGradient>
            <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" />
            </filter>
          </defs>
          <path d={shape} className="login-card__edge" stroke={`url(#${uid}-edge)`} />
          <path d={shape} className="login-card__flash" filter={`url(#${uid}-glow)`} />
          <path d={shape} className="login-card__flash-error" filter={`url(#${uid}-glow)`} />
          <path d={shape} pathLength={1000} className="login-card__beam login-card__beam--glow" filter={`url(#${uid}-glow)`} />
          <path d={shape} pathLength={1000} className="login-card__beam" />
          <path d={shape} pathLength={1000} className="login-card__beam login-card__beam--alt" />
        </svg>
      )}

      <CornerPiece corner="tl" x={pieces.tlX} y={pieces.tlY} ready={width > 0} />
      <CornerPiece corner="br" x={pieces.brX} y={pieces.brY} ready={width > 0} />

      <span className="login-ring login-ring--ok" aria-hidden />
      <span className="login-ring login-ring--ok" aria-hidden />
      <span className="login-ring login-ring--fail" aria-hidden />
      {/* 두 조각이 녹색 판으로 합쳐지면 그 위에 X — 앱 아이콘이 완성되는 순간. */}
      <span className="login-logo login-logo--ok" aria-hidden>
        <XMark />
      </span>
      <span className="login-logo login-logo--fail" aria-hidden>
        <X size={26} strokeWidth={3} />
      </span>
    </motion.div>
  )
}

interface CornerPieceProps {
  corner: 'tl' | 'br'
  x: MotionValue<number>
  y: MotionValue<number>
  ready: boolean
}

/** 모서리 유리 조각 — 평소엔 투명한 유리, 연출 중엔 강조색(.corner__active·glow)으로,
 * 로그인 실패 땐 빨간색(.corner__error·error-glow)으로 빛난다. */
function CornerPiece({ corner, x, y, ready }: CornerPieceProps) {
  const clip = `path('${PIECE_PATH[corner]}')`
  return (
    <motion.span
      className={cx('corner', `corner--${corner}`)}
      style={{ x, y, visibility: ready ? undefined : 'hidden' }}
      aria-hidden
    >
      <span className="corner__glow" />
      <span className="corner__error-glow" />
      <span className="corner__glass" style={{ clipPath: clip }} />
      <span className="corner__active" style={{ clipPath: clip }} />
      <span className="corner__error" style={{ clipPath: clip }} />
      <svg className="corner__rim" width={PIECE} height={PIECE} viewBox={`0 0 ${PIECE} ${PIECE}`}>
        <path d={PIECE_PATH[corner]} />
      </svg>
    </motion.span>
  )
}

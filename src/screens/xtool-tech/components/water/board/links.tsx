import { Plus, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { cx } from '@/ohq-ui/lib/cx'
import { useReducedMotion, useWaterRipple } from '@/ohq-ui/water/hooks'
import { pressPoint, rippleAt } from '@/ohq-ui/water/ripple'

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>

interface WaterTextLinkProps extends ButtonProps {
  /** 진한 글자(기존 .text-link--accent) — 물 디자인은 강조색이 없어 진한 잉크 + 밑줄 */
  accent?: boolean
  children: ReactNode
}

/** 글자 링크(기존 .text-link) — 단추로 그린다. 누르는 자리가 글자보다 조금 넓다. */
export function WaterTextLink({
  accent,
  className,
  children,
  ...rest
}: WaterTextLinkProps) {
  return (
    <button
      type="button"
      className={cx(
        'water-text-link',
        accent && 'water-text-link--accent',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

interface WaterAddButtonProps extends ButtonProps {
  /** 앞 아이콘 — 기본 + */
  icon?: LucideIcon
  children: ReactNode
}

/**
 * 줄 더하기 · 파일 올리기(기존 .subitems__add) — D7 홈(유리 안에 파인 길) 모양의 알약. 누르면 누른 자리에서
 * 물결이 홈 안으로 퍼진다(동작 줄이기면 없음).
 */
export function WaterAddButton({
  icon: Icon = Plus,
  className,
  children,
  onClick,
  ...rest
}: WaterAddButtonProps) {
  const { ref: fxRef, engine: ripple } = useWaterRipple()
  const reduced = useReducedMotion()

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    const layer = fxRef.current
    if (layer && !reduced)
      ripple.current?.play(
        rippleAt(layer, e.currentTarget, { point: pressPoint(e) }),
      )
    onClick?.(e)
  }

  return (
    <button
      type="button"
      className={cx('water-add', className)}
      onClick={handleClick}
      {...rest}
    >
      <svg
        ref={fxRef}
        className="water-add__fx"
        aria-hidden
        focusable="false"
      />
      <Icon size={14} aria-hidden />
      {children}
    </button>
  )
}

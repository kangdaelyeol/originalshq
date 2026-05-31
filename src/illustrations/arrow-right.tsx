import type { SvgProps } from './types'

export const ArrowRight = ({
  size,
  color = 'black',
  className = '',
}: SvgProps) => {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className}>
      <path
        d="M16.1066 12.4285C15.7811 12.7539 15.7811 13.2816 16.1066 13.607L22.4996 20.0001L16.1066 26.3932C15.7811 26.7186 15.7811 27.2462 16.1066 27.5717L16.6958 28.1609C17.0213 28.4864 17.5489 28.4864 17.8743 28.1609L25.4459 20.5893C25.7713 20.2639 25.7713 19.7363 25.4459 19.4108L17.8743 11.8393C17.5489 11.5138 17.0213 11.5138 16.6958 11.8393L16.1066 12.4285Z"
        fill={color}
      />
    </svg>
  )
}

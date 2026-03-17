interface Props {
  size: number
}
export const Arrow = ({ size = 16 }: Props) => {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
    </svg>
  )
}

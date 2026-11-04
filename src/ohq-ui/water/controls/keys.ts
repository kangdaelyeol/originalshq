/**
 * 한 줄 고르기(라디오 묶음)에서 누른 키로 옮겨 갈 칸 — ←↑ 앞, →↓ 뒤(끝에서 처음으로 돈다), Home·End 처음·끝.
 * 해당 없는 키면 null.
 */
export function rovingIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null
  const cur = current < 0 ? 0 : current
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (cur + 1) % count
    case 'ArrowLeft':
    case 'ArrowUp':
      return (cur - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

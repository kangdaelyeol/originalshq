import './auto-height.scss'
import { useLayoutEffect, useRef, type ReactNode } from 'react'

const DURATION = 550

/**
 * 내용 높이를 따라 부드럽게 늘었다 줄었다 하는 상자 — 불러오는 중(로딩 판)에서
 * 다 받은 내용(긴 표)으로 바뀔 때 툭 튀지 않고 자라게 한다.
 *
 * 평소에는 아무 일도 하지 않는다(높이 auto, 넘침 허용 — 안의 드롭다운·말풍선이
 * 안 잘리고, 위에 붙는 표 머리글도 그대로). 안의 높이가 바뀌면 그 순간에만:
 * 바뀌기 전 높이로 묶었다가 새 높이로 옮겨 가고(transition), 다 옮겨 가면 다시
 * 풀어 둔다. 높이 변화는 그리기 전에(ResizeObserver) 잡아서 깜빡이지 않는다.
 *
 * 새로 나타나는 내용에 glass_reveal 클래스를 붙이면 높이가 자라는 동안 흐릿하게
 * 있다가 선명해진다(auto-height.scss).
 */
export const AutoHeight = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    let last = inner.offsetHeight
    let timer = 0

    const release = () => {
      window.clearTimeout(timer)
      outer.classList.remove('is-animating')
      outer.style.height = ''
    }
    const observer = new ResizeObserver(() => {
      const next = inner.offsetHeight
      const from = outer.classList.contains('is-animating')
        ? outer.getBoundingClientRect().height
        : last
      last = next
      if (reduced || Math.abs(next - from) < 1) return
      // 바뀌기 전 높이로 묶고 → 다음 프레임에 새 높이로(transition).
      outer.classList.add('is-animating')
      outer.style.height = `${from}px`
      void outer.offsetHeight
      outer.style.height = `${next}px`
      window.clearTimeout(timer)
      timer = window.setTimeout(release, DURATION + 50)
    })
    observer.observe(inner)
    return () => {
      observer.disconnect()
      release()
    }
  }, [])

  return (
    <div
      ref={outerRef}
      className={['glass_auto_height', className ?? ''].join(' ').trim()}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  )
}

import { useEffect, useRef } from 'react'

/*
 * Scroll progress through a tall section.
 *
 * Writes `--progress` on the element: 0 when its top reaches the top of the
 * viewport, 1 when its bottom reaches the bottom — i.e. the stretch during
 * which a `position: sticky` child the height of the viewport stays pinned.
 * CSS does the rest, so what moves and how is decided in the stylesheet, not
 * here.
 *
 * It is a style write rather than React state on purpose: this runs on every
 * scroll frame, and re-rendering the section each time would be the expensive
 * way to change one number. The listener is only attached while the section
 * is near the viewport.
 */
export const useScrollProgressViewModel = <T extends HTMLElement>() => {
  const target = useRef<T>(null)

  useEffect(() => {
    const element = target.current
    if (!element) return

    let frame = 0
    const write = () => {
      frame = 0
      const rect = element.getBoundingClientRect()
      const distance = rect.height - innerHeight
      const progress =
        distance > 0 ? Math.max(0, Math.min(1, -rect.top / distance)) : 0
      element.style.setProperty('--progress', progress.toFixed(4))
    }
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(write)
    }

    let listening = false
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting === listening) return
        listening = entry.isIntersecting
        if (listening) {
          addEventListener('scroll', queue, { passive: true })
          addEventListener('resize', queue)
          queue()
        } else {
          removeEventListener('scroll', queue)
          removeEventListener('resize', queue)
        }
      },
      { rootMargin: '100px' },
    )
    observer.observe(element)

    return () => {
      observer.disconnect()
      removeEventListener('scroll', queue)
      removeEventListener('resize', queue)
      cancelAnimationFrame(frame)
      element.style.removeProperty('--progress')
    }
  }, [])

  return { targetRef: target }
}

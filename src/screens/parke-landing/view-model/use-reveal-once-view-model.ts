import { useEffect, useRef, useState } from 'react'

/*
 * One-shot scroll reveal.
 *
 * Reports the first time its element is on screen and then stops watching, so
 * an entrance animation tied to it plays once per visit and never again when
 * the reader scrolls back. `threshold` is how much of the element has to be
 * visible before it counts.
 */
export const useRevealOnceViewModel = <T extends HTMLElement>(
  threshold = 0.35,
) => {
  const target = useRef<T>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const element = target.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setRevealed(true)
        observer.disconnect()
      },
      { threshold },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold])

  return { targetRef: target, state: { revealed } }
}

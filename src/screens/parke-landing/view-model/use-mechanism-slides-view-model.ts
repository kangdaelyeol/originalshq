import { useEffect, useRef, useState } from 'react'
import type { CarouselApi } from '../components/ui/carousel'

/** How long each step stays up before the carousel moves on by itself. */
const AUTOPLAY_MS = 6500

/*
 * "How it connects" carousel controller.
 *
 * Tracks the selected slide and advances it on a timer, but only while the
 * carousel is on screen and motion is allowed. `selected` is a dependency of
 * the timer on purpose: any change of slide, including a manual one, restarts
 * the countdown so a slide the reader just chose is not pulled away early.
 */
export const useMechanismSlidesViewModel = (still: boolean) => {
  const [api, setApi] = useState<CarouselApi>()
  const [selected, setSelected] = useState(0)
  const [visible, setVisible] = useState(false)
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!host.current) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.35 },
    )
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!api) return
    const sync = () => setSelected(api.selectedScrollSnap())
    sync()
    api.on('select', sync)
    return () => {
      api.off('select', sync)
    }
  }, [api])

  useEffect(() => {
    if (!api || still || !visible) return
    const timer = setInterval(() => api.scrollNext(), AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [api, still, visible, selected])

  return {
    hostRef: host,
    state: { selected },
    actions: {
      setApi,
      goTo: (index: number) => api?.scrollTo(index),
    },
  }
}

import { useEffect, useState } from 'react'

/*
 * Page-level controller for the landing page.
 *
 * Three things are decided here and nowhere else: whether the page is shown
 * without motion, whether the header has arrived, and whether the reservation
 * dialog is open.
 */
export const usePageViewModel = () => {
  /** The reader's own choice from the header toggle. `null` until they touch
   * it, so the OS preference decides in the meantime. */
  const [reader, setReader] = useState<boolean | null>(null)
  const [reduced, setReduced] = useState(false)
  const [reserveOpen, setReserveOpen] = useState(false)
  const [pastHero, setPastHero] = useState(false)

  useEffect(() => {
    const q = matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(q.matches)
    sync()
    q.addEventListener('change', sync)
    return () => q.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    // The hero runs its own full-bleed intro; page chrome waits until the
    // scroll sequence has been scrolled past. The hero is several viewports
    // tall, so it stops intersecting exactly when it ends.
    const hero = document.getElementById('top')
    if (!hero) return
    const observer = new IntersectionObserver(
      ([entry]) => setPastHero(!entry.isIntersecting),
      { threshold: 0 },
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  const still = reader ?? reduced

  return {
    state: { still, pastHero, reserveOpen },
    actions: {
      toggleMotion: () => setReader(!still),
      openReserve: () => setReserveOpen(true),
      setReserveOpen,
    },
  }
}

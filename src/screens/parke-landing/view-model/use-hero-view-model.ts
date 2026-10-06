import { useEffect, useRef } from 'react'
import {
  createScrollSequence,
  DETAIL_COLUMNS,
  FRAME_COUNT,
  MOTION_COLUMNS,
} from '../utils/scroll-sequence'
import { HERO_COPY, heroCueOpacity, OPENING_FADE_S } from '../config'

const FPS = 24
/* Ambient backdrop.
 *
 * The sharp canvas is capped at 1440px so the 1280px sequence is never
 * upscaled past 1.125x, which leaves bars on anything wider — 560px a side on
 * a 2560 monitor. Filling them with the frame itself would mean a 2x upscale,
 * so this paints the same frame into a thumbnail that CSS stretches across
 * the pin and blurs: at that radius the upscale is what sells it, and the
 * frame people actually look at keeps its resolution.
 *
 * 64x36 rather than something larger because the blur throws away everything
 * finer anyway, and the per-frame cost is a minification of the sheet cell
 * down to 2,304 pixels. */
export const AMBIENT_WIDTH = 64
export const AMBIENT_HEIGHT = 36
const clamp = (x: number) => Math.max(0, Math.min(1, x))
const timeAt = (p: number) => (clamp(p / 0.96) * (FRAME_COUNT - 1)) / FPS
/** Inverse of timeAt: the scroll progress that lands on this frame. */
const progressAt = (frame: number) => (frame / (FRAME_COUNT - 1)) * 0.96

/* Opening titles.
 *
 * The hero fades up from black once the first frame is on the canvas, then
 * plays chapter one by itself — the page scrolls, so the sequence, the copy
 * crossfade and the scrollbar all stay in agreement instead of the canvas
 * animating behind a page that has not moved. The first touch of the wheel,
 * a key or a finger hands control straight back. */
/** Hold before the page starts moving. Shorter than the 900ms fade on
 * purpose: the move begins while the image is still resolving, which reads
 * as one gesture instead of fade-then-wait-then-scroll. */
const REVEAL_MS = 520

/** Last frame with the opening copy still fully opaque — see OPENING_FADE_S. */
const INTRO_END_FRAME = Math.max(1, Math.floor(OPENING_FADE_S * FPS))

/** How long that scroll takes. Not tied to the sequence's own 24fps — played
 * at film rate the opening sits still for too long before anything reads.
 * Set against INTRO_END_FRAME's distance to leave at roughly 670px/s. */
const INTRO_MS = 4100

/** Leaves at speed and settles, rather than easing in from a standstill: an
 * ease-in spends the first second covering ~20px, which looks like a stall. */
const easeOut = (t: number) => 1 - (1 - t) ** 3

/*
 * Hero scroll sequence controller.
 *
 * Owns everything the hero does over time: sizing the canvases, loading and
 * painting sheets, mapping scroll to a frame, the copy crossfade and the
 * opening autoplay. The component keeps the markup and hands its elements over
 * through the returned refs; nothing here decides what the hero looks like.
 *
 * There is one headline block per HERO_COPY entry, so those are collected
 * through a callback-ref factory: `ref={bindCopy(index)}`.
 */
/** Resident motion frames follow scroll immediately; full detail resolves after scrolling rests. */
export const useHeroViewModel = (still: boolean) => {
  const section = useRef<HTMLElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    ambient = useRef<HTMLCanvasElement>(null),
    poster = useRef<HTMLImageElement>(null)
  const copies = useRef<(HTMLDivElement | null)[]>([])
  /** Callback ref for the headline block at `index`. */
  const bindCopy = (index: number) => (element: HTMLDivElement | null) => {
    copies.current[index] = element
  }
  /** The intro plays once per visit, not again when motion is toggled. */
  const introPlayed = useRef(false)

  useEffect(() => {
    const host = section.current,
      surface = canvas.current,
      cover = poster.current
    if (!host || !surface || !cover) return
    const pin = host.firstElementChild as HTMLElement
    surface.style.opacity = '0'
    cover.style.opacity = '1'
    copies.current.forEach((copy, index) => {
      if (!copy) return
      const shown = HERO_COPY[index]?.enter === null
      copy.style.opacity = shown ? '1' : '0'
      copy.style.transform = 'none'
      copy.setAttribute('aria-hidden', String(!shown))
    })
    if (still) {
      pin.dataset.renderer = 'brand-still'
      // Nothing will paint, so reveal the still frame straight away.
      host.classList.add('is-revealed')
      return
    }
    const ctx = surface.getContext('2d', { alpha: false })
    if (!ctx) return
    const mobile = matchMedia('(max-width:700px)').matches
    const width = mobile ? 960 : 1280,
      height = mobile ? 540 : 720
    const motionWidth = mobile ? 384 : 512,
      motionHeight = mobile ? 216 : 288
    surface.width = width
    surface.height = height
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    // The backdrop is drawn every frame regardless of viewport width: it is
    // CSS that decides whether a screen is wide enough to show it, and
    // gating the draw as well would mean re-deciding on every resize for a
    // few thousand pixels of work.
    const glow = ambient.current
    const glowCtx = glow?.getContext('2d', { alpha: false }) ?? null
    if (glow && glowCtx) {
      glow.width = AMBIENT_WIDTH
      glow.height = AMBIENT_HEIGHT
      // Nothing survives the blur, so sampling quality is wasted here.
      glowCtx.imageSmoothingQuality = 'low'
    }
    pin.dataset.renderer = 'motion-preparing'
    const profile = mobile ? 'mobile' : 'desktop'
    let raf = 0,
      idleTimer = 0,
      resizeTimer = 0,
      revealTimer = 0,
      introRaf = 0,
      introFrom = 0,
      introTo = 0,
      introAt = 0,
      disposed = false,
      active = true,
      painted = false
    let start = 0,
      distance = 1,
      viewportWidth = innerWidth
    const opacityCache = HERO_COPY.map(() => -1)

    const paintCopy = (frame: number) => {
      const time = frame / FPS
      const opacity = HERO_COPY.map((cue) => heroCueOpacity(cue, time))
      copies.current.forEach((copy, index) => {
        if (!copy || Math.abs(opacityCache[index] - opacity[index]) < 0.002)
          return
        opacityCache[index] = opacity[index]
        copy.style.opacity = String(opacity[index])
        copy.style.transform = `translateY(${(1 - opacity[index]) * 8}px)`
        const hidden = String(opacity[index] < 0.5)
        if (copy.getAttribute('aria-hidden') !== hidden)
          copy.setAttribute('aria-hidden', hidden)
      })
      host.dataset.frame = String(frame)
      host.dataset.time = time.toFixed(3)
    }
    // ImageBitmap rather than HTMLImageElement: createImageBitmap decodes off
    // the scroll path like img.decode() did, and the result can be closed, so
    // an evicted sheet's buffer is freed at eviction instead of whenever GC
    // happens to run. That is what makes a larger detail cache safe.
    const loadImage = async (url: string, priority: RequestPriority) => {
      // fetch does not reject on 4xx/5xx; the sequence relies on a rejection
      // to mark the sheet failed and back off.
      const response = await fetch(url, { priority })
      if (!response.ok) throw new Error(`${response.status} ${url}`)
      return createImageBitmap(await response.blob())
    }
    const sequence = createScrollSequence<ImageBitmap>({
      loadMotion: (index) =>
        loadImage(
          `/media/parke-scroll-v28/${profile}/${String(index).padStart(2, '0')}.webp`,
          'high',
        ),
      loadDetail: (index) =>
        loadImage(
          `/media/parke-scroll-v25/${profile}/${String(index).padStart(3, '0')}.webp`,
          'low',
        ),
      status: (motion, detail) => {
        host.dataset.motionSheets = String(motion)
        host.dataset.cachedSheets = String(detail)
        host.dataset.motionReady = String(motion === 6)
      },
      release: (image) => image.close(),
      paint: ({ image, cell, frame, detail }) => {
        if (disposed) return
        const columns = detail ? DETAIL_COLUMNS : MOTION_COLUMNS,
          w = detail ? width : motionWidth,
          h = detail ? height : motionHeight
        const sx = (cell % columns) * w,
          sy = Math.floor(cell / columns) * h
        ctx.drawImage(image, sx, sy, w, h, 0, 0, width, height)
        glowCtx?.drawImage(
          image,
          sx,
          sy,
          w,
          h,
          0,
          0,
          AMBIENT_WIDTH,
          AMBIENT_HEIGHT,
        )
        paintCopy(frame)
        if (!painted) {
          surface.style.opacity = '1'
          cover.style.opacity = '0'
          painted = true
          host.classList.add('is-revealed')
          startIntro()
        }
        pin.dataset.renderer = detail
          ? 'detail-canvas'
          : 'resident-motion-canvas'
      },
    })
    const measure = () => {
      host.style.removeProperty('--pf-stable-height')
      // Freeze the small viewport height; browser-toolbar changes must not remap progress.
      const stableHeight = pin.getBoundingClientRect().height
      host.style.setProperty('--pf-stable-height', `${stableHeight}px`)
      const bounds = host.getBoundingClientRect()
      start = bounds.top + scrollY
      distance = Math.max(1, bounds.height - stableHeight)
      host.dataset.scrollDistance = String(Math.round(distance))
    }

    /* Intro playback. Appended after measure() has run, so `start` and
     * `distance` are the same numbers sample() maps scroll onto. */
    const endIntro = () => {
      if (introRaf) cancelAnimationFrame(introRaf)
      introRaf = 0
      clearTimeout(revealTimer)
      removeEventListener('wheel', endIntro)
      removeEventListener('touchstart', endIntro)
      removeEventListener('pointerdown', endIntro)
      removeEventListener('keydown', endIntro)
      host.dataset.intro = 'done'
    }
    const stepIntro = (now: number) => {
      introRaf = 0
      if (disposed) return
      const progress = clamp((now - introAt) / INTRO_MS)
      scrollTo(0, introFrom + (introTo - introFrom) * easeOut(progress))
      if (progress < 1) introRaf = requestAnimationFrame(stepIntro)
      else endIntro()
    }
    const startIntro = () => {
      if (introPlayed.current || disposed) return
      introPlayed.current = true
      // Only from a cold open at the top. A restored scroll position, a hash
      // link or a reader who already started scrolling all keep control.
      if (scrollY > start + 2) return
      introFrom = scrollY
      introTo = start + progressAt(INTRO_END_FRAME) * distance
      if (introTo <= introFrom) return
      host.dataset.intro = 'playing'
      addEventListener('wheel', endIntro, { passive: true })
      addEventListener('touchstart', endIntro, { passive: true })
      addEventListener('pointerdown', endIntro, { passive: true })
      addEventListener('keydown', endIntro)
      revealTimer = window.setTimeout(() => {
        if (disposed) return
        introAt = performance.now()
        introRaf = requestAnimationFrame(stepIntro)
      }, REVEAL_MS)
    }
    const sample = () => {
      raf = 0
      if (disposed || !active || document.hidden) return
      const progress = clamp((scrollY - start) / distance)
      const frame = Math.min(
        FRAME_COUNT - 1,
        Math.round(timeAt(progress) * FPS),
      )
      host.dataset.targetFrame = String(frame)
      sequence.seek(frame)
    }
    const queue = () => {
      if (!raf && active) raf = requestAnimationFrame(sample)
    }
    const settle = () => {
      clearTimeout(idleTimer)
      // The detail window is filled during the scroll itself; this only tops
      // it up once the playhead rests, when the direction bias no longer
      // applies and anything skipped while in flight can be retried.
      idleTimer = window.setTimeout(() => {
        if (active && !disposed) sequence.refine()
      }, 80)
    }
    const scroll = () => {
      queue()
      settle()
    }
    const resize = () => {
      // Mobile browser chrome resizes height during a gesture; ignore those events.
      if (mobile && Math.abs(innerWidth - viewportWidth) < 2) return
      viewportWidth = innerWidth
      clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        measure()
        queue()
        settle()
      }, 120)
    }
    const resume = () => {
      if (!document.hidden) {
        sequence.resume()
        queue()
        settle()
      }
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        active = entry.isIntersecting
        if (active) {
          queue()
          settle()
        } else clearTimeout(idleTimer)
      },
      { rootMargin: '200px' },
    )
    measure()
    observer.observe(host)
    addEventListener('scroll', scroll, { passive: true })
    addEventListener('resize', resize)
    addEventListener('pageshow', resume)
    addEventListener('online', resume)
    document.addEventListener('visibilitychange', resume)
    sample()
    settle()
    return () => {
      disposed = true
      endIntro()
      cancelAnimationFrame(raf)
      clearTimeout(idleTimer)
      clearTimeout(resizeTimer)
      observer.disconnect()
      sequence.dispose()
      removeEventListener('scroll', scroll)
      removeEventListener('resize', resize)
      removeEventListener('pageshow', resume)
      removeEventListener('online', resume)
      document.removeEventListener('visibilitychange', resume)
      host.style.removeProperty('--pf-stable-height')
    }
  }, [still])

  return {
    sectionRef: section,
    canvasRef: canvas,
    ambientRef: ambient,
    posterRef: poster,
    bindCopy,
  }
}

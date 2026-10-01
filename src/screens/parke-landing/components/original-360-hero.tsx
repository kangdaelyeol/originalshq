import { useEffect, useRef } from 'react'
import { ArrowDown } from 'lucide-react'
import {
  createScrollSequence,
  FRAME_COUNT,
  MOTION_COLUMNS,
} from '../utils/scroll-sequence'

const FPS = 24
const clamp = (x: number) => Math.max(0, Math.min(1, x))
const ease = (x: number) => {
  const t = clamp(x)
  return t * t * (3 - 2 * t)
}
const timeAt = (p: number) => (clamp(p / 0.96) * (FRAME_COUNT - 1)) / FPS

/** Resident motion frames follow scroll immediately; full detail resolves after scrolling rests. */
export default function Original360Hero({ still }: { still: boolean }) {
  const section = useRef<HTMLElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    poster = useRef<HTMLImageElement>(null)
  const copies = useRef<(HTMLDivElement | null)[]>([]),
    hint = useRef<HTMLSpanElement>(null),
    chapter = useRef<HTMLSpanElement>(null),
    bar = useRef<HTMLElement>(null)

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
      copy.style.opacity = index === 0 ? '1' : '0'
      copy.style.transform = 'none'
      copy.setAttribute('aria-hidden', String(index !== 0))
    })
    if (bar.current) {
      bar.current.style.width = '100%'
      bar.current.style.transform = 'scaleX(0)'
    }
    if (chapter.current) chapter.current.innerHTML = '01<small>/ 03</small>'
    if (hint.current)
      hint.current.textContent = '아래로 내려 제품과 사용 장면을 살펴보세요.'
    if (still) {
      pin.dataset.renderer = 'brand-still'
      if (hint.current)
        hint.current.textContent =
          '움직임 없이 보는 중 · 상단 재생 버튼으로 켤 수 있어요.'
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
    pin.dataset.renderer = 'motion-preparing'
    const profile = mobile ? 'mobile' : 'desktop'
    let raf = 0,
      idleTimer = 0,
      resizeTimer = 0,
      disposed = false,
      active = true,
      painted = false
    let start = 0,
      distance = 1,
      viewportWidth = innerWidth,
      lastPhase = 1
    const opacityCache = [-1, -1, -1]

    const paintCopy = (frame: number) => {
      const time = frame / FPS
      const opacity = [
        1 - ease((time - 6.35) / 0.6),
        ease((time - 6.95) / 0.6) * (1 - ease((time - 16.1) / 0.6)),
        ease((time - 16.7) / 0.7),
      ]
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
      const phase = time < 7 ? 1 : time < 16.7 ? 2 : 3
      if (chapter.current && phase !== lastPhase) {
        chapter.current.innerHTML = `0${phase}<small>/ 03</small>`
        lastPhase = phase
      }
      const label =
        time > 22.5
          ? '함께 쓰는 차에서, 어떤 불편이 있었을까요?'
          : phase === 3
            ? '대시보드 위, 늘 두던 자리로.'
            : '아래로 내려 제품과 사용 장면을 살펴보세요.'
      if (hint.current && hint.current.textContent !== label)
        hint.current.textContent = label
      host.dataset.frame = String(frame)
      host.dataset.time = time.toFixed(3)
    }
    const loadImage = async (url: string, priority: 'high' | 'low') => {
      const image = new Image()
      image.decoding = 'async'
      image.fetchPriority = priority
      image.src = url
      // onload does not guarantee decoding is finished; finish it off the scroll path.
      await image.decode()
      return image
    }
    const sequence = createScrollSequence<HTMLImageElement>({
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
      paint: ({ image, cell, frame, detail }) => {
        if (disposed) return
        const columns = detail ? 2 : MOTION_COLUMNS,
          w = detail ? width : motionWidth,
          h = detail ? height : motionHeight
        ctx.drawImage(
          image,
          (cell % columns) * w,
          Math.floor(cell / columns) * h,
          w,
          h,
          0,
          0,
          width,
          height,
        )
        paintCopy(frame)
        if (!painted) {
          surface.style.opacity = '1'
          cover.style.opacity = '0'
          painted = true
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
    const sample = () => {
      raf = 0
      if (disposed || !active || document.hidden) return
      const progress = clamp((scrollY - start) / distance)
      const frame = Math.min(
        FRAME_COUNT - 1,
        Math.round(timeAt(progress) * FPS),
      )
      host.dataset.targetFrame = String(frame)
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`
      sequence.seek(frame)
    }
    const queue = () => {
      if (!raf && active) raf = requestAnimationFrame(sample)
    }
    const settle = () => {
      clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => {
        if (active && !disposed) sequence.refine()
      }, 140)
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

  return (
    <>
      {!still && (
        <>
          <link
            rel="preload"
            as="image"
            href="/media/parke-scroll-v28/mobile/00.webp"
            media="(max-width:700px)"
          />
          <link
            rel="preload"
            as="image"
            href="/media/parke-scroll-v28/desktop/00.webp"
            media="(min-width:701px)"
          />
        </>
      )}
      <section
        id="top"
        ref={section}
        className={`pf-original-hero pf-scroll pf-source-film pf-continuous-landing pf-video-hero pf-motion-stable ${still ? 'is-still' : ''}`}
        aria-label="Parké 제품 인트로, 한 바퀴 회전과 대시보드 장면"
      >
        <div
          className="pf-pin"
          data-renderer={still ? 'brand-still' : 'sprite-loading'}
        >
          <div className="pf-render-world" aria-hidden="true">
            <img
              ref={poster}
              className="pf-world-poster"
              fetchPriority="high"
              decoding="async"
              src={
                still
                  ? '/images/brand/product-studio.webp'
                  : '/images/brand/intro-poster.jpg'
              }
              width={1672}
              height={941}
              alt=""
            />
            <canvas
              ref={canvas}
              width={960}
              height={540}
              style={{ opacity: 0 }}
            />
          </div>
          <div className="pf-original-shade" />
          <h1 className="sr-only">
            Parké 파르케 — 앱을 열지 않아도 연락 대상이 바뀌는 자동 주차번호판.
          </h1>
          {[
            [
              'Parké · 파르케',
              '앱을 열지 않아도.',
              '연락 대상은 알아서.',
              '등록된 운전자를 인식해 주차 연락 대상을 자동으로 바꾸는 주차번호판.',
            ],
            [
              '한 대의 차를 함께 쓰는 가족에게',
              'QR은 그대로.',
              '운전자는 바뀌어도.',
              '번호판을 바꿔 끼우지 않아도, 지금 차를 사용하는 사람에게.',
            ],
            [
              '우리 차의 주차 연락',
              '차를 가져간 사람에게.',
              '연락이 닿도록.',
              '차에서 내려도 마지막으로 인식된 연락 대상은 유지됩니다.',
            ],
          ].map(([label, line1, line2, description], index) => (
            <div
              ref={(element) => {
                copies.current[index] = element
              }}
              className="pf-original-copy"
              key={label}
              aria-hidden={index !== 0}
              style={{ opacity: index === 0 ? 1 : 0 }}
            >
              <p className="pf-eyebrow">{label}</p>
              <h2>
                {line1}
                <br />
                {line2}
              </h2>
              <p className="pf-hero-explain">{description}</p>
            </div>
          ))}
          <div className="pf-original-bottom">
            <span>
              <ArrowDown size={18} />
              <span ref={hint}>아래로 내려 제품과 사용 장면을 살펴보세요.</span>
            </span>
            <span ref={chapter} className="pf-film-chapter">
              01<small>/ 03</small>
            </span>
          </div>
          <div className="pf-progress">
            <i ref={bar} />
          </div>
        </div>
      </section>
    </>
  )
}

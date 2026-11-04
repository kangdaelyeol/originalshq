import {
  WATER_REVEAL,
  WATER_SPRING,
  clamp01,
  round3,
  since,
  smooth,
  spring,
  springArrival,
  waterClock,
} from '@/ohq-ui/water/motion'
import { revealStagger } from '@/ohq-ui/water/reveal'
import { WaterRipple } from '@/ohq-ui/water/ripple'
import { SpringTrack } from './board-motion'

// 유리 알약 토스트의 움직임 — D7 메뉴처럼 동그란 유리(오른쪽 끝)에서 알약이 extend 스프링(ζ0.5·ω34,
// 15% 넘침)으로 왼쪽으로 뻗어 나오고, 알약이 처음 다 뻗는 0.071s(extend 상승 시간)부터 내용이 21ms 간격으로
// 55ms씩 나타난다(WATER_REVEAL). 사라질 때는 D7 접힘처럼 내용이 곧바로(0.015 → 0.045s) 걷히고, 0.188s(접힘
// 1단계)부터 먼 끝이 extend 스프링으로 동그라미 쪽으로 빨려 들며, 유리는 그 뒤 0.17 → 0.30s에 걷힌다(pillOn).
// 위아래 자리가 바뀌면 move 스프링(ζ0.72·ω26)으로 옮겨 간다(FLIP).

export const TOAST_REVEAL_AT = springArrival(WATER_SPRING.extend)
/** 접힘 1단계(D7 CLOSE_GATHER — F22.5 클릭 → F28.3 이동 시작) */
const EXIT_HOLD = 0.188
/** 사라짐이 끝나는 시각 — 2단계 0.30s에 유리가 다 걷힌다 */
const EXIT_END = EXIT_HOLD + 0.3

export interface ToastDom {
  li: HTMLElement
  glass: HTMLElement
  /** 차례로 나타날 내용(아이콘 · 글 · 닫기) */
  content: HTMLElement[]
  /** 물결 층 */
  fx: SVGSVGElement
  /** 물결 가운데(아이콘) */
  icon: HTMLElement | null
}

export class WaterToastEngine {
  private dom: ToastDom
  private reduced: boolean
  private mode: 'in' | 'out' | 'rest' = 'rest'
  private start = -Infinity
  private width = 0
  private height = 0
  private raf = 0
  private onGone: (() => void) | null = null
  private shift = new SpringTrack(0, WATER_SPRING.move)
  private reveals: Animation[] = []
  private ripple: WaterRipple
  /** 성공으로 나타난 토스트 — 알약이 다 뻗은 뒤(아이콘이 나올 때) 물결을 띄운다 */
  private splashDue = false

  constructor(dom: ToastDom, reduced: boolean) {
    this.dom = dom
    this.reduced = reduced
    this.ripple = new WaterRipple(dom.fx)
  }

  /** 나타나기 — 레이아웃 효과에서 부른다(크기를 한 번 잰다) */
  enter(at?: number) {
    const now = since(at)
    this.measure()
    this.mode = 'in'
    this.start = now
    if (!this.reduced)
      this.reveals = revealStagger(this.dom.content, {
        at: now,
        from: TOAST_REVEAL_AT,
      })
    this.frame(waterClock())
    this.kick()
  }

  /** 사라지기 — 다 걷히면 onGone */
  exit(at: number | undefined, onGone: () => void) {
    const now = since(at)
    this.measure()
    this.mode = 'out'
    this.start = now
    this.onGone = onGone
    for (const anim of this.reveals) anim.finish()
    this.reveals = []
    this.kick()
  }

  /** 자리가 dy만큼 바뀌었다(FLIP) — 옛 자리에서 move 스프링으로 새 자리로 */
  moveFrom(dy: number, at?: number) {
    if (this.reduced || Math.abs(dy) < 0.5) return
    const now = since(at)
    const cur = this.shift.at(now).x
    this.shift.jump(cur + dy)
    this.shift.to(0, now, WATER_SPRING.move)
    this.drawShift(now)
    this.kick()
  }

  /** 성공 물결 — 아이콘 가운데에서 알약 안으로. 아직 뻗는 중이면 아이콘이 나올 때(0.071s)까지 기다린다 */
  splash(at?: number) {
    if (this.reduced || !this.dom.icon) return
    if (this.mode === 'in' && waterClock() - this.start < TOAST_REVEAL_AT) {
      this.splashDue = true
      this.kick()
      return
    }
    this.playSplash(at)
  }

  private playSplash(at?: number) {
    if (!this.dom.icon) return
    const li = this.dom.li.getBoundingClientRect()
    const icon = this.dom.icon.getBoundingClientRect()
    const fx = this.dom.fx.getBoundingClientRect()
    const h = li.height
    this.ripple.play({
      x: icon.left + icon.width / 2 - fx.left,
      y: icon.top + icon.height / 2 - fx.top,
      scale: h / 50.5,
      clip: {
        x: li.left - fx.left,
        y: li.top - fx.top,
        width: li.width,
        height: h,
        radius: Math.min(h / 2, 22),
      },
      at,
    })
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    for (const anim of this.reveals) anim.cancel()
    this.ripple.destroy()
  }

  private measure() {
    this.width = this.dom.li.offsetWidth
    this.height = this.dom.li.offsetHeight
  }

  private kick() {
    if (this.raf) return
    const tick = () => {
      this.raf = 0
      if (this.frame(waterClock())) this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  private drawShift(now: number) {
    const y = this.shift.at(now).x
    this.dom.li.style.transform =
      Math.abs(y) < 0.01 ? '' : `translate3d(0, ${round3(y)}px, 0)`
  }

  private frame(now: number): boolean {
    const t = now - this.start
    const g = this.dom.glass.style
    const h = this.height
    const span = Math.max(0, this.width - h)
    let busy = false
    if (this.mode === 'in') {
      if (this.reduced) {
        const k = clamp01(t / 0.1)
        this.dom.li.style.opacity = String(round3(k))
        busy = k < 1
      } else {
        // 동그라미(오른쪽 끝)에서 왼쪽으로 뻗는다 — D7 ext
        const w = h + span * spring(t, WATER_SPRING.extend)
        g.width = `${round3(w)}px`
        busy = t < 0.5
        if (this.splashDue && t >= TOAST_REVEAL_AT) {
          this.splashDue = false
          this.playSplash(this.start + TOAST_REVEAL_AT)
        }
      }
      if (!busy) {
        this.mode = 'rest'
        g.width = ''
        this.dom.li.style.opacity = ''
      }
    } else if (this.mode === 'out') {
      if (this.reduced) {
        const k = clamp01(t / 0.1)
        this.dom.li.style.opacity = String(round3(1 - k))
        busy = k < 1
      } else {
        // 내용은 곧바로, 먼 끝은 1단계 뒤 동그라미 쪽으로 빨려 들고(넘쳐도 동그라미보다 작아지지 않게),
        // 유리는 2단계 0.17 → 0.30s에 걷힌다
        const fade = clamp01((t - 0.015) / WATER_REVEAL.out)
        for (const node of this.dom.content)
          node.style.opacity = String(round3(1 - fade))
        const tb = t - EXIT_HOLD
        const w = Math.max(
          h,
          this.width - span * spring(tb, WATER_SPRING.extend),
        )
        g.width = `${round3(w)}px`
        this.dom.li.style.opacity = String(
          round3(1 - smooth((tb - 0.17) / 0.13)),
        )
        busy = t < EXIT_END
      }
      if (!busy) {
        const cb = this.onGone
        this.onGone = null
        cb?.()
        return false
      }
    }
    if (!this.shift.settled(now)) {
      this.drawShift(now)
      busy = true
    } else if (this.dom.li.style.transform) {
      this.dom.li.style.transform = ''
    }
    return busy
  }
}

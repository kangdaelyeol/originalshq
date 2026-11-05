import {
  WATER_SPRING,
  clamp01,
  round3,
  since,
  smooth,
  springArrival,
  waterClock,
} from '@/ohq-ui/water/motion'
import { revealStagger } from '@/ohq-ui/water/reveal'
import { SpringTrack } from './board-motion'

// 오른쪽 유리 서랍의 들어옴·나감 — D7 버튼이 자리를 옮기는 move 스프링(ζ0.72·ω26 — F75 11.6% → F78 97.6%
// → F80 103%, 3.8% 넘침)으로 들어오고, 접힐 때 끌려오는 꼬리 trail(ζ1·ω24 임계 감쇠 — 넘치지 않는다)로
// 나간다. 나가는 끝에 유리가 0.17 → 0.30s에 걷힌다(D7 pillOn). 깔리는 막은 서랍이 들어온 만큼 짙어진다.
// 내용은 서랍이 처음 제자리에 닿는 0.132s(move 상승 시간)부터 21ms 간격으로 55ms씩 나타난다(WATER_REVEAL).

/** 서랍 밖 여유 — 그림자(21·44px 오프셋, 36px 흐림 + 20px 퍼짐)까지 화면 밖으로 */
const OFFSCREEN_PAD = 96
/** 가운데 모달이 떠오르는 거리 — 화면 밖에서 오지 않고 제자리 아래에서 떠오르며 흐릿함이 걷힌다 */
const RISE = 28

/** 내용이 나오기 시작하는 시각 — 서랍이 처음 제자리에 닿을 때 */
export const DRAWER_REVEAL_AT = springArrival(WATER_SPRING.move)

export class WaterDrawerEngine {
  private panel: HTMLElement
  private scrim: HTMLElement | null
  private x: SpringTrack
  private off = 0
  private mode: 'in' | 'out' = 'in'
  private start = -Infinity
  private raf = 0
  private onGone: (() => void) | null = null
  private reduced: boolean
  private reveals: Animation[] = []
  /** 가운데 모달 — 옆이 아니라 아래에서 떠오른다(같은 스프링) */
  private rise: boolean

  constructor(panel: HTMLElement, scrim: HTMLElement | null, reduced: boolean, rise = false) {
    this.panel = panel
    this.scrim = scrim
    this.reduced = reduced
    this.rise = rise
    this.x = new SpringTrack(0, WATER_SPRING.move)
  }

  /**
   * 들어오기 — 레이아웃 효과에서 부른다(서랍 폭을 한 번 잰다). reveal은 차례로 나타날 내용.
   * 나가는 도중이면 그 자리·빠르기에서 되돌아온다.
   */
  enter(at?: number, reveal: readonly Element[] = []) {
    const now = since(at)
    const first = this.off === 0
    this.off = this.rise ? RISE : this.panel.offsetWidth + OFFSCREEN_PAD
    if (first) this.x.jump(this.off)
    this.mode = 'in'
    this.start = now
    this.onGone = null
    this.panel.style.opacity = ''
    if (this.reduced) {
      this.x.jump(0)
    } else {
      this.x.to(0, now, WATER_SPRING.move)
      if (first)
        this.reveals = revealStagger(reveal, {
          at: now,
          from: DRAWER_REVEAL_AT,
        })
    }
    // 첫 모양을 칠하기 전에 바로 놓는다(한 프레임 제자리에 번쩍이지 않게)
    this.frame(waterClock())
    this.kick()
  }

  /** 서랍이 열린 채 내용만 바뀜(다른 기록) — 내용만 다시 차례로 */
  refresh(at: number | undefined, reveal: readonly Element[]) {
    if (this.reduced || this.mode !== 'in') return
    for (const anim of this.reveals) anim.cancel()
    this.reveals = revealStagger(reveal, { at: since(at), from: 0 })
  }

  /** 나가기 — 다 나가면 onGone(그때 내린다) */
  exit(at: number | undefined, onGone: () => void) {
    const now = since(at)
    this.mode = 'out'
    this.start = now
    this.onGone = onGone
    for (const anim of this.reveals) anim.finish()
    this.reveals = []
    if (this.reduced) this.x.jump(0)
    else this.x.to(this.off, now, WATER_SPRING.trail)
    this.kick()
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    for (const anim of this.reveals) anim.cancel()
    this.reveals = []
  }

  private kick() {
    if (this.raf) return
    // 움직이는 동안만 따로 층 — 매 프레임 판 전체를 다시 칠하지 않게(멈추면 지운다)
    this.panel.style.willChange = this.reduced
      ? 'opacity'
      : 'transform, opacity'
    const tick = () => {
      this.raf = 0
      if (this.frame(waterClock())) this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  /** 한 프레임 — 아직 움직이면 true */
  private frame(now: number): boolean {
    const t = now - this.start
    const st = this.panel.style
    if (this.reduced) {
      // 동작 줄이기 — 자리는 그대로, 0.12초 동안 흐리게만
      const k = clamp01(t / 0.12)
      const o = this.mode === 'in' ? k : 1 - k
      st.opacity = String(round3(o))
      if (this.scrim) this.scrim.style.opacity = String(round3(o))
      if (k < 1) return true
      if (this.mode === 'out') this.gone()
      else st.opacity = ''
      st.willChange = ''
      return false
    }
    const { x } = this.x.at(now)
    const shown = round3(clamp01(1 - x / this.off))
    st.transform = this.rise ? `translate3d(0, ${round3(x)}px, 0)` : `translate3d(${round3(x)}px, 0, 0)`
    if (this.scrim) this.scrim.style.opacity = String(shown)
    // 가운데 모달은 제자리 근처에서 움직이니 들어오는 동안 함께 또렷해진다
    if (this.rise && this.mode === 'in') st.opacity = String(shown)
    if (this.mode === 'out') {
      const on = 1 - smooth((t - 0.17) / 0.13)
      st.opacity = String(round3(on))
      if (on > 0) return true
      this.gone()
      return false
    }
    if (!this.x.settled(now)) return true
    // 제자리 — transform·층을 지워 큰 판이 따로 층을 차지하지 않게
    st.transform = ''
    st.opacity = ''
    st.willChange = ''
    return false
  }

  private gone() {
    const cb = this.onGone
    this.onGone = null
    cb?.()
  }
}

// D15 움직임 값 — 영상(30fps)에서 프레임마다 잰 것. 주석의 F는 영상 프레임(F0 = 0초).
// 맞춤은 진행도(0~1) 표본에 여러 이징을 대 보고 RMS가 가장 작은 것을 골랐다(괄호 안이 RMS).

// ── 이징(CSS) ───────────────────────────────────────────────────────────────
export const EASE_OUT_CUBIC = 'cubic-bezier(0.33, 1, 0.68, 1)'
export const EASE_OUT_QUART = 'cubic-bezier(0.25, 1, 0.5, 1)'
export const EASE_OUT_QUINT = 'cubic-bezier(0.22, 1, 0.36, 1)'
export const EASE_IN_OUT_CUBIC = 'cubic-bezier(0.65, 0, 0.35, 1)'
export const EASE_IN_CUBIC = 'cubic-bezier(0.32, 0, 0.67, 0)'
export const EASE_STANDARD = 'cubic-bezier(0.4, 0, 0.2, 1)'

// ── 이징(JS) ────────────────────────────────────────────────────────────────
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const easeOutQuint = (u: number) => 1 - (1 - clamp01(u)) ** 5
export const easeOutQuart = (u: number) => 1 - (1 - clamp01(u)) ** 4
export const easeOutCubic = (u: number) => 1 - (1 - clamp01(u)) ** 3
export const easeInOutCubic = (u: number) => {
  const t = clamp01(u)
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

// ── 쪽 바뀜(F855 Dashboard 누름 → F861 첫 카드) ──────────────────────────────
/** 옛 쪽 사라짐 — F855.5~F859, 불투명도 1→0·위로 0.4em(ease-in) */
export const PAGE_EXIT_MS = 120
/** 누른 뒤 새 쪽을 붙이는 때 — 머리 글이 F860.5에 보이기 시작(누름 + 0.18초) */
export const PAGE_SWAP_MS = 180
/** 카드 떠오름 — 불투명도·아래 1.4em·0.98배 → 제자리(easeOutCubic 15.5F, RMS 0.009). 카드 테두리 F862~F873 */
export const CARD_RISE_MS = 520
/** 카드 차례 간격 — 10장이 1.55F씩(Total 0 · Ended 1.7 · Running 3.1 · Pending 5 · … · Progress 14F) */
export const CARD_STAGGER_MS = 52
/** 붙인 뒤 첫 카드까지 — F860.5 머리 → F861.25 Total */
export const CARD_DELAY_MS = 25
/** 숫자 오르기 — 넷 다 같이 F868.5부터(easeOutQuint 36.25F, 69개 중 5개만 반올림 한 칸 차이) */
export const COUNT_DELAY_MS = 270
export const COUNT_MS = 1200
/** 막대 자라기 — 첫 막대 F869.9, 1.55F 간격, easeOutQuint 22.5F(RMS 0.009~0.016) */
export const BAR_DELAY_MS = 315
export const BAR_STAGGER_MS = 52
export const BAR_MS = 750
/** 반원 진행 — 호 셋이 0.1초 간격(완료 F871 · 진행 F874.2 · 대기), 각각 easeInOutCubic 22F(RMS 0.017) */
export const GAUGE_DELAY_MS = 350
export const GAUGE_STAGGER_MS = 100
export const GAUGE_MS = 730

// ── 표시 막대(사이드바·탭 알약) — F855~F865 사이드바, F363~F373 팀 탭 ─────────────
/** 앞 끝 easeInOutCubic 9.5F(RMS 0.019), 뒤 끝 10F·0.5F 늦게 — 움직이는 동안 14px → 40px로 늘어난다(F860) */
export const INDICATOR_LEAD_MS = 317
export const INDICATOR_TRAIL_MS = 333
export const INDICATOR_TRAIL_DELAY_MS = 17

// ── 자리 옮김(팀 거르기 F363.25~F374, x만) ───────────────────────────────────
/** easeInOutCubic 10.5F(RMS 0.014) — 걸러진 카드는 바로 빠지고, 남은 카드가 가로로만 미끄러진다 */
export const LAYOUT_MS = 350

// ── 숫자 굴림(시간 기록 F166~F176) — 두 숫자가 한 띠로 위로, easeOutQuart 12.5F(RMS 0.010) ──
export const DIGIT_ROLL_MS = 420

// ── 새 프로젝트 창(F42~F50) ─────────────────────────────────────────────────
/** 막(어둡게·흐리게)은 한 프레임에 켜지고 꺼진다(F42·F87). 판은 0.16초에 떠오르며(아래 0.4em) 보인다 */
export const MODAL_IN_MS = 160
/** 판 안 줄 차례 — 제목 F42.5 … 단추 F45.5(약 1F씩) */
export const MODAL_STAGGER_MS = 33
/** 이름 치기 — 15자를 F52~F68에(한 자 33ms) */
export const TYPE_MS = 33

// ── 목록에 한 줄 더하기(F86.5~F94): 오른쪽 0.6em에서 미끄러져 들어온다(ease-out 8F) ──
export const ROW_IN_MS = 270

// ── 알림(토스트) — 들어옴 F86.5~F89.5(흐림 → 또렷), 나감 F843~F849 ──────────────
export const TOAST_IN_MS = 110
export const TOAST_OUT_MS = 200
export const TOAST_HOLD_MS = 2400

// ── 서랍(F397~F406 열림 ease-out, F438.5~F445 닫힘 ease-in) ─────────────────────
export const DRAWER_IN_MS = 280
export const DRAWER_OUT_MS = 230

// ── 칸반 ────────────────────────────────────────────────────────────────────
/** 들어 올림 — 1.03배·2° 기울기·그림자(F257 한 번에), 놓기 — 칸으로 0.2초(F287~F292) */
export const LIFT_MS = 150
export const DROP_MS = 200
/** 기둥 강조가 꺼지는 시간(F288~F290) */
export const COLUMN_HL_MS = 100

// ── 달력 달 바꿈(F526.5 누름 → F529.5~F536 칸이 한꺼번에 나타남) ─────────────────
export const MONTH_DELAY_MS = 100
export const MONTH_FADE_MS = 200

// ── 강조색 바꿈(F776~F782, CSS ease 0.2초) ──────────────────────────────────
export const ACCENT_MS = 200

// ── 둘러보기 카메라(영상 편집 확대 — 앱 UI가 아니다) ─────────────────────────────
/** 들어감 cubic-bezier(.4,0,.2,1) 22F(RMS 0.018), 나옴 easeInOutCubic 19F(RMS 0.010) */
export const CAMERA_IN_MS = 730
export const CAMERA_OUT_MS = 640

/** 자막 — 들어옴 F76.5~F82 아래 0.8em에서(ease-out), 나감 F111~F113 위로 0.2em */
export const CAPTION_IN_MS = 190
export const CAPTION_OUT_MS = 110

// ── 도구 ────────────────────────────────────────────────────────────────────
const REDUCE = '(prefers-reduced-motion: reduce)'
export const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia(REDUCE).matches

/** rAF 한 번짜리 사이 값 — onFrame(진행도 0~1). 멈춤 함수를 돌려준다 */
export function tween(duration: number, onFrame: (u: number) => void, delay = 0, onDone?: () => void) {
  let raf = 0
  let start = -1
  const step = (now: number) => {
    if (start < 0) start = now + delay
    const u = duration <= 0 ? 1 : (now - start) / duration
    if (u >= 0) onFrame(Math.min(1, u))
    if (u < 1) raf = requestAnimationFrame(step)
    else onDone?.()
  }
  raf = requestAnimationFrame(step)
  return () => cancelAnimationFrame(raf)
}

export interface Span {
  start: number
  size: number
}

/**
 * 늘어나는 표시 막대 — 앞 끝이 먼저(easeInOutCubic 0.317초), 뒤 끝이 조금 늦게(0.333초·0.017초 뒤) 따라온다.
 * 축 하나(y면 top·height, x면 left·width)를 1/60초 간격 키프레임으로 미리 적분해 WAAPI로 한 번에 돌린다.
 */
export function stretchMove(el: HTMLElement, axis: 'x' | 'y', from: Span, to: Span, unit = 'px') {
  const [posProp, sizeProp] = axis === 'y' ? (['top', 'height'] as const) : (['left', 'width'] as const)
  const end = { [posProp]: `${to.start}${unit}`, [sizeProp]: `${to.size}${unit}` }
  if (prefersReducedMotion() || (from.start === to.start && from.size === to.size)) {
    Object.assign(el.style, end)
    return
  }
  const forward = to.start > from.start
  const total = INDICATOR_TRAIL_DELAY_MS + INDICATOR_TRAIL_MS
  const steps = Math.ceil(total / (1000 / 60))
  const frames: Keyframe[] = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * total
    const lead = easeInOutCubic(t / INDICATOR_LEAD_MS)
    const trail = easeInOutCubic((t - INDICATOR_TRAIL_DELAY_MS) / INDICATOR_TRAIL_MS)
    // 앞 끝 = 움직이는 쪽 끝(아래로 가면 아래 끝)
    const a0 = from.start + (to.start - from.start) * (forward ? trail : lead)
    const a1 = from.start + from.size + (to.start + to.size - from.start - from.size) * (forward ? lead : trail)
    frames.push({ [posProp]: `${a0}${unit}`, [sizeProp]: `${Math.max(0, a1 - a0)}${unit}`, offset: i / steps })
  }
  el.getAnimations().forEach((a) => a.cancel())
  Object.assign(el.style, end)
  el.animate(frames, { duration: total, easing: 'linear' })
}

import { ChevronDown } from 'lucide-react'
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { cx } from '@/ohq-ui/lib/cx'
import { useAppearance } from '@/ohq-ui/appearance/appearance'
import { usePortalRoot } from '@/ohq-ui/lib/portal-root'
import { waterPaneColors } from '@/ohq-ui/theme/water'
import { useReducedMotion } from '@/ohq-ui/water/hooks'
import { WaterCheck } from '@/ohq-ui/water/controls'
import { WaterGlassFilter, WaterGooShapeFilter } from '@/ohq-ui/water/glass'
import { WaterIndicatorEngine } from '@/ohq-ui/water/indicator'
import { WATER_REVEAL, waterClock } from '@/ohq-ui/water/motion'
import { POP_TIMING, WaterPopEngine } from './pop-engine'

interface WaterMultiSelectProps {
  id: string
  options: string[]
  selected: string[]
  onChange: (value: string[]) => void
  /** 아무것도 안 골랐을 때 글자(물 판만) */
  placeholder?: string
}

/**
 * 단추와 유리 사이 틈 — 물 모양이 σ 4.6px(아래 GOO_K)라 틈이 6.5px보다 좁으면 목이 끊기지 않는다. 2.2σ로 둔다.
 * (내용 자리 CSS .water-multi-pop__content의 top·bottom 10px과 같게)
 */
const GAP = 10
/** 유리가 단추 속에 들어가 있는 깊이(둥근 모서리 14px보다 깊게) · 가장 큰 높이 · 화면 끝 여백 */
const OVERLAP = 16
const MAX_H = 280
const EDGE = 12
/**
 * 물 모양 크기 배율 — 칸(기본 부품 WaterTextField 40px)이 쓰는 유리와 같게(w-glass 0.46·0.2 = D7 알약 높이
 * 87px의 40/87). σ = 10k = 4.6px. 팝오버 유리도 같은 물이라 같은 k·lift(CSS .water-multi-pop__glass)
 */
const GOO_K = 0.46
const GOO_LIFT = 0.2
/** 물 모양 SVG 여백 — 흐림(2σ)·그림자(lift 0.2: 오른쪽 아래 4px + 흐림)까지 */
const GOO_M = 20
/** 팝오버 유리 둥글기(CSS와 같게) */
const POP_R = 14
/**
 * 칸 자리를 장치 화소에 맞춘다 — 크롬은 CSS 상자(칸 유리)를 장치 화소에 붙여 그리고 SVG(물 모양)는 소수 자리
 * 그대로 그려서, 칸이 소수 자리(예: 430.34px)에 있으면 바꿔 끼울 때 테두리가 한 줄 어긋난다
 */
const snapRect = (r: DOMRect) => {
  const d = window.devicePixelRatio || 1
  const snap = (v: number) => Math.round(v * d) / d
  const left = snap(r.left)
  const top = snap(r.top)
  const right = snap(r.right)
  const bottom = snap(r.bottom)
  return { left, top, right, bottom, width: right - left, height: bottom - top }
}

/**
 * 이 팝오버의 SVG 유리 — 불투명 속(CSS $wb-fill과 같은 색)과 필터의 테두리·깊이·농도를 사용자 물 설정(판 색·유리
 * 효과)에 맞춘다. CSS 판(w-glass·wb-panel)은 같은 값을 --w-* 변수로 받는다(theme/water.ts).
 */
function useGlassLook() {
  const { water } = useAppearance()
  const pane = waterPaneColors(water)
  return { fillFrom: pane.solidHi, fillTo: pane.solidLo, filter: { rim: water.rim, depth: water.depth, frost: water.frost } }
}

/**
 * 물 모양 미리 데우기는 한 페이지에 한 번 — 처음 그리는 필터는 GPU가 셰이더를 만드느라(약 24ms) 첫 펼침의 첫
 * 프레임이 늦는다. 처음 부른 쪽만 true
 */
let gooWarmed = false
const claimGooWarm = () => {
  if (gooWarmed) return false
  gooWarmed = true
  return true
}

/**
 * 물 모양 미리 데우기 — 팝오버와 같은 필터·모양(칸 빨강 + 팝오버 초록·파랑, 불투명 속)을 아주 옅게(불투명도
 * 0.002 — 눈에 안 보인다) 한 번 그려 GPU가 셰이더를 미리 만들게 한다. 칸에 마우스·초점이 오면 잠깐 그린다
 */
function WaterGooWarm({ id }: { id: string }) {
  const look = useGlassLook()
  return (
    <svg
      className="water-multi-warm"
      width="120"
      height="140"
      aria-hidden
      focusable="false"
    >
      <defs>
        <WaterGlassFilter
          id={id}
          region={{ x: 0, y: 0, width: 120, height: 140 }}
          k={GOO_K}
          lift={GOO_LIFT}
          gooShape
          {...look.filter}
        />
        <WaterGooShapeFilter
          id={`${id}-shape`}
          region={{ x: 0, y: 0, width: 120, height: 140 }}
          k={GOO_K}
        />
        <clipPath id={`${id}-clip`}>
          <rect x="0" y="50" width="120" height="90" />
        </clipPath>
        <linearGradient
          id={`${id}-fill`}
          x1="20"
          y1="56"
          x2="100"
          y2="116"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor={look.fillFrom} />
          <stop offset="1" stopColor={look.fillTo} />
        </linearGradient>
      </defs>
      <rect
        x="20"
        y="56"
        width="80"
        height="60"
        rx={POP_R}
        clipPath={`url(#${id}-clip)`}
        fill={`url(#${id}-fill)`}
      />
      <g filter={`url(#${id})`}>
        <g filter={`url(#${id}-shape)`}>
          <rect x="20" y="10" width="80" height="40" rx="20" fill="#f00" />
          <rect
            x="20"
            y="44"
            width="80"
            height="72"
            rx={POP_R}
            fill="#0f0"
            style={{ mixBlendMode: 'screen' }}
          />
          <rect
            x="20"
            y="56"
            width="80"
            height="60"
            rx={POP_R}
            fill="#00f"
            fillOpacity={0.5}
            style={{ mixBlendMode: 'screen' }}
          />
        </g>
      </g>
    </svg>
  )
}

/**
 * 여러 개 고르는 드롭다운(물) — 겉은 다른 입력 칸과 같은 홈 칸이고, 누르면 유리 팝오버가 칸에서 물처럼
 * 뻗어 나온다(WaterPopEngine — D7 메뉴 펼침·접힘을 세로로). 항목은 차례로 나타나고, 키보드로 고르는
 * 자리(밝은 알약)는 D7 표시 알약 스프링으로 따라간다. 아래 자리가 모자라면 위로 펼친다.
 *
 * 키보드 — 칸에서 ↓·↑·Enter·Space로 열기, 목록에서 ↑↓·Home·End로 옮기고 Space·Enter로 켜고 끄기,
 * Esc는 목록만 닫고(서랍은 그대로) 칸으로 돌아간다. Tab은 목록을 닫고 칸으로.
 */
export function WaterMultiSelect({
  id,
  options,
  selected,
  onChange,
  placeholder = '선택 안 함',
}: WaterMultiSelectProps) {
  const root = usePortalRoot()
  const reduced = useReducedMotion()
  const look = useGlassLook()
  const [open, setOpen] = useState(false)
  // 팝오버를 그리고 있는지 — 접히는 움직임이 끝날 때까지 남긴다
  const [present, setPresent] = useState(false)
  if (open && !present) setPresent(true)
  const [active, setActive] = useState(0)
  const listId = useId()
  // 물 모양 미리 데우기를 그리는 중(한 페이지에 한 번, 잠깐)
  const [warming, setWarming] = useState(false)

  const wrap = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const triggerGlass = useRef<HTMLSpanElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const glass = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const hilite = useRef<HTMLDivElement>(null)
  // 물 모양(움직이는 동안만) — 자리·크기는 열 때 한 번 재서 바로 쓴다(React가 다시 그리지 않게)
  const gooSvg = useRef<SVGSVGElement>(null)
  const gooClip = useRef<SVGRectElement>(null)
  const gooGrad = useRef<SVGLinearGradientElement>(null)
  const gooFill = useRef<SVGRectElement>(null)
  const gooTrigger = useRef<SVGRectElement>(null)
  const gooBody = useRef<SVGRectElement>(null)
  const gooTrue = useRef<SVGRectElement>(null)
  // 다 펼쳐진 팝오버에만 까는 옅은 그림자(물 모양 동안은 없다)
  const float = useRef<HTMLDivElement>(null)
  const gooId = `water-goo-${useId().replace(/:/g, '')}`
  const optionEls = useRef<(HTMLDivElement | null)[]>([])
  const engine = useRef<WaterPopEngine | null>(null)
  const hiliteEngine = useRef<WaterIndicatorEngine | null>(null)
  const hiliteShown = useRef(false)
  // 누른 시각 — 엔진이 그 시각부터 잰다(효과가 늦게 돌아도 D7과 같은 시간표)
  const pressedAt = useRef<number | undefined>(undefined)
  // 키보드로 열었으면 항목이 나타날 즈음 그 항목으로 초점을 옮긴다
  const focusOnOpen = useRef(false)

  const count = options.length
  // 칸에 마우스·초점이 오면(누르기 전) 물 모양 필터를 미리 그려 둔다
  const warmUp = () => {
    if (!reduced && claimGooWarm()) setWarming(true)
  }
  const close = (focusTrigger: boolean) => {
    pressedAt.current = waterClock()
    setOpen(false)
    if (focusTrigger) trigger.current?.focus()
  }
  const openWith = (fromKeyboard: boolean, index?: number) => {
    pressedAt.current = waterClock()
    const first = Math.max(
      0,
      options.findIndex((o) => selected.includes(o)),
    )
    setActive(index ?? first)
    focusOnOpen.current = fromKeyboard
    setOpen(true)
  }
  const toggle = (option: string) =>
    onChange(
      selected.includes(option)
        ? selected.filter((v) => v !== option)
        : [...selected, option],
    )

  // 단추 자리에 팝오버를 맞춘다(열 때·스크롤·창 크기) — 이벤트·효과에서만 레이아웃을 읽는다
  const place = useEffectEvent(() => {
    const t = trigger.current
    const p = pop.current
    if (!t || !p) return
    const r = snapRect(t.getBoundingClientRect())
    const dir = p.dataset.dir === 'up' ? -1 : 1
    p.style.transform = `translate3d(${r.left}px, ${dir === 1 ? r.bottom : r.top}px, 0)`
    p.style.width = `${r.width}px`
  })

  /**
   * 물 모양 SVG의 자리·크기 — 칸 + 가장 길게 뻗을 때(15% 넘침)까지. 필터 세로 영역은 엔진이 프레임마다 지금
   * 모양만큼 잡는다. 좌표는 팝오버 좌표(0 = 칸 끝) 그대로. 레이아웃 효과에서 한 번 쓴다
   */
  const layoutGoo = (w: number, th: number, height: number, dir: 1 | -1) => {
    const svg = gooSvg.current
    const clip = gooClip.current
    const grad = gooGrad.current
    const fill = gooFill.current
    const red = gooTrigger.current
    const body = gooBody.current
    const trueBody = gooTrue.current
    // 바깥(유리)·안(물 모양) 필터 — 영역을 같게 쓴다
    const filters = svg
      ? Array.from(svg.querySelectorAll<SVGFilterElement>('filter'))
      : []
    if (
      !svg ||
      !clip ||
      !grad ||
      !fill ||
      !red ||
      !body ||
      !trueBody ||
      filters.length < 2
    )
      return null
    const M = GOO_M
    const dpr = window.devicePixelRatio || 1
    const far = Math.ceil((GAP + height) * 1.17 + 2)
    // 위 끝을 장치 화소에 — 위로 펼치면 SVG 위 끝이 먼 끝이라 소수면 화소 사이에 놓인다
    const top = dir === 1 ? -th - M : -Math.ceil((far + M) * dpr) / dpr
    const H = dir === 1 ? th + far + 2 * M : th + M - top
    const set = (node: Element, attrs: Record<string, number | string>) => {
      for (const [k, v] of Object.entries(attrs))
        node.setAttribute(k, String(v))
    }
    set(svg, {
      viewBox: `${-M} ${top} ${w + 2 * M} ${H}`,
      width: w + 2 * M,
      height: H,
    })
    svg.style.left = `${-M}px`
    svg.style.top = `${top}px`
    // 필터가 그릴 가로 영역 — 세로는 엔진이 프레임마다 지금 모양만큼만 잡는다
    for (const f of filters) set(f, { x: -M, width: w + 2 * M })
    // 칸(빨강) — 기본 부품 입력 칸과 같은 알약. 팝오버는 초록(물 모양)·파랑(참 모양) 두 장 — 모두 제 크기 그대로
    // (기반 필터가 검은 바탕에 깔아 꺼내 가장자리가 부풀지 않는다)
    set(red, { x: 0, y: dir === 1 ? -th : 0, width: w, height: th, rx: th / 2 })
    set(body, { x: 0, width: w, rx: POP_R })
    set(trueBody, { x: 0, width: w, rx: POP_R })
    set(fill, { x: 0, width: w, rx: POP_R })
    // 속은 칸 바깥만
    set(clip, {
      x: -M,
      y: dir === 1 ? 0 : -(far + M),
      width: w + 2 * M,
      height: far + M,
    })
    // CSS linear-gradient(150deg)와 같은 줄 — 멈춘 팝오버 상자 기준(가운데를 지나고 길이 = w·sin + h·|cos|)
    const y0 = dir === 1 ? GAP : -(GAP + height)
    const dx = Math.sin((150 * Math.PI) / 180)
    const dy = -Math.cos((150 * Math.PI) / 180)
    const L = w * Math.abs(dx) + height * Math.abs(dy)
    const cx = w / 2
    const cy = y0 + height / 2
    set(grad, {
      x1: cx - (dx * L) / 2,
      y1: cy - (dy * L) / 2,
      x2: cx + (dx * L) / 2,
      y2: cy + (dy * L) / 2,
    })
    return { svg, body, trueBody, fill, filters, box: { th, m: M } }
  }

  // 팝오버를 그리는 동안 — 자리·높이를 재고 엔진을 붙인다
  useLayoutEffect(() => {
    if (!present) return
    const t = trigger.current
    const p = pop.current
    const g = glass.current
    const l = list.current
    if (!t || !p || !g || !l) return
    const r = snapRect(t.getBoundingClientRect())
    const natural = l.scrollHeight
    const below = window.innerHeight - r.bottom - EDGE - GAP
    const above = r.top - EDGE - GAP
    const dir = natural <= below || below >= above ? 1 : -1
    // 정수 높이 — 소수면 크롬이 CSS 상자를 SVG보다 장치 화소 하나 크게 그려 바꿔 끼울 때 어긋난다
    const height = Math.floor(
      Math.min(natural, MAX_H, Math.max(120, dir === 1 ? below : above)),
    )
    p.dataset.dir = dir === 1 ? 'down' : 'up'
    l.style.height = `${height}px`
    place()
    const items = Array.from(p.querySelectorAll<HTMLElement>('[data-reveal]'))
    const goo = layoutGoo(r.width, r.height, height, dir)
    const tg = triggerGlass.current
    const e = new WaterPopEngine(
      {
        glass: g,
        items,
        content: l,
        goo: goo && tg ? { ...goo, triggerGlass: tg } : null,
        float: float.current,
      },
      { gap: GAP, height, overlap: OVERLAP, count: items.length },
      dir,
      reduced,
    )
    engine.current = e
    const h = hilite.current
      ? new WaterIndicatorEngine(hilite.current, { axis: 'y' })
      : null
    hiliteEngine.current = h
    hiliteShown.current = false
    const follow = () => place()
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      e.destroy()
      h?.destroy()
      engine.current = null
      hiliteEngine.current = null
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
    // reduced는 처음 연 순간 값으로 — 도중에 바뀌어도 다음에 열 때 따른다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present])

  // 열고 닫기 — 닫힘 움직임이 끝나면 팝오버를 내린다. 닫을 때 밝은 알약도 내용과 같이 걷는다
  useLayoutEffect(() => {
    const e = engine.current
    if (!e) return
    if (!open) {
      hiliteShown.current = false
      hilite.current?.classList.remove('is-shown')
    }
    e.setOpen(open, pressedAt.current, () => setPresent(false))
    pressedAt.current = undefined
  }, [open, present])

  // 미리 데우기는 GPU가 한 번 그릴 동안만 두고 내린다
  useEffect(() => {
    if (!warming) return
    const timer = window.setTimeout(() => setWarming(false), 500)
    return () => window.clearTimeout(timer)
  }, [warming])

  // 한가할 때도 한 번 데운다 — 터치는 누르기 전 hover가 없다. 서랍 등이 열리는 움직임이 끝난 뒤(1.2초)
  useEffect(() => {
    if (reduced) return
    let idle = 0
    const warm = () => {
      if (claimGooWarm()) setWarming(true)
    }
    const timer = window.setTimeout(() => {
      if ('requestIdleCallback' in window)
        idle = window.requestIdleCallback(warm, { timeout: 2000 })
      else warm()
    }, 1200)
    return () => {
      window.clearTimeout(timer)
      if (idle) window.cancelIdleCallback(idle)
    }
  }, [reduced])

  // 키보드로 열었으면 고른 항목이 나타날 즈음(D7 0.26초) 초점을 옮긴다
  useEffect(() => {
    if (!open || !focusOnOpen.current) return
    focusOnOpen.current = false
    const delay = reduced
      ? 0
      : (POP_TIMING.reveal +
          Math.min(active, POP_TIMING.staggerCap) * WATER_REVEAL.stagger) *
        1000
    const timer = window.setTimeout(
      () => optionEls.current[active]?.focus(),
      delay,
    )
    return () => window.clearTimeout(timer)
    // 열 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (wrap.current?.contains(target) || pop.current?.contains(target))
        return
      pressedAt.current = waterClock()
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  /** 밝은 알약을 항목 뒤로 — 숨어 있었으면 바로 놓고, 보이던 중이면 스프링으로 옮긴다 */
  const moveHilite = (index: number) => {
    const el = optionEls.current[index]
    const h = hiliteEngine.current
    const node = hilite.current
    if (!el || !h || !node) return
    const target = {
      pos: el.offsetTop + el.offsetHeight / 2,
      size: el.offsetHeight,
    }
    h.set(target, {
      instant: !hiliteShown.current || reduced,
      at: waterClock(),
      step: el.offsetHeight,
    })
    hiliteShown.current = true
    node.classList.add('is-shown')
  }
  const hideHilite = () => {
    hiliteShown.current = false
    hilite.current?.classList.remove('is-shown')
  }

  const focusOption = (index: number) => {
    const next = (index + count) % count
    setActive(next)
    optionEls.current[next]?.focus()
  }

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      e.stopPropagation()
      close(false)
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) || count === 0)
      return
    e.preventDefault()
    if (open) focusOption(e.key === 'ArrowUp' ? count - 1 : active)
    else openWith(true, e.key === 'ArrowUp' ? count - 1 : undefined)
  }

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = optionEls.current.findIndex(
      (el) => el === document.activeElement,
    )
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        close(true)
        return
      case 'Tab':
        // 목록은 칸 뒤 포털에 있어 Tab 순서가 엉킨다 — 닫고 칸으로 돌아간다
        e.preventDefault()
        close(true)
        return
    }
    if (cur < 0) return
    const next =
      e.key === 'ArrowDown'
        ? cur + 1
        : e.key === 'ArrowUp'
          ? cur - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? count - 1
              : null
    if (next !== null) {
      e.preventDefault()
      focusOption(next)
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      toggle(options[cur])
    }
  }

  return (
    <div
      ref={wrap}
      className="water-multi"
      data-popover-open={open || undefined}
    >
      <button
        ref={trigger}
        id={id}
        type="button"
        className={cx('water-multi__trigger', open && 'is-open')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={present ? listId : undefined}
        onClick={(e) => (open ? close(false) : openWith(e.detail === 0))}
        onKeyDown={onTriggerKey}
        onPointerEnter={warmUp}
        onPointerDown={warmUp}
        onFocus={warmUp}
      >
        {/* 칸 유리 — 기본 부품에 고르기 칸이 없어, WaterTextField 칸의 유리 알약(water-field__box)을 글자 뒤 따로
            층으로 빌린다(물 모양 SVG와 바꿔 낄 때 글자는 두고 유리만 숨긴다) */}
        <span
          ref={triggerGlass}
          className="water-field__box water-multi__glass"
          aria-hidden
        />
        <span
          className={cx(
            'water-multi__value',
            selected.length === 0 && 'is-empty',
          )}
        >
          {selected.length ? selected.join(', ') : placeholder}
        </span>
        <ChevronDown className="water-multi__chevron" size={15} aria-hidden />
      </button>

      {warming &&
        root &&
        createPortal(<WaterGooWarm id={`${gooId}-warm`} />, root)}
      {present &&
        root &&
        createPortal(
          <div ref={pop} className="water-multi-pop">
            {/* 멈춘 팝오버의 옅은 그림자 — 유리 밑, 칸 끝에서 자르지 않는다(위로 펼치면 칸 위로 떨어진다) */}
            <div ref={float} className="water-multi-pop__float" aria-hidden />
            {/* 움직이는 동안만 보이는 물 모양 — 칸(빨강)과 팝오버(초록)를 한 장으로 흐려 한 덩어리로(D7 goo) */}
            {!reduced && (
              <svg
                ref={gooSvg}
                className="water-multi-goo"
                aria-hidden
                focusable="false"
              >
                <defs>
                  <WaterGlassFilter
                    id={gooId}
                    region={{ x: 0, y: 0, width: 1, height: 1 }}
                    k={GOO_K}
                    lift={GOO_LIFT}
                    gooShape
                    {...look.filter}
                  />
                  <WaterGooShapeFilter
                    id={`${gooId}-shape`}
                    region={{ x: 0, y: 0, width: 1, height: 1 }}
                    k={GOO_K}
                  />
                  <clipPath id={`${gooId}-clip`}>
                    <rect ref={gooClip} />
                  </clipPath>
                  <linearGradient
                    ref={gooGrad}
                    id={`${gooId}-fill`}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0" stopColor={look.fillFrom} />
                    <stop offset="1" stopColor={look.fillTo} />
                  </linearGradient>
                </defs>
                <rect
                  ref={gooFill}
                  clipPath={`url(#${gooId}-clip)`}
                  fill={`url(#${gooId}-fill)`}
                />
                {/* 두 겹 — 안에서 물 모양을 한 번 만들고(WaterGooShapeFilter) 바깥에서 유리를 입힌다. 한 겹(goo)이면
                    크롬이 테두리·그림자마다 물 모양을 다시 계산해 GPU 패스가 3배 */}
                <g filter={`url(#${gooId})`}>
                  <g filter={`url(#${gooId}-shape)`}>
                    <rect ref={gooTrigger} fill="#f00" />
                    <rect
                      ref={gooBody}
                      fill="#0f0"
                      style={{ mixBlendMode: 'screen' }}
                    />
                    {/* 팝오버 참 모양(파랑) — 떨어져 있을 때만 켠다(엔진이 fill-opacity를 쓴다) */}
                    <rect
                      ref={gooTrue}
                      fill="#00f"
                      fillOpacity={0}
                      style={{ mixBlendMode: 'screen' }}
                    />
                  </g>
                </g>
              </svg>
            )}
            {/* CSS 유리 — 칸 쪽(0 너머)은 잘라 칸 글자를 가리지 않게(닫힌 자리에서는 칸 속에 들어가 있다) */}
            <div className="water-multi-pop__clip" aria-hidden>
              <div ref={glass} className="water-multi-pop__glass" />
            </div>
            <div
              ref={list}
              className="water-multi-pop__content"
              onKeyDown={onListKey}
              onPointerLeave={hideHilite}
            >
              <div
                ref={hilite}
                className="water-multi-pop__hilite"
                aria-hidden
              />
              <div
                id={listId}
                className="water-multi-pop__list"
                role="listbox"
                aria-multiselectable="true"
                aria-labelledby={id}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                    hideHilite()
                }}
              >
                {options.map((option, i) => {
                  const on = selected.includes(option)
                  return (
                    <div
                      key={option}
                      ref={(el) => {
                        optionEls.current[i] = el
                      }}
                      data-reveal
                      role="option"
                      aria-selected={on}
                      tabIndex={i === active ? 0 : -1}
                      className={cx('water-multi-pop__option', on && 'is-on')}
                      onClick={() => {
                        setActive(i)
                        toggle(option)
                      }}
                      onPointerEnter={() => moveHilite(i)}
                      onFocus={() => {
                        setActive(i)
                        moveHilite(i)
                      }}
                    >
                      {/* 기본 부품 WaterCheck — 모양·움직임만(누르기·읽기는 항목이 맡는다) */}
                      <WaterCheck
                        className="water-multi-pop__check"
                        checked={on}
                        readOnly
                        tabIndex={-1}
                        aria-hidden
                      />
                      <span className="water-multi-pop__label">{option}</span>
                    </div>
                  )
                })}
              </div>
              {/* 모두 해제 — 자리는 늘 두고(높이가 흔들리지 않게) 고른 게 없으면 숨긴다 */}
              <button
                type="button"
                data-reveal
                className={cx(
                  'water-multi-pop__clear',
                  selected.length === 0 && 'is-hidden',
                )}
                aria-hidden={selected.length === 0 || undefined}
                tabIndex={selected.length === 0 ? -1 : undefined}
                onClick={() => onChange([])}
              >
                모두 해제
              </button>
            </div>
          </div>,
          root,
        )}
    </div>
  )
}

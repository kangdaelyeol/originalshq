import { useEffect, useId, useRef } from 'react'
import { cx } from '../../../../lib/cx'
import { useReducedMotion } from '../../../../water/hooks'
import { watchOnScreen } from './use-voice-script'
import { modelLevelAt, VOICE_CALM_LEVEL, VOICE_IDLE_LEVEL, VOICE_LEVEL_MODELS, type VoiceSpeaker } from './voice-script'

interface VoiceOrbProps {
  /** you = 회색 고리 넷, agent = 주황 속불 + 고리 셋, null = 아무도 말하지 않음(작게 숨 쉰다) */
  speaker: VoiceSpeaker | null
  /** 바깥에서 주는 소리 크기(0~1). 주면 스스로 만든 출렁임 대신 이 값에 멈춘다(바뀔 때만 다시 쓴다) */
  level?: number
  /** 매 프레임 불러 소리 크기를 읽는다(오디오 분석기·대본 재생) — React를 다시 그리지 않는다 */
  getLevel?: () => number
  /** false면 말하는 사람이 있어도 출렁이지 않고 숨만 쉰다(기본 true) */
  speaking?: boolean
  className?: string
}

/**
 * 음성 모드 구슬 — 어두운 그늘 위에 고리 넷(사용자)이나 주황 속불과 고리 셋(Kronos). 소리 크기 L(0~1)에 따라
 * 고리 반지름·밝기와 속불 크기·밝기가 곧게 바뀐다(F289~F680에서 잰 값, 잔차 0.1~0.5px).
 * L은 루트의 CSS 변수 --d14v-l 하나로만 넘기고, 고리 반지름은 CSS r: calc()가 계산한다 — 매 프레임 React를
 * 거치지 않고 rAF가 그 변수 하나만 쓴다. 화면 밖이면 rAF를 멈추고, 움직임 줄이기면 L=0.4에 멈춘다.
 * 크기는 22.4em 정사각형(그늘 반지름 11.2em) — 부모가 요소 가운데를 구슬 가운데에 놓는다.
 * 말하는 사람이 바뀌면 영상처럼 한 프레임에 바뀐다(넘어가는 움직임 없음).
 */
export function VoiceOrb({ speaker, level, getLevel, speaking = true, className }: VoiceOrbProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const getLevelRef = useRef(getLevel)
  const reduced = useReducedMotion()
  // url(#…)에 쓰니 글자·숫자만 남긴다
  const uid = `d14v${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  useEffect(() => {
    getLevelRef.current = getLevel
  }, [getLevel])

  const fixedLevel = getLevel === undefined && level !== undefined ? level : null
  const live = speaker !== null && speaking

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const write = (l: number) => el.style.setProperty('--d14v-l', l.toFixed(3))
    if (fixedLevel !== null) {
      write(fixedLevel)
      return
    }
    if (reduced) {
      write(live ? VOICE_CALM_LEVEL : VOICE_IDLE_LEVEL.base)
      return
    }
    // 턴(말하는 사람)이 바뀔 때마다 출렁임 시계를 0부터 — 영상 Kronos 첫 턴이 그 시각부터 맞는다
    const t0 = performance.now()
    const model = speaker ? VOICE_LEVEL_MODELS[speaker] : null
    let raf = 0
    let visible = true
    const tick = (now: number) => {
      raf = 0
      const t = (now - t0) / 1000
      const read = getLevelRef.current
      let l: number
      if (read) l = read()
      else if (live && model) l = modelLevelAt(model, t)
      else l = VOICE_IDLE_LEVEL.base + VOICE_IDLE_LEVEL.amp * Math.sin(2 * Math.PI * VOICE_IDLE_LEVEL.hz * t)
      write(l)
      if (visible) raf = requestAnimationFrame(tick)
    }
    const stop = watchOnScreen(el, (v) => {
      visible = v
      if (v && !raf) raf = requestAnimationFrame(tick)
    })
    raf = requestAnimationFrame(tick)
    return () => {
      stop()
      cancelAnimationFrame(raf)
    }
  }, [fixedLevel, live, reduced, speaker])

  const tone = speaker ?? 'idle'
  return (
    <div ref={rootRef} className={cx('d14v-orb', `d14v-orb--${tone}`, className)} aria-hidden>
      <svg className="d14v-orb__svg" viewBox="-112 -112 224 224">
        <defs>
          {/* 그늘 — r 84까지 0.62, 112에서 0. 지도 위에 덮여 그 아래 글씨도 어둡게 한다(F330 "QUOTE" 글자 밝기
              r 87 → 113: 0.37 → 0.97, 좌우 바탕 r 88 → 108: 0.5 → 0.93 — 둘 사이로 맞췄다) */}
          <radialGradient id={`${uid}-halo`}>
            <stop offset="0" stopColor="#060504" stopOpacity="0.62" />
            <stop offset="0.75" stopColor="#060504" stopOpacity="0.62" />
            <stop offset="0.786" stopColor="#060504" stopOpacity="0.55" />
            <stop offset="0.821" stopColor="#060504" stopOpacity="0.46" />
            <stop offset="0.857" stopColor="#060504" stopOpacity="0.4" />
            <stop offset="0.893" stopColor="#060504" stopOpacity="0.3" />
            <stop offset="0.929" stopColor="#060504" stopOpacity="0.2" />
            <stop offset="0.964" stopColor="#060504" stopOpacity="0.09" />
            <stop offset="1" stopColor="#060504" stopOpacity="0" />
          </radialGradient>
          {/* 안쪽 빛 — 가운데에서 바깥 고리 근처까지 고르게 줄어든다(F319 r 0 → 86: 68 → 23) */}
          <radialGradient id={`${uid}-glow`}>
            <stop offset="0" className="d14v-orb__glow-stop" stopOpacity="1" />
            <stop offset="0.22" className="d14v-orb__glow-stop" stopOpacity="0.86" />
            <stop offset="0.45" className="d14v-orb__glow-stop" stopOpacity="0.58" />
            <stop offset="0.68" className="d14v-orb__glow-stop" stopOpacity="0.32" />
            <stop offset="0.86" className="d14v-orb__glow-stop" stopOpacity="0.14" />
            <stop offset="1" className="d14v-orb__glow-stop" stopOpacity="0" />
          </radialGradient>
          {/* 속불 — 번진 원. 반지름 = 반값 반지름의 2배, 반값 반지름 20.6 + 6.6L(F414 20.8 · F373 27.2) */}
          <radialGradient id={`${uid}-core`}>
            <stop offset="0" className="d14v-orb__core-stop" stopOpacity="1" />
            <stop offset="0.22" className="d14v-orb__core-stop" stopOpacity="0.99" />
            <stop offset="0.3" className="d14v-orb__core-stop" stopOpacity="0.96" />
            <stop offset="0.37" className="d14v-orb__core-stop" stopOpacity="0.82" />
            <stop offset="0.44" className="d14v-orb__core-stop" stopOpacity="0.65" />
            <stop offset="0.515" className="d14v-orb__core-stop" stopOpacity="0.46" />
            <stop offset="0.59" className="d14v-orb__core-stop" stopOpacity="0.33" />
            <stop offset="0.66" className="d14v-orb__core-stop" stopOpacity="0.18" />
            <stop offset="0.735" className="d14v-orb__core-stop" stopOpacity="0.09" />
            <stop offset="0.86" className="d14v-orb__core-stop" stopOpacity="0.025" />
            <stop offset="1" className="d14v-orb__core-stop" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="d14v-orb__halo" r="112" fill={`url(#${uid}-halo)`} />
        <circle className="d14v-orb__glow" fill={`url(#${uid}-glow)`} />
        {speaker === 'agent' && (
          <>
            <circle className="d14v-orb__disc d14v-orb__disc--4" />
            <circle className="d14v-orb__disc d14v-orb__disc--3" />
            <circle className="d14v-orb__core" fill={`url(#${uid}-core)`} />
          </>
        )}
        {speaker !== 'agent' && <circle className="d14v-orb__ring d14v-orb__ring--1" />}
        <circle className="d14v-orb__ring d14v-orb__ring--2" />
        <circle className="d14v-orb__ring d14v-orb__ring--3" />
        <circle className="d14v-orb__ring d14v-orb__ring--4" />
      </svg>
    </div>
  )
}

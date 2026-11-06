import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useReducedMotion } from '../../../../water/hooks'
import {
  nextCharAt,
  scriptLevelAt,
  typedAt,
  turnIndexAt,
  VOICE_CALM_LEVEL,
  VOICE_SCRIPT,
  type VoiceDepartment,
  type VoiceScript,
  type VoiceSpeaker,
  type VoiceTurn,
  type VoiceViewKind,
} from './voice-script'

export type VoicePhase = 'lead' | 'voice' | 'done'

export interface VoiceScriptOptions {
  /** 붙자마자 튼다(기본 true) */
  autoPlay?: boolean
  /** 끝나면 마지막 장면을 1.5초 두었다가 처음부터 다시(기본 false) */
  loop?: boolean
  /** 음성 모드 전 SALES 화면(lead초)부터 튼다(기본 true) */
  withLead?: boolean
  /** 움직임 줄이기일 때 다 쳐진 채로 보여 줄 턴(기본 1 = Kronos 첫 답) */
  calmTurn?: number
  /** 이 요소가 화면 밖이면 저절로 멈췄다가 다시 보이면 잇는다(글자마다 다시 그리지 않게) */
  watch?: RefObject<Element | null>
}

export interface VoiceScriptState {
  /** lead = 음성 모드 전(막대·말풍선·구슬 없음), voice = 대화 중, done = 끝(마지막 턴이 다 쳐진 채) */
  phase: VoicePhase
  /** -1 = 첫 턴 전 */
  turnIndex: number
  turn: VoiceTurn | null
  speaker: VoiceSpeaker | null
  /** 지금까지 쳐진 글 */
  text: string
  typed: number
  view: VoiceViewKind
  /** view가 department일 때 그 부서 */
  department: VoiceDepartment | null
  playing: boolean
  /** 움직임 줄이기 — 멈춘 한 장면(calmTurn을 다 친 채)을 보여 준다 */
  reduced: boolean
  play: () => void
  pause: () => void
  replay: () => void
  /** 지금 구슬 소리 크기(0~1) — 렌더 없이 rAF에서 읽는다(VoiceOrb getLevel) */
  getLevel: () => number
  /** 대본 시각(초, 음성 모드 켜진 때가 0) */
  getTime: () => number
}

interface Snapshot {
  phase: VoicePhase
  index: number
  typed: number
}

function snapshotAt(script: VoiceScript, t: number): Snapshot {
  if (t < 0) return { phase: 'lead', index: -1, typed: 0 }
  if (t >= script.end) {
    const last = script.turns.length - 1
    return { phase: 'done', index: last, typed: script.turns[last].text.length }
  }
  const index = turnIndexAt(script, t)
  return { phase: 'voice', index, typed: index < 0 ? 0 : typedAt(script.turns[index], t) }
}

/** t 뒤 처음 바뀌는 시각 — 다음 글자·다음 턴·끝 가운데 가장 이른 것 */
function nextChangeAt(script: VoiceScript, t: number, snap: Snapshot): number {
  if (t < 0) return 0
  const next = script.turns[snap.index + 1]
  let at = next ? next.start : script.end
  if (snap.index >= 0) at = Math.min(at, nextCharAt(script.turns[snap.index], snap.typed))
  return at
}

const same = (a: Snapshot, b: Snapshot) => a.phase === b.phase && a.index === b.index && a.typed === b.typed

/** 되풀이할 때 끝 장면을 두는 시간(초) — 영상은 여기서 다른 장면으로 잘린다 */
const LOOP_HOLD = 1.5

/**
 * 영상 대화 대본(voice-script)을 튼다 — 글자가 하나 늘 때·턴이 바뀔 때만 다시 그린다(다음 바뀌는 시각에 맞춘
 * setTimeout 하나). 구슬 소리 크기는 getLevel로 rAF에서 읽어 React를 거치지 않는다.
 * 시계는 performance.now() 기준이라 탭이 뒤에 있다 돌아와도 제 시각으로 건너뛴다.
 */
export function useVoiceScript(script: VoiceScript = VOICE_SCRIPT, options: VoiceScriptOptions = {}): VoiceScriptState {
  const { autoPlay = true, loop = false, withLead = true, calmTurn = 1, watch } = options
  const reduced = useReducedMotion()
  const startT = withLead ? -script.lead : 0
  const [snap, setSnap] = useState<Snapshot>(() => snapshotAt(script, startT))
  const [playing, setPlaying] = useState(false)
  const [run, setRun] = useState(0)

  // 대본 시각 = (지금 − origin) / 1000. 멈춰 있으면 heldRef.
  const originRef = useRef(0)
  const heldRef = useRef<number | null>(startT)
  const snapRef = useRef(snap)

  const now = useCallback(() => {
    const held = heldRef.current
    return held !== null ? held : (performance.now() - originRef.current) / 1000
  }, [])

  const play = useCallback(() => {
    if (reduced) return
    let t = heldRef.current ?? now()
    if (t >= script.end) t = startT
    originRef.current = performance.now() - t * 1000
    heldRef.current = null
    setPlaying(true)
    setRun((n) => n + 1)
  }, [now, reduced, script.end, startT])

  const pause = useCallback(() => {
    if (heldRef.current !== null) return
    heldRef.current = now()
    setPlaying(false)
  }, [now])

  const replay = useCallback(() => {
    heldRef.current = startT
    play()
  }, [play, startT])

  // 재생 중이면 다음 바뀌는 시각마다 한 번 깬다
  useEffect(() => {
    if (!playing || reduced) return
    let timer = 0
    function tick() {
      let t = now()
      if (loop && t >= script.end + LOOP_HOLD) {
        originRef.current = performance.now() - startT * 1000
        t = startT
      }
      const next = snapshotAt(script, t)
      if (!same(next, snapRef.current)) {
        snapRef.current = next
        setSnap(next)
      }
      if (next.phase === 'done' && !loop) {
        heldRef.current = script.end
        setPlaying(false)
        return
      }
      const at = next.phase === 'done' ? script.end + LOOP_HOLD : nextChangeAt(script, t, next)
      timer = window.setTimeout(tick, Math.max(0, (at - t) * 1000) + 1)
    }
    timer = window.setTimeout(tick, 0)
    return () => window.clearTimeout(timer)
  }, [loop, now, playing, reduced, run, script, startT])

  // 처음 붙을 때 저절로 튼다
  useEffect(() => {
    if (!autoPlay || reduced) return
    const id = window.setTimeout(play, 0)
    return () => window.clearTimeout(id)
  }, [autoPlay, play, reduced])

  // 화면 밖이면 멈추고, 그래서 멈췄던 것만 다시 보일 때 잇는다
  useEffect(() => {
    const el = watch?.current
    if (!el) return
    let resume = false
    return watchOnScreen(el, (visible) => {
      if (!visible && heldRef.current === null) {
        resume = true
        pause()
      } else if (visible && resume) {
        resume = false
        play()
      }
    })
  }, [pause, play, watch])

  const getLevel = useCallback(
    () => (reduced ? VOICE_CALM_LEVEL : scriptLevelAt(script, now())),
    [now, reduced, script],
  )

  const shown: Snapshot = reduced
    ? { phase: 'voice', index: calmTurn, typed: script.turns[calmTurn].text.length }
    : snap
  const turn = shown.index >= 0 ? script.turns[shown.index] : null
  const inLead = shown.phase === 'lead' || !turn
  return {
    phase: shown.phase,
    turnIndex: shown.index,
    turn,
    speaker: inLead ? null : turn.speaker,
    text: turn ? turn.text.slice(0, shown.typed) : '',
    typed: shown.typed,
    view: inLead ? 'department' : turn.view,
    department: inLead ? 'sales' : turn.view === 'department' ? (turn.department ?? null) : null,
    playing: playing && !reduced,
    reduced,
    play,
    pause,
    replay,
    getLevel,
    getTime: now,
  }
}

/**
 * 요소가 화면에 보이는지 지켜본다(IntersectionObserver) — 안 보이면 rAF·CSS 움직임을 쉬게 할 때 쓴다.
 * 콜백에서 style·class를 바로 고치면 React를 다시 그리지 않는다. 지원하지 않으면 늘 보인다고 친다.
 */
export function watchOnScreen(el: Element, onChange: (visible: boolean) => void): () => void {
  if (typeof IntersectionObserver !== 'function') {
    onChange(true)
    return () => {}
  }
  const io = new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1]
    if (entry) onChange(entry.isIntersecting)
  })
  io.observe(el)
  return () => io.disconnect()
}

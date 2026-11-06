import { useRef, useState, type CSSProperties } from 'react'
import { cx } from '../../../../lib/cx'
import { FounderConstellation } from './founder-constellation'
import { SpeechBubble } from './speech-bubble'
import { useVoiceScript } from './use-voice-script'
import { VoiceModeBar } from './voice-mode-bar'
import { VoiceOrb } from './voice-orb'
import { VOICE_BAR_TABS, VOICE_SCRIPT, type VoiceSpeaker } from './voice-script'

const [ASK, ANSWER] = VOICE_SCRIPT.turns

/**
 * D14 음성 모드 부품 — 부품마다 따로(값 바꿔 보기) + 영상 대본을 그대로 트는 작은 무대.
 * 무대의 SALES는 자리만 잡은 대역이다(진짜 부서·카메라는 D14 지도 쪽). 크기는 전부 em(1em = 영상 10px).
 */
export function D14VoiceParts() {
  return (
    <div className="d14v-parts">
      <VoicePlayback />
      <BarPart />
      <OrbPart />
      <BubblePart />
      <FounderPart />
    </div>
  )
}

// ── 대본 재생 무대 ─────────────────────────────────────────────────────────────
// 화면 자리(영상 720×637): 막대 가운데 y 2.7em, 말풍선 아래 끝 23.35em, 구슬 가운데 (35.93em, 31.62em) —
// 이 셋은 화면에 붙어 있어 카메라가 움직여도 그대로다(F347~F380 SALES로 넘어갈 때 고리 좌우 차 0.7px).
// 지도 쪽: SALES 허브 (36.2em, 42.5em), YOU 원 (36.2em, 45.8em). YOU는 SALES 오른쪽에 있어서 카메라가
// x로만 옮겨 간다(프레임마다 남은 거리 ×0.84 → τ 0.19초).
function VoicePlayback() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const { phase, turnIndex, speaker, text, typed, turn, view, playing, reduced, play, pause, replay, getLevel } =
    useVoiceScript(VOICE_SCRIPT, { loop: true, watch: sceneRef })
  const voiceOn = phase !== 'lead'
  const founder = view === 'founder'

  return (
    <section className="d14v-part d14v-part--play">
      <p className="d14v-part__name">
        <code>useVoiceScript()</code> 영상 대본 재생 — 8.4~22.7초를 그대로(끝나면 처음부터)
      </p>
      <div className="d14v-play">
        <div ref={sceneRef} className="d14v-play__scene">
          <div className={cx('d14v-play__world', founder && 'is-founder')}>
            <div className="d14v-play__dept" aria-hidden>
              <span className="d14v-play__hub">7</span>
              <span className="d14v-play__hub-name">SALES</span>
              <span className="d14v-play__hub-sub">conversations &amp; deals</span>
            </div>
            <div className="d14v-play__you">
              <FounderConstellation open={founder} />
            </div>
          </div>
          {/* 겹침 차례: 지도 < 구슬 그늘(지도 글씨도 어둡게 덮는다 — F330 "QUOTE") < 말풍선·꼬리표 < 막대 */}
          {voiceOn && (
            <>
              <VoiceOrb className="d14v-play__orb" speaker={speaker} getLevel={getLevel} />
              <SpeechBubble className="d14v-play__bubble" text={text} speaker={speaker} />
              <VoiceModeBar className="d14v-play__bar" tabs={VOICE_BAR_TABS} active="deals" />
            </>
          )}
        </div>
      </div>
      <div className="d14v-part__controls">
        <button type="button" onClick={playing ? pause : play} disabled={reduced}>
          {playing ? '멈춤' : '재생'}
        </button>
        <button type="button" onClick={replay} disabled={reduced}>
          처음부터
        </button>
        <span className="d14v-part__readout">
          {reduced
            ? '움직임 줄이기 — 멈춘 장면'
            : phase === 'lead'
              ? '음성 모드 전(SALES)'
              : `턴 ${turnIndex + 1}/${VOICE_SCRIPT.turns.length} · ${speaker === 'agent' ? 'Kronos' : '사용자'} · ${typed}/${turn?.text.length ?? 0}자 · ${founder ? 'YOU' : 'SALES'}`}
        </span>
      </div>
    </section>
  )
}

// ── 부품 하나씩 ────────────────────────────────────────────────────────────────
function BarPart() {
  const [active, setActive] = useState<string>('deals')
  const [escaped, setEscaped] = useState(0)
  return (
    <section className="d14v-part">
      <p className="d14v-part__name">
        <code>{'<VoiceModeBar tabs active onSelect onEsc>'}</code> 탭을 눌러 보세요
      </p>
      <div className="d14v-part__row">
        <figure>
          <div className="d14v-well d14v-well--bar">
            <VoiceModeBar
              tabs={VOICE_BAR_TABS}
              active={active}
              onSelect={setActive}
              onEsc={() => setEscaped((n) => n + 1)}
            />
          </div>
          <figcaption>
            active=&quot;{active}&quot; · ESC {escaped}번
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

function OrbPart() {
  const [level, setLevel] = useState(0.4)
  const shown = level.toFixed(2)
  const wells: { speaker: VoiceSpeaker | null; fixed?: boolean; caption: string }[] = [
    { speaker: 'you', caption: 'speaker="you" — 사용자, 스스로 출렁임' },
    { speaker: 'agent', caption: 'speaker="agent" — Kronos, 영상 출렁임' },
    { speaker: null, caption: 'speaker={null} — 숨쉬기(영상에 없음)' },
    { speaker: 'you', fixed: true, caption: `level={${shown}} — 바깥 값` },
    { speaker: 'agent', fixed: true, caption: `level={${shown}}` },
  ]
  return (
    <section className="d14v-part">
      <p className="d14v-part__name">
        <code>{'<VoiceOrb speaker level getLevel>'}</code>
        <label className="d14v-part__slider">
          level
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={level}
            onChange={(e) => setLevel(Number(e.currentTarget.value))}
          />
        </label>
      </p>
      <div className="d14v-part__row">
        {wells.map((w) => (
          <figure key={w.caption}>
            <div className="d14v-well d14v-well--orb">
              <VoiceOrb speaker={w.speaker} level={w.fixed ? level : undefined} />
            </div>
            <figcaption>{w.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

function BubblePart() {
  return (
    <section className="d14v-part">
      <p className="d14v-part__name">
        <code>{'<SpeechBubble text typed speaker tags>'}</code> 줄 수대로 위로 자란다
      </p>
      <div className="d14v-part__row">
        <figure>
          <div className="d14v-well d14v-well--bubble">
            <SpeechBubble text={ASK.text} speaker="you" />
          </div>
          <figcaption>speaker=&quot;you&quot; — F346</figcaption>
        </figure>
        <figure>
          <div className="d14v-well d14v-well--bubble">
            <SpeechBubble text={ANSWER.text} speaker="agent" />
          </div>
          <figcaption>speaker=&quot;agent&quot; 네 줄 — F635</figcaption>
        </figure>
        <figure>
          <div className="d14v-well d14v-well--bubble">
            <SpeechBubble text={ANSWER.text} typed={0} speaker="agent" />
          </div>
          <figcaption>typed={'{0}'} — 턴이 바뀐 첫 프레임(F653)</figcaption>
        </figure>
        <figure>
          <div className="d14v-well d14v-well--bubble">
            <SpeechBubble text={ANSWER.text} typed={55} speaker="agent" />
          </div>
          <figcaption>typed={'{55}'} — 두 줄로 넘어간 첫 프레임(F429)</figcaption>
        </figure>
      </div>
    </section>
  )
}

function FounderPart() {
  const [open, setOpen] = useState(true)
  const [round, setRound] = useState(0)
  return (
    <section className="d14v-part">
      <p className="d14v-part__name">
        <code>{'<FounderConstellation topics open center badge>'}</code>
        <button type="button" onClick={() => setOpen((v) => !v)}>
          {open ? '접기' : '펼치기'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            setRound((n) => n + 1)
          }}
        >
          다시 펼치기
        </button>
      </p>
      <div className="d14v-part__row">
        <figure>
          <div className="d14v-well d14v-well--founder">
            <div className="d14v-well__anchor" style={{ '--x': '50%', '--y': '52%' } as CSSProperties}>
              <FounderConstellation key={round} open={open} />
            </div>
          </div>
          <figcaption>open={String(open)} — 펼칠 때 0.32초에 YOU 자리에서 x로 미끄러진다(F636~F641)</figcaption>
        </figure>
      </div>
    </section>
  )
}

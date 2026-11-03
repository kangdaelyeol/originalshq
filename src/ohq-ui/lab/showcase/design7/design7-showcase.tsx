import { useEffect, useRef, useState } from 'react'
import { ShowcaseStage } from '../showcase-stage'
import { LiquidDropShape } from './liquid-drop'
import { LiquidEffectToggle } from './liquid-effect-toggle'
import { LiquidGlassBody } from './liquid-glass'
import { LiquidIndicator } from './liquid-indicator'
import { LiquidMenu } from './liquid-menu'
import {
  LIQUID_SCRIPT,
  LIQUID_SCRIPT_END,
  closePose,
  liquidGeometry,
  openPose,
  restPose,
  type LiquidEffect,
  type LiquidScriptStep,
} from './liquid-menu-data'
import { LiquidListIcon } from './liquid-menu-icons'
import { LIQUID_ICON_NAMES, LIQUID_MENU_ITEMS } from './liquid-menu-items'
import { LiquidScene } from './liquid-scene'

const GEO = liquidGeometry(LIQUID_MENU_ITEMS.length)

// 부품 견본 — 펼침·접힘 도중의 물 모양을 같은 함수로 멈춰 그린다(t = 누른 뒤 초)
const MORPH_STAGES = [
  { name: '접힘', pose: restPose(false, GEO) },
  { name: '펼침 0.07s — 알약이 뻗어 나옴', pose: openPose(0.07, GEO) },
  { name: '펼침 0.2s — 떨어지기 직전 목', pose: openPose(0.205, GEO) },
  { name: '펼침 끝', pose: restPose(true, GEO) },
  { name: '접힘 0.12s — 다시 붙어 버튼이 부풂', pose: closePose(0.12, GEO) },
  { name: '접힘 0.29s — 빨려 들며 가운데로', pose: closePose(0.29, GEO) },
]

/** Design 7 — sample/design7.mp4: 물처럼 펼쳐지는 햄버거 메뉴 */
export function Design7Showcase() {
  // 영상 첫 장면: 펼친 채 Profile, Bounce
  const [open, setOpen] = useState(true)
  const [value, setValue] = useState('profile')
  const [effect, setEffect] = useState<LiquidEffect>('bounce')
  const [run, setRun] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const list = timers.current
    return () => list.forEach((id) => window.clearTimeout(id))
  }, [])

  const stop = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current.length = 0
    setPlaying(false)
  }

  const apply = (step: LiquidScriptStep) => {
    if ('open' in step) setOpen(step.open)
    else if ('select' in step) setValue(step.select)
    else setEffect(step.effect)
  }

  // 영상 순서 다시 보기 — 메뉴를 새로 띄워(펼친 채 Profile) 영상과 같은 시각에 같은 조작을 한다
  const replay = () => {
    stop()
    setOpen(true)
    setValue('profile')
    setEffect('bounce')
    setRun((n) => n + 1)
    setPlaying(true)
    const lead = 400
    for (const step of LIQUID_SCRIPT) timers.current.push(window.setTimeout(() => apply(step), lead + step.at * 1000))
    timers.current.push(window.setTimeout(() => setPlaying(false), lead + LIQUID_SCRIPT_END * 1000))
  }

  // 사람이 만지면 다시 보기를 멈춘다
  const byHand =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      if (playing) stop()
      fn(v)
    }

  return (
    <ShowcaseStage
      title="Design 7 — 물처럼 펼쳐지는 햄버거 메뉴"
      note="sample/design7.mp4 · 둥근 버튼을 누르면 펼치고, 아이콘을 고르면 물방울이 떨어져요(Esc로 닫기, ←→로 이동)"
      className="showcase-stage--d7"
      actions={
        <button type="button" className="d7-replay" onClick={playing ? stop : replay}>
          {playing ? '멈추기' : '영상 순서 다시 보기'}
        </button>
      }
    >
      <LiquidScene>
        <div className="d7-scene__toggle">
          <LiquidEffectToggle value={effect} onChange={byHand(setEffect)} />
        </div>
        <LiquidMenu
          key={run}
          value={value}
          onChange={byHand(setValue)}
          open={open}
          onOpenChange={byHand(setOpen)}
          effect={effect}
        />
      </LiquidScene>

      <div className="d7-parts">
        <section className="d7-part">
          <p className="d7-part__name">
            <code>{'<LiquidGlassBody>'}</code> 물 모양 — 원·알약을 따로 흐려 더한 뒤 문턱(메타볼)
          </p>
          <div className="d7-part__row d7-part__row--glass">
            {MORPH_STAGES.map((s) => (
              <figure key={s.name}>
                <div className="d7-part__glass">
                  <LiquidGlassBody pose={s.pose} geo={GEO} className="d7-part__glass-svg" />
                </div>
                <figcaption>{s.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="d7-part">
          <p className="d7-part__name">
            <code>{'<LiquidIndicator>'}</code> 고른 항목 알약 · <code>{'<LiquidDropShape>'}</code> 물방울
          </p>
          <div className="d7-part__row d7-part__row--small">
            <figure>
              <LiquidIndicator className="d7-part__indicator" />
              <figcaption>멈춤 71×50.5</figcaption>
            </figure>
            <figure>
              <LiquidIndicator className="d7-part__indicator" stretch={0.13} />
              <figcaption>되돌아올 때 +13%</figcaption>
            </figure>
            <figure>
              <LiquidIndicator className="d7-part__indicator" stretch={0.28} />
              <figcaption>달릴 때 +28% · 세로 -18%</figcaption>
            </figure>
            <figure>
              <svg className="d7-part__drop" viewBox="-12 -16 24 32" aria-hidden>
                <LiquidDropShape />
              </svg>
              <figcaption>물방울</figcaption>
            </figure>
            <figure>
              <svg className="d7-part__drop" viewBox="-12 -16 24 32" aria-hidden>
                <g transform="scale(0.82 1.35)">
                  <LiquidDropShape />
                </g>
              </svg>
              <figcaption>떨어질 때</figcaption>
            </figure>
            <figure>
              <svg className="d7-part__drop" viewBox="-12 -16 24 32" aria-hidden>
                <g transform="scale(0.45)">
                  <LiquidDropShape />
                </g>
              </svg>
              <figcaption>Splash 작은 방울</figcaption>
            </figure>
          </div>
        </section>

        <section className="d7-part">
          <p className="d7-part__name">
            <code>{'<LiquidEffectToggle>'}</code> · 아이콘
          </p>
          <div className="d7-part__row d7-part__row--small">
            <figure>
              <LiquidEffectToggle value="bounce" onChange={() => {}} />
              <figcaption>bounce 고름</figcaption>
            </figure>
            <figure>
              <LiquidEffectToggle value="splash" onChange={() => {}} />
              <figcaption>splash 고름</figcaption>
            </figure>
            <figure className="d7-icon-tile">
              <span className="d7-icon-tile__face">
                <LiquidListIcon className="d7-icon-tile__list" />
              </span>
              <figcaption>
                <code>LiquidListIcon</code>
              </figcaption>
            </figure>
            {LIQUID_MENU_ITEMS.map(({ key, label, icon: Icon }) => (
              <figure key={key} className="d7-icon-tile">
                <span className="d7-icon-tile__face">
                  <Icon className="d7-icon-tile__icon" />
                </span>
                <figcaption>
                  <code>{LIQUID_ICON_NAMES[key]}</code>
                  <span>{label}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </ShowcaseStage>
  )
}

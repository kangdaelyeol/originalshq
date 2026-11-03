import { Play, Square } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '../../../components/button'
import { ShowcaseStage } from '../showcase-stage'
import { FocusBedIcon, FocusDotsIcon, FocusMoonIcon, FocusPersonIcon } from './focus-icons'
import { FOCUS_PILLS, REPLAY_START_VALUE } from './glass-data'
import { GlassPill } from './glass-pill'
import { GlassPillGroup, type GlassDemoState } from './glass-pill-group'
import { GlassPlate } from './glass-plate'
import { LiquidGlassScene } from './glass-scene'
import { PillGlow } from './pill-glow'
import { useGlassReplay } from './use-glass-replay'

const [SLEEP, DND, PERSONAL] = FOCUS_PILLS
const isDarkItem = (key: string) => FOCUS_PILLS.some((p) => p.key === key && p.dark)

// 견본 이름표 — 함수 이름(Icon.name)은 배포 빌드에서 줄어들어서 따로 적는다.
const ICONS = [
  { Icon: FocusBedIcon, name: 'FocusBedIcon' },
  { Icon: FocusMoonIcon, name: 'FocusMoonIcon' },
  { Icon: FocusPersonIcon, name: 'FocusPersonIcon' },
  { Icon: FocusDotsIcon, name: 'FocusDotsIcon' },
]

/** Design 6 — sample/design6.mp4: 유리 판 위에서 눌리면 액체가 차오르는 알약 버튼 */
export function Design6Showcase() {
  // 영상 첫 장면처럼 Personal이 켜진 밝은 무대에서 시작한다.
  const [value, setValue] = useState<string | null>(REPLAY_START_VALUE)
  const [dark, setDark] = useState(false)
  const [demo, setDemo] = useState<GlassDemoState | null>(null)

  // 켠 알약이 무대 밝기를 정한다(방해 금지 = 어둠). 끄기만 하면 밝기는 그대로 — 영상 F142~F165.
  const choose = (key: string | null) => {
    setValue(key)
    if (key) setDark(isDarkItem(key))
  }

  const replay = useGlassReplay({
    prepare: () => {
      setDemo({ hover: null, press: null })
      choose(REPLAY_START_VALUE)
    },
    // 다시 보기에선 밝기도 대본대로(영상의 어두워지는·밝아지는 프레임에 맞춰)
    apply: (step) => {
      setDemo((d) => ({
        hover: step.hover === undefined ? (d?.hover ?? null) : step.hover,
        press: step.press === undefined ? (d?.press ?? null) : step.press,
      }))
      if (step.value !== undefined) setValue(step.value)
      if (step.dark !== undefined) setDark(step.dark)
    },
    finish: () => setDemo(null),
  })

  return (
    <ShowcaseStage
      title="Design 6 — 액체 유리 알약 버튼"
      note="sample/design6.mp4 · 올리면 떠오르고, 누르면 액체가 차올라 빛나요(키보드 Tab·Space로도). 방해 금지는 무대를 어둡게"
      className="showcase-stage--d6"
      actions={
        <Button
          variant="ghost"
          size="sm"
          icon={replay.playing ? Square : Play}
          onClick={replay.playing ? replay.stop : replay.play}
        >
          {replay.playing ? '멈춤' : '영상대로 재생'}
        </Button>
      }
    >
      {/* 다시 보기 중에 무대를 누르면 멈추고 바로 손으로 만질 수 있게 */}
      <div onPointerDownCapture={replay.playing ? replay.stop : undefined}>
        <LiquidGlassScene dark={dark}>
          <GlassPillGroup value={value} onChange={choose} demo={demo} />
        </LiquidGlassScene>
      </div>

      <div className="d6-parts">
        <section className="d6-part">
          <p className="d6-part__name">
            <code>{'<GlassPill>'}</code> 상태
          </p>
          <div className="d6-part__row">
            <PartPill caption="기본">
              <GlassPill item={SLEEP} lit={false} hovered={false} pressed={false} />
            </PartPill>
            <PartPill caption="hovered — 떠오름 + 바닥 색 선">
              <GlassPill item={SLEEP} lit={false} hovered pressed={false} />
            </PartPill>
            <PartPill caption="pressed — 판 속으로 눌림">
              <GlassPill item={SLEEP} lit={false} hovered={false} pressed />
            </PartPill>
            <PartPill caption="lit · blue" glow={SLEEP.tone}>
              <GlassPill item={SLEEP} lit hovered={false} pressed={false} />
            </PartPill>
            <PartPill caption="lit · orange" glow={PERSONAL.tone}>
              <GlassPill item={PERSONAL} lit hovered={false} pressed={false} />
            </PartPill>
            <PartPill caption="lit · red(어두운 무대)" glow={DND.tone} dark>
              <GlassPill item={DND} lit hovered={false} pressed={false} />
            </PartPill>
          </div>
        </section>

        <section className="d6-part">
          <p className="d6-part__name">
            <code>{'<GlassPlate>'}</code> · <code>{'<PillGlow>'}</code> · <code>{'<LiquidGlassScene>'}</code>
          </p>
          <div className="d6-part__row">
            <PartPill caption="GlassPlate rows=1 — 밝은 무대">
              <span />
            </PartPill>
            <PartPill caption="GlassPlate rows=1 — 어두운 무대" dark>
              <span />
            </PartPill>
            <PartPill caption="PillGlow halo + bloom(알약 없이)" glow={DND.tone} dark>
              <span />
            </PartPill>
          </div>
        </section>

        <section className="d6-part">
          <p className="d6-part__name">아이콘</p>
          <div className="d6-part__row d6-part__row--icons">
            {ICONS.map(({ Icon, name }) => (
              <figure key={name} className="d6-icon-chip">
                <Icon className="d6-icon-chip__icon" />
                <figcaption>
                  <code>{name}</code>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </ShowcaseStage>
  )
}

interface PartPillProps {
  caption: string
  dark?: boolean
  /** 판 위 빛(halo·bloom)을 켤 색 */
  glow?: (typeof FOCUS_PILLS)[number]['tone']
  children: ReactNode
}

/** 견본 하나 — 알약 한 줄짜리 판 위에 놓아 무대 그대로 보여 준다 */
function PartPill({ caption, dark = false, glow, children }: PartPillProps) {
  return (
    <figure className="d6-part__item">
      <LiquidGlassScene dark={dark} className="d6-scene--part">
        <div className="d6-rig">
          <GlassPlate rows={1} />
          {glow && <PillGlow tone={glow} lit variant="halo" />}
          {children}
          {glow && <PillGlow tone={glow} lit variant="bloom" />}
        </div>
      </LiquidGlassScene>
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

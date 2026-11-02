import { Play, Square } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../ui/button'
import { ShowcaseStage } from '../showcase-stage'
import { CenterToggle } from './radial-center-toggle'
import { RadialPlusIcon } from './radial-icons'
import { LabelPill } from './radial-label'
import { RadialMenu } from './radial-menu'
import { RADIAL_ITEMS } from './radial-menu-data'
import { SatelliteButton } from './radial-satellite'
import { useRadialReplay } from './use-radial-replay'

const PEOPLE = RADIAL_ITEMS[2]

// 견본 이름표 — 함수 이름(Icon.name)은 배포 빌드에서 줄어들어서 따로 적는다.
const ICON_NAMES: Record<string, string> = {
  chats: 'RadialChatIcon',
  calls: 'RadialPhoneIcon',
  people: 'RadialUsersIcon',
  alerts: 'RadialBellIcon',
  aibot: 'RadialLoaderIcon',
  settings: 'RadialSettingsIcon',
}

/** Design 9 — sample/design9.mp4: 뉴모피즘 방사형(원형) 메뉴 */
export function Design9Showcase() {
  // 영상 가운데 장면처럼 열린 채, 아무것도 고르지 않은 상태로 시작한다(F75~F221).
  const [open, setOpen] = useState(true)
  const [value, setValue] = useState<string | null>(null)
  const replay = useRadialReplay({ setOpen, setValue })

  return (
    <ShowcaseStage
      title="Design 9 — 뉴모피즘 방사형 메뉴"
      note="sample/design9.mp4 · 가운데를 누르면 열리고 닫혀요. 올리면 이름표, 누르면 골라져요(키보드 Tab·화살표·Esc로도)"
      className="showcase-stage--d9"
      actions={
        <Button
          variant="ghost"
          size="sm"
          icon={replay.playing ? Square : Play}
          onClick={replay.playing ? replay.stop : () => replay.play(open)}
        >
          {replay.playing ? '멈춤' : '영상대로 재생'}
        </Button>
      }
    >
      {/* 다시 보기 중에 무대를 누르거나 키를 치면 멈추고 바로 손으로 만질 수 있게 */}
      <div
        className="d9-scene"
        onPointerDownCapture={replay.playing ? replay.stop : undefined}
        onKeyDownCapture={replay.playing ? replay.stop : undefined}
      >
        <RadialMenu open={open} onOpenChange={setOpen} value={value} onSelect={setValue} hoverKey={replay.hover} />
      </div>

      <div className="d9-parts">
        <section className="d9-part">
          <p className="d9-part__name">
            <code>{'<CenterToggle>'}</code> 여닫는 가운데 버튼
          </p>
          <div className="d9-part__row d9-part__row--center">
            <figure>
              <div className="d9-part__specimen" inert>
                <CenterToggle open={false} />
              </div>
              <figcaption>닫힘 — 청록 +</figcaption>
            </figure>
            <figure>
              <div className="d9-part__specimen" inert>
                <CenterToggle open={false} hovered />
              </div>
              <figcaption>hovered — 판이 떠오르고 아이콘 1.3배</figcaption>
            </figure>
            <figure>
              <div className="d9-part__specimen" inert>
                <CenterToggle open />
              </div>
              <figcaption>open — 뒤집혀 빨간 ×(그림자 왼아래)</figcaption>
            </figure>
            <figure>
              <div className="d9-part__specimen" inert>
                <CenterToggle open hovered />
              </div>
              <figcaption>open + hovered</figcaption>
            </figure>
          </div>
        </section>

        <section className="d9-part">
          <p className="d9-part__name">
            <code>{'<SatelliteButton>'}</code> 궤도 위 버튼 상태
          </p>
          <div className="d9-part__row d9-part__row--sat">
            <figure>
              <div className="d9-part__specimen" inert>
                <SatelliteButton item={PEOPLE} />
              </div>
              <figcaption>기본 — 볼록</figcaption>
            </figure>
            <figure>
              <div className="d9-part__specimen" inert>
                <SatelliteButton item={PEOPLE} hovered />
              </div>
              <figcaption>hovered — 아이콘 1.15배·청록</figcaption>
            </figure>
            <figure>
              <div className="d9-part__specimen" inert>
                <SatelliteButton item={PEOPLE} selected />
              </div>
              <figcaption>selected — 오목 + 청록 점</figcaption>
            </figure>
            <figure>
              <div className="d9-part__specimen" inert>
                <SatelliteButton item={PEOPLE} selected hovered />
              </div>
              <figcaption>selected + hovered</figcaption>
            </figure>
          </div>
        </section>

        <section className="d9-part">
          <p className="d9-part__name">
            <code>{'<LabelPill>'}</code> 이름표 · <code>RADIAL_ITEMS</code> 아이콘(Feather)
          </p>
          <div className="d9-part__row d9-part__row--items">
            {RADIAL_ITEMS.map(({ key, label, icon: Icon }) => (
              <figure key={key}>
                <div className="d9-part__specimen" inert>
                  <LabelPill text={label} />
                </div>
                <span className="d9-glyph">
                  <Icon />
                </span>
                <figcaption>
                  <code>{ICON_NAMES[key]}</code>
                </figcaption>
              </figure>
            ))}
            <figure>
              <div className="d9-part__specimen d9-part__specimen--blank" />
              <span className="d9-glyph d9-glyph--center">
                <RadialPlusIcon />
              </span>
              <figcaption>
                <code>RadialPlusIcon</code>
              </figcaption>
            </figure>
          </div>
        </section>
      </div>
    </ShowcaseStage>
  )
}

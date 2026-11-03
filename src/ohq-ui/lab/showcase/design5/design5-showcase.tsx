import { useState, type ReactNode } from 'react'
import { ShowcaseStage } from '../showcase-stage'
import { ThemeToggle3D } from './theme-toggle-3d'
import { D5_MEASURED } from './toggle-3d-data'
import { GlowWord, Toggle3DStage, ToggleKnob, ToggleSlot, ToggleSurface } from './toggle-3d-parts'

/** 진열 칸 하나 — 작은 3D 장면 + 부품 이름 */
function PartCard({ name, note, dark, children }: { name: string; note: string; dark: boolean; children: ReactNode }) {
  return (
    <figure className="d5-part">
      <div className="d5-part__view">
        <div className="d5-scene">
          <Toggle3DStage dark={dark}>{children}</Toggle3DStage>
        </div>
      </div>
      <figcaption>
        <p className="d5-part__name">
          <code>{name}</code> {note}
        </p>
      </figcaption>
    </figure>
  )
}

/** Design 5 — sample/design5.mp4: 판 홈 속을 미끄러지는 3D 다크/라이트 토글 */
export function Design5Showcase() {
  // 영상처럼 밝은 상태로 시작한다.
  const [dark, setDark] = useState(false)

  return (
    <ShowcaseStage
      title="Design 5 — 3D 다크/라이트 토글"
      note="sample/design5.mp4 · 슬롯이나 손잡이를 누르면 바뀌어요(Tab으로 옮긴 뒤 Space·Enter로도)"
      className="showcase-stage--d5"
    >
      <div className="d5-scene">
        <ThemeToggle3D checked={dark} onChange={setDark} />
      </div>

      <div className="d5-parts">
        <PartCard name="<ToggleSurface>" note="바닥판 · 밝음" dark={false}>
          <ToggleSurface />
        </PartCard>
        <PartCard name="<ToggleSurface>" note="바닥판 · 어두움(긴 그림자)" dark>
          <ToggleSurface />
        </PartCard>
        <PartCard name="<ToggleSlot>" note="슬롯 속 · 밝음(파랑 빛)" dark={false}>
          <ToggleSlot />
        </PartCard>
        <PartCard name="<ToggleSlot>" note="슬롯 속 · 어두움(주황 빛)" dark>
          <ToggleSlot />
        </PartCard>
        <PartCard name="<ToggleKnob>" note="손잡이 · 밝음" dark={false}>
          <ToggleKnob />
        </PartCard>
        <PartCard name="<ToggleKnob>" note="손잡이 · 어두움" dark>
          <ToggleKnob />
        </PartCard>
        <PartCard name="<GlowWord lit={false}>" note="꺼진 글자(바뀌는 0.5초 동안)" dark={false}>
          <ToggleSurface />
          <ToggleSlot>
            <GlowWord word="light" lit={false} />
          </ToggleSlot>
        </PartCard>
        <PartCard name="<ThemeToggle3D>" note="전체 · 어두움" dark>
          <ToggleSurface />
          <ToggleSlot />
          <ToggleKnob />
        </PartCard>

        <dl className="d5-measured">
          {D5_MEASURED.map((m) => (
            <div key={m.label}>
              <dt>{m.label}</dt>
              <dd>{m.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </ShowcaseStage>
  )
}

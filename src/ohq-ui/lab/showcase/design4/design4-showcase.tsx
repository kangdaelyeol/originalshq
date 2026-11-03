import { Play, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../components/button'
import { ShowcaseStage } from '../showcase-stage'
import { JELLY_LAYER_STEPS, JELLY_SCENES, JELLY_SKELETONS } from './jelly-parts'
import { JellyRopeDiagram } from './jelly-rope-diagram'
import { JellySlider, type JellySliderHandle } from './jelly-slider'
import { JellyStill } from './jelly-still'

/** Design 4 — sample/design4.mp4: 홈 속 주황 젤리가 늘고 솟는 슬라이더(WebGL 레이마칭) */
export function Design4Showcase() {
  const slider = useRef<JellySliderHandle>(null)
  const [value, setValue] = useState(48)
  const [playing, setPlaying] = useState(false)

  // 개발 서버에서만 — 영상 프레임과 나란히 비교하려고 캡처 스크립트가 부른다(seek: 영상 프레임 번호)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as Record<string, unknown>
    w.__d4Jelly = {
      seek: (frame: number) => slider.current?.seekDemo(frame),
      play: () => slider.current?.playDemo(),
      material: (m: Parameters<JellySliderHandle['setMaterial']>[0]) => slider.current?.setMaterial(m),
    }
    return () => {
      delete w.__d4Jelly
    }
  }, [])

  return (
    <ShowcaseStage
      title="Design 4 — 젤리 슬라이더"
      note={`sample/design4.mp4 · 끝(손잡이)을 잡고 끌거나 ←/→ 키로 조절해요 · 지금 ${value}%`}
      className="showcase-stage--d4"
      actions={
        <Button
          variant="ghost"
          size="sm"
          icon={playing ? Square : Play}
          onClick={() => (playing ? slider.current?.stopDemo() : slider.current?.playDemo())}
        >
          {playing ? '멈추기' : '영상 동작 다시 보기'}
        </Button>
      }
    >
      <JellySlider
        ref={slider}
        className="d4-scene"
        defaultValue={48}
        onChange={setValue}
        onDemoChange={setPlaying}
        label="젤리 슬라이더"
      />

      <div className="d4-parts">
        <section className="d4-part">
          <p className="d4-part__name">
            <code>{'<JellyStill frame>'}</code> 영상 장면 — 영상 프레임마다 되짚은 젤리 모양
          </p>
          <div className="d4-part__row">
            {JELLY_SCENES.map(({ frame, caption }) => (
              <figure key={frame}>
                <JellyStill frame={frame} label={caption} />
                <figcaption>{caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="d4-part">
          <p className="d4-part__name">
            <code>{'<JellyStill layers>'}</code> 부품 — 하나씩 더하기
          </p>
          <div className="d4-part__row">
            {JELLY_LAYER_STEPS.map(({ layers, caption, prop }) => (
              <figure key={prop}>
                <JellyStill frame={36} layers={layers} label={caption} />
                <figcaption>
                  <span>{caption}</span>
                  <code>{prop}</code>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="d4-part">
          <p className="d4-part__name">
            <code>{'<JellyRopeDiagram>'}</code> 뼈대 — 점 17개(<code>JellyRope</code>) · 이차 베지어 16개, 옆에서 본 모습
          </p>
          <div className="d4-part__row">
            {JELLY_SKELETONS.map(({ frame, caption }) => (
              <figure key={frame}>
                <JellyRopeDiagram frame={frame} label={caption} />
                <figcaption>{caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </ShowcaseStage>
  )
}

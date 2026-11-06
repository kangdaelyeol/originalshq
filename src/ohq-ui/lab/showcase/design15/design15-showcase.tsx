import { Play, RotateCcw, Square } from 'lucide-react'
import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { Button } from '../../../components/button'
import { ShowcaseStage } from '../showcase-stage'
import { D15Tour } from './d15-tour'
import { Design15Parts } from './design15-parts'
import { FernlyApp } from './fernly-app'
import { TourCaption, TourCursor } from './tour-overlay'
import { useReducedMotion } from './use-reduced-motion'

// 영상 글꼴(Plus Jakarta Sans) — 이 탭이 열려 있을 때만 불러온다. 못 불러오면 --font-sans로 그린다.
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'

function useSceneFont() {
  useEffect(() => {
    if (document.head.querySelector(`link[href="${FONT_HREF}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONT_HREF
    document.head.append(link)
    return () => link.remove()
  }, [])
}

/** Design 15 — sample/design15-pm.mp4: Fernly 프로젝트 관리 대시보드(앱 한 벌 + 영상 차례대로 둘러보기) */
export function Design15Showcase() {
  useSceneFont()
  const reduced = useReducedMotion()
  const frame = useRef<HTMLDivElement>(null)
  const camera = useRef<HTMLDivElement>(null)
  const cursor = useRef<HTMLDivElement>(null)
  const caption = useRef<HTMLDivElement>(null)
  const tour = useRef<D15Tour | null>(null)
  const [appKey, setAppKey] = useState(0)
  // 처음엔 저절로 둘러본다(움직임 줄이기면 꺼진 채) — 사람이 누르거나 키를 쓰면 멈추고 마음대로 써 본다
  const [tourOn, setTourOn] = useState<boolean | null>(null)
  const touring = tourOn ?? !reduced

  useEffect(() => {
    const f = frame.current
    const cam = camera.current
    const cur = cursor.current
    const cap = caption.current
    if (!f || !cam || !cur || !cap) return
    const t = new D15Tour({ frame: f, camera: cam, cursor: cur, caption: cap, reset: () => setAppKey((k) => k + 1) })
    tour.current = t
    return () => {
      t.dispose()
      tour.current = null
    }
  }, [])

  useEffect(() => {
    const t = tour.current
    if (!t) return
    if (touring) {
      if (!t.running) t.start()
    } else t.stop()
  }, [touring])

  const interrupt = (e: SyntheticEvent) => {
    if (e.nativeEvent.isTrusted && touring) setTourOn(false)
  }

  const replay = () => {
    tour.current?.start()
    setTourOn(true)
  }

  return (
    <ShowcaseStage
      title="Design 15 — 프로젝트 관리 대시보드"
      note="sample/design15-pm.mp4 · 처음엔 영상 차례(30초)대로 저절로 둘러봐요 — 화면을 누르면 멈추고 마음대로 써 볼 수 있어요(프로젝트 더하기·카드 끌기·팀 거르기·강조색 바꾸기)"
      className="showcase-stage--d15"
      actions={
        <>
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={replay}>
            처음부터 둘러보기
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={touring ? Square : Play}
            onClick={() => (touring ? setTourOn(false) : replay())}
          >
            {touring ? '멈추기' : '둘러보기'}
          </Button>
        </>
      }
    >
      <div className="d15-scene">
        <div
          ref={frame}
          className="d15-frame"
          onPointerDownCapture={interrupt}
          onKeyDownCapture={interrupt}
          onWheelCapture={interrupt}
        >
          <div ref={camera} className="d15-camera">
            <div className="d15-desk" aria-hidden />
            <div className="d15-window">
              <FernlyApp key={appKey} />
            </div>
            <TourCursor ref={cursor} />
          </div>
          <TourCaption ref={caption} />
        </div>
      </div>
      <Design15Parts />
    </ShowcaseStage>
  )
}

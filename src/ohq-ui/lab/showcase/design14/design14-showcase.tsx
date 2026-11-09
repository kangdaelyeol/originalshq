import { Mic, Play, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../components/button'
import { ShowcaseStage } from '../showcase-stage'
import { BrainScene, type BrainSceneHandle } from './brain-scene'
import { D14_MAP } from './design14-data'
import { Design14Parts } from './design14-parts'
import { useBrainTour } from './use-brain-tour'
import { useBrainVoice } from './use-brain-voice'
import { usePrefersReducedMotion } from './use-reduced-motion'
import { D14VoiceParts } from './voice/voice-parts-demo'

// 장면 글꼴(DM Sans) — 이 탭이 열려 있을 때만 불러온다. 못 불러오면 --font-sans로 그린다.
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap'

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

/** Design 14 — sample/design14-circle.mp4: 회사 두뇌 지도(부서·자리·카메라) + 음성 모드 */
export function Design14Showcase() {
  useSceneFont()
  const reduced = usePrefersReducedMotion()
  const scene = useRef<BrainSceneHandle>(null)
  const voice = useBrainVoice(scene)
  // 처음엔 저절로 둘러본다(움직임 줄이기 설정이면 꺼진 채) — 누르거나 키를 쓰거나 음성 모드에 들어가면 멈춘다
  const [tour, setTour] = useState<boolean | null>(null)
  const touring = (tour ?? !reduced) && !voice.on
  useBrainTour(scene, touring)

  const startVoice = () => {
    setTour(false)
    voice.enter()
  }

  return (
    <ShowcaseStage
      title="Design 14 — 회사 두뇌 지도"
      note="sample/design14-circle.mp4 · 부서를 누르거나 ← → 로 걸어 다니고, Esc나 빈 곳을 누르면 전체로 돌아와요 · 처음엔 저절로 둘러봐요 · 음성 모드는 위 단추나 SALES의 Head of Sales를 눌러요(ESC로 나와요)"
      className="showcase-stage--d14"
      actions={
        <>
          <Button variant="ghost" size="sm" icon={voice.on ? Square : Mic} onClick={voice.on ? voice.exit : startVoice}>
            {voice.on ? '음성 모드 끝내기' : '음성 모드'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={touring ? Square : Play}
            onClick={() => {
              if (voice.on) voice.exit()
              setTour(!touring)
            }}
          >
            {touring ? '둘러보기 멈추기' : '저절로 둘러보기'}
          </Button>
        </>
      }
    >
      <BrainScene
        ref={scene}
        map={D14_MAP}
        autoTour={touring}
        onAutoTourChange={setTour}
        onInteract={() => setTour(false)}
        onHeadSelect={(department) => {
          if (department !== 'sales') return false
          startVoice()
          return true
        }}
        {...voice.props}
      />
      <Design14Parts />
      <D14VoiceParts />
    </ShowcaseStage>
  )
}

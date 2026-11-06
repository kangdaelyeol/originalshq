import { useEffect, useEffectEvent, useRef } from 'react'
import { VOICE_EXIT_MS, type DepartmentId } from './design14-data'
import { SpeechBubble } from './voice/speech-bubble'
import { useVoiceScript } from './voice/use-voice-script'
import { VoiceOrb } from './voice/voice-orb'
import { VOICE_SCRIPT } from './voice/voice-script'

interface BrainVoiceScreenProps {
  /** 대본 화면이 바뀔 때 — 카메라를 그쪽으로(you = 창업자 화면) */
  onView: (target: 'you' | DepartmentId) => void
  /** 대본이 끝나고 마지막 장면을 VOICE_EXIT_MS 둔 뒤 */
  onDone: () => void
}

/**
 * 음성 모드 화면 층 — 영상 대본을 틀며 구슬·말풍선을 화면에 붙여 그린다(장면 BrainScene의 screen 칸).
 * 글자가 늘 때마다 이 층만 다시 그린다(지도·부품은 그대로). 붙을 때 대본 처음부터, 떼면 멈춘다.
 * 겹침: 지도 < 구슬(그늘이 지도 글씨까지 덮는다, F330 "QUOTE") < 말풍선·꼬리표 — 막대는 그 위 덮개 층.
 */
export function BrainVoiceScreen({ onView, onDone }: BrainVoiceScreenProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { phase, view, department, speaker, text, getLevel } = useVoiceScript(VOICE_SCRIPT, {
    withLead: false,
    watch: ref,
  })

  // 대본 화면 → 카메라(방위각만 돈다, 초점 밖 무리는 그 프레임에 사라진다 — t=11.567)
  const target = view === 'founder' ? 'you' : (department ?? 'sales')
  const turnTo = useEffectEvent(onView)
  useEffect(() => {
    turnTo(target)
  }, [target])

  // 끝나면 마지막 장면을 잠시 둔다 — 움직임 줄이기는 멈춘 한 장면이라 끝나지 않는다(Esc로 나온다)
  const finish = useEffectEvent(onDone)
  useEffect(() => {
    if (phase !== 'done') return
    const id = window.setTimeout(finish, VOICE_EXIT_MS)
    return () => window.clearTimeout(id)
  }, [phase])

  return (
    <div ref={ref} className="d14-voice-screen">
      <VoiceOrb className="d14-voice-orb" speaker={speaker} getLevel={getLevel} />
      <SpeechBubble className="d14-voice-bubble" text={text} speaker={speaker} />
    </div>
  )
}

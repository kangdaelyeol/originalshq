import { useEffect, useEffectEvent, useState, type RefObject } from 'react'
import type { BrainFocus, BrainSceneHandle, BrainSceneProps } from './brain-scene'
import { BrainVoiceScreen } from './brain-voice-screen'
import { FounderConstellation } from './voice/founder-constellation'
import { VoiceModeBar } from './voice/voice-mode-bar'
import { VOICE_BAR_TABS } from './voice/voice-script'

type VoiceSceneProps = Pick<
  BrainSceneProps,
  'mode' | 'statusBar' | 'overlay' | 'screen' | 'youSlot' | 'onEscape' | 'onFocusChange'
>

/**
 * 음성 모드를 지도 장면에 붙인다 — 켜면 영상 대본을 처음부터 틀고(BrainVoiceScreen), 카메라를 대본 화면
 * (YOU ↔ SALES)으로 돌린다. 막대는 덮개 층 위 가운데, 구슬·말풍선은 화면에 붙은 층, 창업자 별자리는 YOU 칸.
 * 막대 ESC·Esc 키·대본이 끝나고 2.2초 뒤에 지도(전체 보기, 위 줄)로 돌아온다.
 * 별자리는 지도에서도 YOU에 초점이면 펼쳐진다(지도가 YOU 원을 그리니 center={false} — 원은 하나).
 * 글자마다 다시 그리는 건 BrainVoiceScreen 안에서만 — 여기 상태는 켜고 끌 때·초점이 바뀔 때만 바뀐다.
 * 돌려주는 props를 BrainScene에 그대로 펼친다.
 */
export function useBrainVoice(scene: RefObject<BrainSceneHandle | null>) {
  const [on, setOn] = useState(false)
  const [focus, setFocus] = useState<BrainFocus>('overview')

  const enter = () => setOn(true)
  const exit = () => {
    setOn(false)
    scene.current?.focus('overview')
  }

  // Esc 키 — 초점이 장면 밖(위 단추 등)에 있어도 나온다. 장면이 이미 받았으면(preventDefault) 건너뛴다
  const onEscKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !e.defaultPrevented) exit()
  })
  useEffect(() => {
    if (!on) return
    window.addEventListener('keydown', onEscKey)
    return () => window.removeEventListener('keydown', onEscKey)
  }, [on])

  const constellation = <FounderConstellation open={focus === 'you'} center={false} />
  const props: VoiceSceneProps = on
    ? {
        mode: 'voice',
        statusBar: false,
        onEscape: exit,
        onFocusChange: setFocus,
        youSlot: constellation,
        screen: <BrainVoiceScreen onView={(target) => scene.current?.focus(target)} onDone={exit} />,
        overlay: <VoiceModeBar tabs={VOICE_BAR_TABS} active="deals" onEsc={exit} />,
      }
    : { onFocusChange: setFocus, youSlot: constellation }

  return { on, enter, exit, props }
}

import { Gauge, RotateCcw } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import photo from '../../../assets/showcase/design8/living-room.webp'
import { Button } from '../../ui/button'
import { ShowcaseStage } from '../showcase-stage'
import { Design8Parts } from './design8-parts'
import { GlassSidebar } from './glass-sidebar'

/** Design 8 — sample/design8.mp4: 거실 사진 위 유리 사이드바(접힘 독 확대 ↔ 펼침) */
export function Design8Showcase() {
  // 영상 첫 장면처럼 접힌 채, 대시보드가 골라진 채로 시작한다.
  const [expanded, setExpanded] = useState(false)
  const [value, setValue] = useState('dashboard')
  const [night, setNight] = useState(false)
  const [slow, setSlow] = useState(false)

  return (
    <ShowcaseStage
      title="Design 8 — 유리 사이드바"
      note="sample/design8.mp4 · 접힌 채로 아이콘 위를 지나가면 독처럼 커져요 · 흰 단추나 [ 키로 펼치고, 항목을 누르면 알약이 늘었다 줄며 옮겨 가요(Tab·⌘K도)"
      className="showcase-stage--d8"
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            icon={Gauge}
            className="d8-slow"
            aria-pressed={slow}
            onClick={() => setSlow((s) => !s)}
          >
            {slow ? '영상 속도' : '10배 느리게'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={() => {
              setExpanded(false)
              setValue('dashboard')
              setNight(false)
            }}
          >
            처음 상태
          </Button>
        </>
      }
    >
      <div className="d8-layout">
        <div className="d8-scene">
          <img className="d8-photo" src={photo} alt="" draggable={false} />
          {/* 야간 모드 — 사진만 어둡게(사이드바의 형제라 유리 흐림은 그대로) */}
          <motion.div
            className="d8-night"
            initial={false}
            animate={{ opacity: night ? 1 : 0 }}
            transition={{ duration: slow ? 4 : 0.4 }}
            aria-hidden="true"
          />
          <GlassSidebar
            expanded={expanded}
            onExpandedChange={setExpanded}
            value={value}
            onValueChange={setValue}
            nightMode={night}
            onNightModeChange={setNight}
            timeScale={slow ? 0.1 : 1}
          />
        </div>
        <Design8Parts />
      </div>
    </ShowcaseStage>
  )
}

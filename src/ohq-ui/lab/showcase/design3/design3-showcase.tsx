import { useRef, useState, type CSSProperties } from 'react'
import { SegmentedControl } from '../../../components/segmented-control'
import { ShowcaseStage } from '../showcase-stage'
import { COL_X, FRAME_H, FRAME_W, ROW_Y } from './board-layout'
import { BOARD_ROWS, type BoardIcon } from './icon-registry'
import type { AnimatedIconHandle } from './icon-types'

type PlayMode = 'loop' | 'hover'

// 영상의 선 굵기 — 1.37배 확대에서 2.2px 안팎(24 뷰박스로 1.65). 컴포넌트 기본값(2)보다 가늘다.
const VIDEO_STROKE = 1.65

const MODES: { value: PlayMode; label: string }[] = [
  { value: 'loop', label: '영상처럼 반복' },
  { value: 'hover', label: '올리면 재생' },
]

/** Design 3 — sample/design3.mp4: 검은 바탕에 움직이는 선 아이콘 150개(10칸 × 15줄) */
export function Design3Showcase() {
  const [mode, setMode] = useState<PlayMode>('loop')
  return (
    <ShowcaseStage
      title="Design 3"
      note="sample/design3.mp4 — Feather 아이콘 150개가 한 박자에 같이 움직인다. 아이콘마다 따로 import해서 쓸 수 있다."
      className="showcase-stage--d3"
      actions={<SegmentedControl ariaLabel="재생 방식" size="sm" options={MODES} value={mode} onChange={setMode} />}
    >
      <div className="d3-board">
        {BOARD_ROWS.map((row, r) =>
          row.map((icon, c) => <BoardCell key={`${r}-${c}`} icon={icon} x={COL_X[c]} y={ROW_Y[r]} loop={mode === 'loop'} />),
        )}
      </div>
    </ShowcaseStage>
  )
}

interface BoardCellProps {
  icon: BoardIcon
  x: number
  y: number
  loop: boolean
}

/** 칸 하나 — 영상 속 자리(%)에 놓고, 올리면 이름을 보여 준다(올리면 재생 모드에선 칸 전체가 hover 영역). */
function BoardCell({ icon, x, y, loop }: BoardCellProps) {
  const handle = useRef<AnimatedIconHandle>(null)
  const { Icon, name, lucide } = icon
  const label = lucide ? `${name} (lucide: ${lucide})` : name
  const place: CSSProperties = { left: `${(x / FRAME_W) * 100}%`, top: `${(y / FRAME_H) * 100}%` }
  return (
    <div
      className="d3-cell"
      style={place}
      title={label}
      onMouseEnter={() => {
        if (!loop) handle.current?.play()
      }}
    >
      <Icon ref={handle} className="d3-cell__icon" strokeWidth={VIDEO_STROKE} loop={loop} animateOnHover={false} aria-label={name} role="img" />
      <span className="d3-cell__name">{name}</span>
    </div>
  )
}

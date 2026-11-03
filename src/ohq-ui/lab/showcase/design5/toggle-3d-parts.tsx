import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../../../lib/cx'
import { knobSideFaces, slotEndWalls } from './toggle-3d-data'

// 3D 토글을 이루는 조각들. 모양·색·움직임은 _design5.scss가 하고, 여기서는 면을 늘어놓기만 한다.
// 조각은 모두 같은 3D 공간(<Toggle3DStage> 또는 <ThemeToggle3D>) 안에 있어야 원근·가림이 맞는다.

// 면 자리는 고정값이라 모듈을 읽을 때 한 번만 만든다.
const END_WALLS = slotEndWalls()
const KNOB_SIDES = knobSideFaces()

interface Toggle3DStageProps {
  /** 어두움 상태 — 손잡이 왼쪽, DARK에 불 */
  dark: boolean
  className?: string
  children: ReactNode
}

/**
 * 원근 카메라 + 기울인 바닥판 기준점(진열용, 누를 수 없음).
 * 상태 클래스(is-dark)가 붙는 곳이라 이 안의 조각이 다 같이 바뀐다. 누르는 토글은 <ThemeToggle3D>.
 */
export function Toggle3DStage({ dark, className, children }: Toggle3DStageProps) {
  return (
    <div className={cx('d5-toggle', 'd5-toggle--still', dark && 'is-dark', className)} aria-hidden>
      <span className="d5-world">{children}</span>
    </div>
  )
}

/** 바닥판 — 슬롯 자리가 뚫린 넓은 판 + 홈 모서리 빛 + 손잡이 그림자 */
export function ToggleSurface() {
  return (
    <span className="d5-plate">
      <span className="d5-rim" />
      <span className="d5-shade" />
    </span>
  )
}

/**
 * 움직임 흐림 — 손잡이가 빠르게 움직이는 동안 미끄러지는 방향(가로)으로만 번지게 한다.
 * 세 겹(펴기 · 흐리기 · 누르기)으로 감싸 가로 흐림만 남긴다. 멈춰 있으면 아무 일도 하지 않는다.
 */
export function MotionSmear({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cx('d5-mb', className)}>
      <span className="d5-mb__f">
        <span className="d5-mb__i">{children}</span>
      </span>
    </span>
  )
}

interface GlowWordProps {
  word: 'light' | 'dark'
  /** 불 켜짐을 고정(진열용) — 주지 않으면 토글 상태(--d5-lit)를 따른다 */
  lit?: boolean
}

/** 슬롯 바닥의 글자 — 꺼진 회색 글자 위에 빛나는 글자를 겹쳐 두고 불만 켜고 끈다 */
export function GlowWord({ word, lit }: GlowWordProps) {
  const text = word === 'light' ? 'LIGHT' : 'DARK'
  // 강제로 켤 때는 이 글자 쪽 값만 바꾼다(LIGHT는 0일 때, DARK는 1일 때 켜진다)
  const force = lit === undefined ? undefined : ({ '--d5-lit': (word === 'dark') === lit ? 1 : 0 } as CSSProperties)
  return (
    <span className={cx('d5-word', `d5-word--${word}`)} style={force}>
      <MotionSmear>
        <span className="d5-word__ink d5-word__ink--off">{text}</span>
      </MotionSmear>
      <MotionSmear className="d5-mb--on">
        <span className="d5-word__ink d5-word__ink--on">{text}</span>
      </MotionSmear>
    </span>
  )
}

/**
 * 슬롯 속 — 바닥(손잡이와 함께 미끄러지는 글자띠 포함)과 먼 쪽 벽·양 끝 반원 벽.
 * children을 주면 기본 글자 둘(LIGHT·DARK) 대신 그것을 글자띠에 싣는다.
 */
export function ToggleSlot({ children }: { children?: ReactNode }) {
  return (
    <span className="d5-slot">
      <span className="d5-floor">
        <span className="d5-strip">
          <span className="d5-strip__shade" />
          <span className="d5-strip__shade-dark" />
          <span className="d5-pool d5-pool--light" />
          <span className="d5-pool d5-pool--dark" />
          {children ?? (
            <>
              <GlowWord word="light" />
              <GlowWord word="dark" />
            </>
          )}
        </span>
      </span>
      <span className="d5-wall-far" />
      {END_WALLS.map((f) => (
        <span key={f.key} className="d5-wall-seg" style={f.style} />
      ))}
    </span>
  )
}

/** 손잡이 — 슬롯 바닥에 선 원기둥(옆면 조각 + 둥근 모서리 윗면) */
export function ToggleKnob() {
  return (
    <span className="d5-knob">
      {KNOB_SIDES.map((f) => (
        <span key={f.key} className="d5-knob__side" style={f.style} />
      ))}
      <span className="d5-knob__top">
        <MotionSmear>
          <span className="d5-knob__face">
            <span className="d5-knob__glint" />
          </span>
        </MotionSmear>
      </span>
    </span>
  )
}

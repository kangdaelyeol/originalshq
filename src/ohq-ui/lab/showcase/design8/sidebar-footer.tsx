import { ChevronsUpDown, Moon, Sun } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useRef } from 'react'
import { MemojiAvatar } from './memoji-avatar'
import { useD8Sidebar, useDockItem } from './sidebar-context'
import { D8_DOCK, D8_USER } from './sidebar-data'
import { slowSpring } from './sidebar-motion'

/** 야간 모드 스위치 모양 — 트랙 4.4×2.4em(흰색 15%), 손잡이 2em 흰 원(F169 x 450..494) */
export function NightSwitch({ on, timeScale = 1 }: { on: boolean; timeScale?: number }) {
  return (
    <span className="d8-switch" data-on={on || undefined} aria-hidden="true">
      <motion.span
        className="d8-switch__knob"
        initial={false}
        animate={{ x: on ? '2em' : '0em' }}
        transition={slowSpring({ stiffness: 520, damping: 36 }, timeScale)}
      />
    </span>
  )
}

/** 야간 모드 줄 — 해 아이콘·라벨·스위치. 접히면 해 아이콘만(독 확대에도 낀다) */
export function NightModeRow({ on, onChange }: { on: boolean; onChange?: (on: boolean) => void }) {
  const { expanded, labels, showTip, timeScale } = useD8Sidebar()
  const dock = useDockItem('night', D8_DOCK.grow.item, 4.8)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const dockRef = dock.ref
  const setRow = useCallback(
    (el: HTMLDivElement | null) => {
      rowRef.current = el
      dockRef(el)
    },
    [dockRef],
  )
  const tip = () => {
    if (!expanded && rowRef.current) showTip({ key: 'night', label: 'Night mode', anchor: 'panel', el: rowRef.current })
  }
  const Icon = on ? Moon : Sun

  return (
    <motion.div ref={setRow} className="d8-item d8-item--night" style={{ height: dock.height }}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Night mode"
        className="d8-item__btn"
        onClick={() => onChange?.(!on)}
        onPointerEnter={tip}
        onPointerLeave={() => showTip(null)}
        onFocus={tip}
        onBlur={() => showTip(null)}
      >
        <span className="d8-item__inner">
          <motion.span className="d8-item__icon" style={{ scale: dock.iconScale }}>
            <Icon className="d8-icon" aria-hidden="true" />
          </motion.span>
          <motion.span className="d8-item__label" style={{ opacity: labels }}>
            Night mode
          </motion.span>
          <motion.span className="d8-item__trail d8-item__trail--switch" style={{ opacity: labels }}>
            <NightSwitch on={on} timeScale={timeScale} />
          </motion.span>
        </span>
      </button>
    </motion.div>
  )
}

/**
 * 프로필 — 아바타 4.4em(밝은 테 + 초록 상태 점), 이름(600·16px)·메일(13.5px·흰색 55%), 위아래 화살표.
 * 접히면 아바타만 패널 가운데에 남는다(F1 y 988 · F169 y 1054, 바닥에서 3.7em).
 */
export function SidebarProfile() {
  const { labels } = useD8Sidebar()
  return (
    <div className="d8-profile">
      <span className="d8-avatar">
        <MemojiAvatar />
        <span className="d8-avatar__status" role="img" aria-label="온라인" />
      </span>
      <motion.span className="d8-profile__text" style={{ opacity: labels }}>
        <span className="d8-profile__name">{D8_USER.name}</span>
        <span className="d8-profile__mail">{D8_USER.email}</span>
      </motion.span>
      <motion.span className="d8-profile__more" style={{ opacity: labels }} aria-hidden="true">
        <ChevronsUpDown />
      </motion.span>
    </div>
  )
}

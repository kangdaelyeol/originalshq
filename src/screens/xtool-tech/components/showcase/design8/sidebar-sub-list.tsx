import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import { useD8Sidebar } from './sidebar-context'
import { D8_EXPAND, type D8SubItem } from './sidebar-data'
import { slowTween } from './sidebar-motion'

/**
 * 하위 메뉴(프로젝트) — 아이콘 아래로 내려오는 가는 줄기에서 둥글게 꺾인 가지가 줄마다 뻗고,
 * 색 점(0.8em 둥근 네모 + 번짐)과 라벨이 붙는다. 줄 4.1em·간격 0.2em(F169 y 735·778·821).
 * 펼칠 때 높이 0→자동(13.1em)이 패널 높이를 같이 키운다 — 시간은 D8_EXPAND.height.
 */
export function SidebarSubList({ items, open }: { items: readonly D8SubItem[]; open: boolean }) {
  const { notifyLayout, timeScale } = useD8Sidebar()
  return (
    <motion.div
      className="d8-sub"
      initial={false}
      animate={open ? { height: 'auto', marginTop: '0.2em' } : { height: 0, marginTop: '0em' }}
      transition={slowTween(D8_EXPAND.height, timeScale)}
      onUpdate={notifyLayout}
      aria-hidden={!open}
      inert={!open}
    >
      <span className="d8-sub__trunk" aria-hidden="true" />
      <ul className="d8-sub__list">
        {items.map((sub) => (
          <li key={sub.key} className="d8-sub__item">
            <button type="button" className="d8-sub__btn" tabIndex={open ? 0 : -1}>
              <span className="d8-sub__branch" aria-hidden="true" />
              <span className="d8-sub__dot" style={{ '--d8-dot': sub.color } as CSSProperties} aria-hidden="true" />
              <span className="d8-sub__label">{sub.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

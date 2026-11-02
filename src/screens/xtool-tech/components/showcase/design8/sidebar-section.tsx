import { motion } from 'motion/react'
import { useD8Sidebar } from './sidebar-context'

/**
 * 섹션 머리 — 펼치면 "MAIN"(대문자 11.5px·600·자간 2px, 흰색 50%), 접으면 같은 자리 가운데에
 * 짧은 구분선(2em×0.2em). 높이 3.75em, 이름 가운데는 위에서 2.25em(F169 y 356.5 · F1 y 423).
 */
export function SidebarSection({ id, label }: { id?: string; label: string }) {
  const { labels, rail } = useD8Sidebar()
  return (
    <div className="d8-section">
      <motion.span id={id} className="d8-section__label" style={{ opacity: labels }}>
        {label}
      </motion.span>
      <motion.span className="d8-section__rule" style={{ opacity: rail }} aria-hidden="true" />
    </div>
  )
}

import { ChevronLeft } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef } from 'react'
import { useD8Sidebar } from './sidebar-context'
import { D8_EXPAND, D8_TOGGLE_KEY } from './sidebar-data'
import { slowTween } from './sidebar-motion'

/**
 * 펼침/접힘 단추 — 패널 오른쪽 테두리에 가운데가 걸린 흰 원(지름 3.1em, 로고와 같은 높이) +
 * 반투명 흰 고리 0.5em. 갈매기(‹)는 접힘에서 180°였다가 펼치며 반시계로 0°가 된다(F75~F80).
 * 올리면 1.1배(F68), 누르면 0.9배(F71~F74).
 */
export function SidebarToggle({ controls, onToggle }: { controls?: string; onToggle: () => void }) {
  const { expanded, showTip, timeScale } = useD8Sidebar()
  const ref = useRef<HTMLButtonElement | null>(null)
  const tip = (willExpand = expanded) => {
    if (ref.current) {
      showTip({
        key: 'toggle',
        label: willExpand ? 'Collapse' : 'Expand',
        chip: D8_TOGGLE_KEY,
        anchor: 'toggle',
        el: ref.current,
      })
    }
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      className="d8-toggle"
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={expanded ? '사이드바 접기' : '사이드바 펼치기'}
      aria-keyshortcuts={D8_TOGGLE_KEY}
      onClick={() => {
        onToggle()
        // 커서가 단추 위에 그대로 있으니 툴팁 글자를 바뀐 상태로(Expand → Collapse, F75)
        tip(!expanded)
      }}
      onPointerEnter={() => tip()}
      onPointerLeave={() => showTip(null)}
      onFocus={() => tip()}
      onBlur={() => showTip(null)}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      transition={slowTween({ duration: 0.1, ease: 'easeOut' }, timeScale)}
    >
      <motion.span
        className="d8-toggle__icon"
        initial={false}
        animate={{ rotate: expanded ? 0 : 180 }}
        transition={slowTween(D8_EXPAND.width, timeScale)}
      >
        <ChevronLeft aria-hidden="true" />
      </motion.span>
    </motion.button>
  )
}

import { Search } from 'lucide-react'
import { motion, useTransform } from 'motion/react'
import { useCallback, useRef, useState, type Ref } from 'react'
import { useD8Sidebar, useDockItem } from './sidebar-context'
import { D8_DOCK } from './sidebar-data'

/**
 * 검색 칸 — 펼치면 어두운 알약(패널 안쪽 1.6em, 높이 4.5em, F169 y 278..323) 안에 돋보기·
 * "Search pages"·⌘K. 접으면 돋보기만 남고(칸 바탕 없음, F1), 누르면 펼치면서 입력칸에 커서를 둔다.
 */
export function SidebarSearch({ inputRef, onOpen }: { inputRef?: Ref<HTMLInputElement>; onOpen?: () => void }) {
  const { expanded, labels, rail, showTip } = useD8Sidebar()
  const dock = useDockItem('search', D8_DOCK.grow.search, 4.5)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const dockRef = dock.ref
  const setBox = useCallback(
    (el: HTMLDivElement | null) => {
      boxRef.current = el
      dockRef(el)
    },
    [dockRef],
  )
  // 칸 바탕은 접힘 장식과 반대로 — 펼칠 때 바로 생기고 접을 때 끝에 사라진다
  const field = useTransform(rail, (r) => 1 - r)
  const [query, setQuery] = useState('')

  const tip = () => {
    if (!expanded && boxRef.current) {
      showTip({ key: 'search', label: 'Search', chip: '⌘K', anchor: 'panel', el: boxRef.current })
    }
  }

  return (
    <motion.div ref={setBox} className="d8-search" style={{ height: dock.height }}>
      <div className="d8-search__field">
        <motion.span className="d8-search__bg" style={{ opacity: field }} aria-hidden="true" />
        <span className="d8-search__inner">
          <motion.span className="d8-search__icon" style={{ scale: dock.iconScale }}>
            <Search aria-hidden="true" />
          </motion.span>
          <input
            ref={inputRef}
            className="d8-search__input"
            type="text"
            placeholder="Search pages"
            aria-label="Search pages"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            tabIndex={expanded ? 0 : -1}
          />
          <motion.kbd className="d8-kbd" style={{ opacity: labels }} aria-hidden="true">
            ⌘K
          </motion.kbd>
        </span>
        {!expanded && (
          <button
            type="button"
            className="d8-search__open"
            aria-label="Search pages (⌘K)"
            aria-keyshortcuts="Meta+K"
            onClick={onOpen}
            onPointerEnter={tip}
            onPointerLeave={() => showTip(null)}
            onFocus={tip}
            onBlur={() => showTip(null)}
          />
        )}
      </div>
    </motion.div>
  )
}

import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import type { AttentionTile } from '../../data/attention'
import { cx } from '../../lib/cx'
import { cardEnter } from '../../lib/motion'
import { xtPath } from '../../paths'

/** 챙겨야 할 것 — 한 줄 요약 카드들. 누르면 그 보드로 간다. 0건이면 흐리게. */
export function AttentionRow({ tiles, loading }: { tiles: AttentionTile[]; loading: boolean }) {
  return (
    <section className="attention" aria-label="챙겨야 할 것">
      <h2 className="king-section__title">
        챙겨야 할 것
      </h2>
      <div className="attention__grid">
        {tiles.map((tile) => (
          <motion.div key={tile.id} variants={cardEnter}>
            <Link
              to={xtPath(`/boards/${tile.slug}`)}
              className={cx('glass', 'attention__tile', tile.count > 0 && `is-${tile.tone}`, tile.count === 0 && 'is-zero')}
              title={tile.examples.length ? tile.examples.join('\n') : undefined}
            >
              <span className="attention__label">{tile.label}</span>
              <strong className="attention__count">{loading ? '…' : tile.count}</strong>
              <span className="attention__caption">{tile.caption}</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

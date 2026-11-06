import { Avatar } from './avatar'
import { cssVars } from './d15-format'

/** Activity(F600 아래, 일부만 보임) — 20주 × 7일 칸, 세기 0~4는 강조색 옅은 → 짙은 */
export function ActivityHeatmap({ levels, index = 6 }: { levels: readonly number[]; index?: number }) {
  return (
    <section className="d15-card d15-heat d15-rise" style={cssVars({ '--i': index })}>
      <header className="d15-card__head">
        <div>
          <h3 className="d15-card__title">Activity</h3>
          <p className="d15-card__sub">Commits, comments and status changes, last 20 weeks</p>
        </div>
        <p className="d15-heat__scale">
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <i key={l} className={`is-l${l}`} />
          ))}
          More
        </p>
      </header>
      <div className="d15-heat__grid">
        {levels.map((l, i) => (
          <i key={i} className={`is-l${l}`} />
        ))}
      </div>
    </section>
  )
}

/** Top contributors(F600 오른쪽 아래) — 머리글자·이름·막대·숫자 */
export function TopContributors({
  rows,
  index = 7,
}: {
  rows: readonly { initials: string; name: string; count: number }[]
  index?: number
}) {
  const max = Math.max(...rows.map((r) => r.count))
  return (
    <section className="d15-card d15-top d15-rise" style={cssVars({ '--i': index })}>
      <h3 className="d15-card__title">Top contributors</h3>
      <ul className="d15-top__list">
        {rows.map((r) => (
          <li key={r.name}>
            <Avatar initials={r.initials} />
            <span className="d15-top__who">
              <b>{r.name}</b>
              <span className="d15-top__bar">
                <i style={{ width: `${(r.count / max) * 100}%` }} />
              </span>
            </span>
            <span className="d15-top__count">{r.count}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

import { Plus } from 'lucide-react'
import { cx } from '../../../lib/cx'
import { cssVars } from './d15-format'
import { ProjectIcon } from './d15-icons'
import type { D15Project } from './design15-data'

interface ProjectListProps {
  projects: readonly (D15Project & { fresh?: boolean })[]
  onNew?: () => void
  index?: number
}

/**
 * Project 목록(F205 x533~647, 줄 간격 18.2px) — 아이콘·이름·"Due date". 새로 더한 줄(fresh)은 오른쪽 0.6em에서
 * 미끄러져 들어온다(F86.5~F94 ease-out 0.27초).
 */
export function ProjectList({ projects, onNew, index = 6 }: ProjectListProps) {
  return (
    <section className="d15-card d15-projects d15-rise" style={cssVars({ '--i': index })}>
      <header className="d15-card__head">
        <h3 className="d15-card__title">Project</h3>
        <button type="button" className="d15-btn d15-btn--ghost d15-btn--xs" onClick={onNew} data-tour="project-new">
          <Plus aria-hidden strokeWidth={2.4} />
          New
        </button>
      </header>
      <ul className="d15-projects__list">
        {projects.map((p) => (
          <li key={p.id} className={cx('d15-projects__row', p.fresh && 'is-fresh')}>
            <ProjectIcon icon={p.icon} />
            <span className="d15-projects__name">{p.name}</span>
            <span className="d15-projects__due">Due date: {p.due}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

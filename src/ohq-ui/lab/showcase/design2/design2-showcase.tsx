import { ShowcaseStage } from '../showcase-stage'
import { LOADER_GROUPS } from './loaders'

/**
 * Design 2 — sample/design2.mp4 의 로더 56개. 판·칸 배치는 영상 그대로(700 기준 단위 --d2-u 로 늘이고 줄인다),
 * 칸에 마우스를 올리면 그 로더의 컴포넌트 이름이 보인다. 모두 같은 순간에 마운트돼 영상처럼 박자가 맞는다.
 */
export function Design2Showcase() {
  return (
    <ShowcaseStage
      title="Design 2"
      note="sample/design2.mp4 · 로더 56개 — 칸에 마우스를 올리면 컴포넌트 이름"
      className="showcase-stage--d2"
    >
      <div className="d2-board">
        {LOADER_GROUPS.map((group) => (
          <section key={group.label} className="d2-group">
            <h3 className="d2-group__label">{group.label}</h3>
            <ul className="d2-group__grid">
              {group.items.map(({ name, Component }) => (
                <li key={name} className="d2-tile" title={name}>
                  <Component className="d2-tile__loader" />
                  <span className="d2-tile__name">{name}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ShowcaseStage>
  )
}

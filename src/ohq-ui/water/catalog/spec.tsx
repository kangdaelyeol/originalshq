import { Component, type ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface WaterSectionProps {
  title: string
  note?: ReactNode
  children: ReactNode
}

/** 카탈로그 묶음 — 제목 + 견본 격자 */
export function WaterSection({ title, note, children }: WaterSectionProps) {
  return (
    <section className="water-section">
      <header className="water-section__head">
        <h2 className="water-section__title">{title}</h2>
        {note && <span className="water-section__note">{note}</span>}
      </header>
      <div className="water-section__grid">{children}</div>
    </section>
  )
}

interface WaterSpecProps {
  /** 부품 이름(예: "<WaterButton>") */
  name: string
  note?: ReactNode
  /** 한 줄을 다 쓴다(표·차트처럼 넓은 견본) */
  wide?: boolean
  /** 캡처·검사용 이름(data-spec) — 예: "segmented" */
  spec?: string
  children: ReactNode
}

/** 부품 견본 하나 — 이름 알약 + 설명 + 견본 */
export function WaterSpec({ name, note, wide, spec, children }: WaterSpecProps) {
  return (
    <div className={cx('water-spec', wide && 'water-spec--wide')} data-spec={spec}>
      <div className="water-spec__name">
        <code>{name}</code>
        {note && <span>{note}</span>}
      </div>
      <div className="water-spec__body">{children}</div>
    </div>
  )
}

interface BoundaryState {
  error: Error | null
}

/** 묶음 하나가 터져도 카탈로그 전체가 멈추지 않게 — 오류를 그 자리에 적는다 */
export class WaterSectionBoundary extends Component<{ name: string; children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(`[물 카탈로그] ${this.props.name} 묶음 오류:`, error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <section className="water-section">
        <header className="water-section__head">
          <h2 className="water-section__title">{this.props.name}</h2>
          <span className="water-section__note">그리다 멈췄어요: {this.state.error.message}</span>
        </header>
      </section>
    )
  }
}

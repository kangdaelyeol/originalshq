import type { ReactNode } from 'react'

interface PageHeadProps {
  title: string
  sub: string
  /** 오른쪽 단추들 */
  actions?: ReactNode
}

/** 쪽 머리(F205 "Dashboard" x171 y56~70) — 제목·한 줄 설명·오른쪽 단추. 카드보다 한 박자 먼저 0.3em 떠오른다(F860.5) */
export function PageHead({ title, sub, actions }: PageHeadProps) {
  return (
    <header className="d15-head">
      <div className="d15-head__text">
        <h2 className="d15-head__title">{title}</h2>
        <p className="d15-head__sub">{sub}</p>
      </div>
      {actions && <div className="d15-head__actions">{actions}</div>}
    </header>
  )
}

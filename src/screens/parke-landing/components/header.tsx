import { ArrowUpRight } from 'lucide-react'

interface HeaderProps {
  pastHero: boolean
  openReserve: () => void
}

export const Header = (props: HeaderProps) => {
  const { pastHero, openReserve } = props
  return (
    <header className={`pf-header ${pastHero ? 'is-visible' : ''}`}>
      <a href="#top" className="pf-brand">
        Parké<span>by originals</span>
      </a>
      <nav aria-label="페이지 탐색">
        <button className="pf-reserve-nav" onClick={openReserve}>
          지금 바로 예약하기
          <ArrowUpRight size={15} />
        </button>
      </nav>
    </header>
  )
}

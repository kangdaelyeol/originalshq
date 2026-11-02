import { LiquidTabButton } from './liquid-tab-button'
import { LIQUID_TABS, type LiquidTabItem } from './liquid-tab-data'

interface LiquidTabBarProps {
  value: string
  onChange: (key: string) => void
  items?: readonly LiquidTabItem[]
  ariaLabel?: string
}

/**
 * 뉴모피즘 하단 탭 바(Design 1) — 바탕과 같은 색의 판이 그림자만으로 떠 있고, 버튼마다 자기 색의
 * 물이 차오른다. 크기는 글자 크기(em)를 따른다: 1em = 영상의 10px, 기본 바 폭 60.6em.
 */
export function LiquidTabBar({ value, onChange, items = LIQUID_TABS, ariaLabel = '하단 탭' }: LiquidTabBarProps) {
  return (
    <nav className="d1-bar" aria-label={ariaLabel}>
      {items.map((item) => (
        <LiquidTabButton
          key={item.key}
          item={item}
          selected={item.key === value}
          onSelect={() => onChange(item.key)}
        />
      ))}
    </nav>
  )
}

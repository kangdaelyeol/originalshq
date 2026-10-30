import '../styles/header.scss'
import {
  GlassHeader,
  Segmented,
  ThemePicker,
  type GlassThemeId,
} from '@/components/glass'

/** 화면 맨 위 줄 — 왼쪽 로고·이름, 가운데 보기 단위 탭(전체 요약·캠페인·광고셋
 * …, 유리 알약 — 바꾸면 알약이 미끄러져 간다), 오른쪽 테마 고르기. 틀(위에
 * 붙음·배경 빛·세 칸)은 GlassHeader가 그린다. 어느 탭이 열려 있는지는
 * 부모(screens/cmip)가 넘겨준다. */
export const Header = <T extends string>({
  tabs,
  tab,
  onSelectTab,
  theme,
  onSelectTheme,
}: {
  /** 보이는 탭 — { 탭 id: 이름 }. */
  tabs: Record<T, string>
  tab: T
  onSelectTab: (tab: T) => void
  theme: GlassThemeId
  onSelectTheme: (theme: GlassThemeId) => void
}) => (
  <GlassHeader
    className="cmip-header"
    start={
      <div className="cmip-header__brand">
        <img
          src="https://framerusercontent.com/images/tuTnWS8IWm4eabExSlzNTTtkeQk.png"
          alt="CYANINT"
          className="cmip-header__logo"
        />
        <div className="cmip-header__titles">
          <span className="cmip-header__title">CMIP</span>
          <span className="cmip-header__subtitle">
            Cyan International Marketing Intelligence &amp; Platform
          </span>
        </div>
      </div>
    }
    center={
      <nav className="cmip-header__tabs" aria-label="보기 단위">
        <Segmented
          options={tabs}
          value={tab}
          onChange={onSelectTab}
          label="보기 단위"
          size="md"
        />
      </nav>
    }
    end={<ThemePicker value={theme} onChange={onSelectTheme} />}
  />
)

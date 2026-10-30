import '@/screens/xtool-lead-manager/styles/header.scss'
import {
  GlassHeader,
  Segmented,
  ThemePicker,
  type GlassThemeId,
} from '@/components/glass'
import {
  PAGE_TABS,
  type PageTab,
} from '@/screens/xtool-lead-manager/view-model/use-page-tab-view-model'

// 최상위 탭 이름 — Segmented가 받는 { id: 이름 } 모양.
const TAB_LABEL = Object.fromEntries(
  PAGE_TABS.map((each) => [each.id, each.label]),
) as Record<PageTab, string>

/** 화면 맨 위 줄 — 로고, 가운데 최상위 탭(유리 알약 — 탭을 바꾸면 알약이
 * 미끄러져 간다), 오른쪽 테마 고르기와 회사 로고. 어느 탭이 열려 있는지는 부모
 * (pages/xtool-page)가 넘겨준다. */
export const Header = ({
  tab,
  onSelectTab,
  theme,
  onSelectTheme,
}: {
  tab: PageTab
  onSelectTab: (tab: PageTab) => void
  theme: GlassThemeId
  onSelectTheme: (theme: GlassThemeId) => void
}) => {
  return (
    <GlassHeader
      className="xtool-header"
      start={
        <div className="title-box">
          <img
            src="https://www.xtool.co.kr/web/upload/goodymall/kr/main/LOGO_1.png"
            alt="xtool logo"
            className="xtool-logo"
          />
          <span className="title">Lead manager</span>
        </div>
      }
      center={
        <nav aria-label="화면">
          <Segmented
            options={TAB_LABEL}
            value={tab}
            onChange={onSelectTab}
            label="화면"
            size="md"
          />
        </nav>
      }
      end={
        <>
          <ThemePicker value={theme} onChange={onSelectTheme} />
          <div className="enterprise-logo-badge">
            <img
              src="https://framerusercontent.com/images/tuTnWS8IWm4eabExSlzNTTtkeQk.png"
              alt="enterprise logo"
              className="enterprise-logo"
            />
          </div>
        </>
      }
    />
  )
}

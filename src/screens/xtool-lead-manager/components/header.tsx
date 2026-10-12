import '@/screens/xtool-lead-manager/styles/header.scss'
import {
  PAGE_TABS,
  type PageTab,
} from '@/screens/xtool-lead-manager/view-model/use-page-tab-view-model'

/** 화면 맨 위 줄 — 로고 옆에 최상위 탭(리드 / Monday 고객)을 둔다. 어느 탭이
 * 열려 있는지는 부모(pages/xtool-page)가 넘겨준다. */
export const Header = ({
  tab,
  onSelectTab,
}: {
  tab: PageTab
  onSelectTab: (tab: PageTab) => void
}) => {
  return (
    <div className="xtool-header">
      <div className="wrapper">
        <div className="header-left">
          <div className="title-box">
            <img
              src="https://www.xtool.co.kr/web/upload/goodymall/kr/main/LOGO_1.png"
              alt="xtool logo"
              className="xtool-logo"
            />
            <span className="title">Lead manager</span>
          </div>
          <nav className="page-tabs" aria-label="데이터 출처">
            {PAGE_TABS.map((each) => (
              <button
                key={each.id}
                type="button"
                className={['page-tab', each.id === tab ? 'active' : '']
                  .join(' ')
                  .trim()}
                aria-current={each.id === tab ? 'page' : undefined}
                onClick={() => onSelectTab(each.id)}
              >
                {each.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="enterprise-logo-badge">
          <img
            src="https://framerusercontent.com/images/tuTnWS8IWm4eabExSlzNTTtkeQk.png"
            alt="enterprise logo"
            className="enterprise-logo"
          />
        </div>
      </div>
    </div>
  )
}

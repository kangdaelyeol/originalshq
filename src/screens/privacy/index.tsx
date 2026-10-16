import { Link } from 'react-router-dom'
import { useScrollToTop } from '@/hooks'
import { Arrow, PrivacyLayout } from './components'
import { APPS, DOC_TITLES, DOC_TYPES, docPath } from './constants'
import type { AppName } from './types'
import './styles.scss'

/** /privacy — 앱별로 약관·방침 목록을 보여준다. 각 항목은 문서 페이지로 가는
 * 링크다(예전에는 같은 화면에 모달로 띄웠다). */
export default function Privacy() {
  useScrollToTop()

  return (
    <PrivacyLayout>
      <title>개인정보 처리방침 | Originals</title>
      <div className="privacy-wrapper">
        <h1 className="privacy-title">개인정보 처리방침</h1>
        <div className="privacy-items">
          {(Object.keys(APPS) as AppName[]).map((appName) => {
            const app = APPS[appName]
            return (
              <section className="privacy-item" key={appName}>
                <div className="item-top">
                  <div className="item-box">
                    <img src={app.icon} alt={`${app.name} 아이콘`} />
                  </div>
                  <div className="desc-box">
                    <h2 className="desc-title">{app.name}</h2>
                    <div className="desc-subtitle">{app.subtitle}</div>
                  </div>
                </div>
                <nav className="privacy-box" aria-label={`${app.name} 문서`}>
                  {DOC_TYPES.map((docType) => (
                    <Link
                      key={docType}
                      className="privacy-term"
                      to={docPath(appName, docType)}
                    >
                      {DOC_TITLES[docType]} <Arrow size={16} />
                    </Link>
                  ))}
                </nav>
              </section>
            )
          })}
        </div>
      </div>
    </PrivacyLayout>
  )
}

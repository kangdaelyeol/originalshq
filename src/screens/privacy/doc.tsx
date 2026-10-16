import { Link, Navigate, NavLink, useParams } from 'react-router-dom'
import { useScrollToTop } from '@/hooks'
import { PrivacyLayout } from './components'
import {
  APPS,
  DOC_TITLES,
  DOC_TYPES,
  docPath,
  isAppName,
  isDocType,
} from './constants'
import './styles.scss'
import './doc.scss'

/**
 * /privacy/:appName/:docType — 문서 하나를 한 페이지로 보여준다.
 *
 * 구글 개발자 콘솔·앱 스토어에 등록하려면 문서마다 바로 열리는 주소가
 * 필요해서, 목록 화면의 모달이 아니라 독립된 페이지로 만들었다. 같은 앱의
 * 다른 문서는 위쪽 탭으로 오간다. 없는 앱·문서 주소는 목록으로 돌려보낸다.
 */
export default function PrivacyDoc() {
  const { appName, docType } = useParams()
  useScrollToTop()

  if (!isAppName(appName) || !isDocType(docType)) {
    return <Navigate to="/privacy" replace />
  }

  const app = APPS[appName]
  const title = DOC_TITLES[docType]

  return (
    <PrivacyLayout>
      <title>{`${title} - ${app.name} | Originals`}</title>
      <article className="privacy-doc">
        <Link className="privacy-doc-back" to="/privacy">
          ← 개인정보 처리방침 목록
        </Link>

        <header className="privacy-doc-header">
          <div className="privacy-doc-app">
            <img src={app.icon} alt="" />
            <span>{app.name}</span>
          </div>
          <h1>{title}</h1>
          <p className="privacy-doc-date">시행일: {app.effectiveDate}</p>
        </header>

        <nav className="privacy-doc-tabs" aria-label={`${app.name} 문서`}>
          {DOC_TYPES.map((each) => (
            <NavLink
              key={each}
              to={docPath(appName, each)}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {DOC_TITLES[each]}
            </NavLink>
          ))}
        </nav>

        <div className="privacy-doc-body">{app.docs[docType]}</div>
      </article>
    </PrivacyLayout>
  )
}

import { PARKE_DOCS } from '../../doc-contents/parke'
import type { AppDocs, AppName, DocType } from '../../types'
import './styles.scss'

interface Props {
  appName: Exclude<AppName, null>
  docType: Exclude<DocType, null>
  handleClose: () => void
}

const DOC_TITLES: Record<Exclude<DocType, null>, string> = {
  privacy: '개인정보 처리방침',
  terms: '이용 약관',
  consent: '개인정보수집 및 이용 동의서',
  'consent-third': '개인정보 제3자 제공 동의서',
}

const APP_DOCS: Record<Exclude<AppName, null>, AppDocs> = {
  parke: PARKE_DOCS,
}
export default function PrivacyModal({ appName, docType, handleClose }: Props) {
  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{DOC_TITLES[docType]}</h2>
          <button className="modal-close" onClick={handleClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M15 5L5 15M5 5l10 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="modal-body">{APP_DOCS[appName][docType]}</div>
        <div className="modal-footer">
          <span className="modal-date">시행일: 2026년 3월 17일</span>
        </div>
      </div>
    </div>
  )
}

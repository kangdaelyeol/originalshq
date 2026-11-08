import '@/screens/xtool-lead-manager/styles/footer.scss'
import { useState } from 'react'
import { LM_VERSION } from '@/screens/xtool-lead-manager/version'
import { ChangelogModal } from './changelog-modal'

/** 화면 맨 아래 — 페이지 배경 위에 떠 있는 유리 띠(왼쪽 이름, 오른쪽 버전·저작권).
 * 저작권은 시스템을 만들고 관리·유지보수하는 오리지널스(고객사 Cyan International은
 * 이용하고 고쳐 달라고 요청한다).
 * 버전 알약을 누르면 업데이트 기록이 뜬다(띠 밖에 그린다 — 띠의 흐림
 * (backdrop-filter)이 모달의 position: fixed 기준이 되지 않게). */
export const Footer = () => {
  const [changelogOpen, setChangelogOpen] = useState(false)
  return (
    <div className="lead_manager_footer">
      <div className="lead_manager_footer_bar">
        <div className="brand">
          <span className="brand_mark" aria-hidden="true" />
          <span className="brand_name">xTool</span>
          <span className="sub_label">Lead Manager</span>
        </div>

        <div className="meta">
          <button
            type="button"
            className="version"
            title="업데이트 기록 보기"
            onClick={() => setChangelogOpen(true)}
          >
            v{LM_VERSION}
          </button>
          <span className="copyright">
            © {new Date().getFullYear()} Originals Inc. All rights reserved.
          </span>
        </div>
      </div>
      {changelogOpen && (
        <ChangelogModal onClose={() => setChangelogOpen(false)} />
      )}
    </div>
  )
}

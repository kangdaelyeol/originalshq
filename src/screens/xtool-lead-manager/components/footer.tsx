import '@/screens/xtool-lead-manager/styles/footer.scss'

/** 화면 맨 아래 — 페이지 배경 위에 떠 있는 유리 띠(왼쪽 이름, 오른쪽 버전·저작권). */
export const Footer = () => {
  return (
    <div className="lead_manager_footer">
      <div className="lead_manager_footer_bar">
        <div className="brand">
          <span className="brand_mark" aria-hidden="true" />
          <span className="brand_name">xTool</span>
          <span className="sub_label">Lead Manager</span>
        </div>

        <div className="meta">
          <span className="version">v1.0.0</span>
          <span className="copyright">
            © {new Date().getFullYear()} Cyan International. All rights
            reserved.
          </span>
        </div>
      </div>
    </div>
  )
}

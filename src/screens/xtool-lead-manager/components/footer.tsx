import '@/screens/xtool-lead-manager/styles/footer.scss'

export const Footer = () => {
  return (
    <div className="lead_manager_footer">
      <div className="brand">
        <span className="brand_name">xTool</span>
        <span className="divider" />
        <span className="sub_label">Lead Manager</span>
      </div>

      <div className="meta">
        <span className="version">v1.0.0</span>
        <span className="divider" />
        <span className="copyright">
          © {new Date().getFullYear()} Cyan International. All rights reserved.
        </span>
      </div>
    </div>
  )
}

import { QRCodeCanvas } from 'qrcode.react'
import '@/screens/parke/styles/qr-modal.scss'
import '@/reset.scss'

export const QrModal = ({
  url,
  onCloseClick,
}: {
  url: string
  onCloseClick: () => void
}) => {
  return (
    <div className="qr-modal">
      <div className="qr-wrapper">
        <QRCodeCanvas
          marginSize={2}
          className="qr-code-canvas"
          size={300}
          value={url}
        />
        <button
          type="button"
          onClick={onCloseClick}
          className="btn-close"
          aria-label="닫기"
        >
          &times;
        </button>
      </div>
    </div>
  )
}

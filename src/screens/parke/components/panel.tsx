import { QRCodeCanvas } from 'qrcode.react'
import '@/screens/parke/styles/panel.scss'

const downloadQrCode = (serial: string) => {
  const canvas = document.querySelector('.qr-code-canvas') as HTMLCanvasElement
  if (!canvas) return
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `qr-${serial}.png`
  a.click()
}

const QrCode = ({ url }: { url: string }) => {
  return (
    <QRCodeCanvas
      marginSize={2}
      className="qr-code-canvas"
      size={150}
      value={url}
    />
  )
}

export const Panel = () => {
  const tmpData = {
    serial: 'mr1nzp99',
    qrImageUrl: 'https://parke-web.netlify.app/parke/abcd',
  }
  const handleDownloadClick = () => {
    downloadQrCode(tmpData.serial)
  }

  const handleCreateClick = () => {
    console.log('asdsad')
  }

  return (
    <div className="panel">
      <div className="panel-label">QR 코드 생성</div>
      <div className="gen-row">
        <button
          onClick={handleCreateClick}
          className="btn-generate"
          id="genBtn"
        >
          생성하기
        </button>
      </div>
      <div
        className="error-msg"
        id="errorMsg"
        style={{ display: 'none' }}
      ></div>

      <div className="result" id="resultBox">
        <div className="scan-frame">
          <QrCode url={tmpData.qrImageUrl} />
          <div className="corner tl"></div>
          <div className="corner tr"></div>
          <div className="corner bl"></div>
          <div className="corner br"></div>
        </div>
        <div className="result-info">
          <div className="lbl"></div>
          <div className="serial" id="resultSerial">
            {tmpData.serial}
          </div>
          <div className="lbl"></div>
          <div className="url" id="resultUrl">
            {tmpData.qrImageUrl}
          </div>
        </div>
      </div>
      <button onClick={handleDownloadClick} className="qrdown__btn">
        다운로드
      </button>
    </div>
  )
}

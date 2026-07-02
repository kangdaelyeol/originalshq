import { QRCodeCanvas } from 'qrcode.react'
import '@/screens/parke/styles/panel.scss'
import { PARKE_URL } from '../constants'
import { useState } from 'react'

const downloadQrCode = (serial: string) => {
  const canvas = document.querySelector('.qr-code-canvas') as HTMLCanvasElement
  if (!canvas) return
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `qr-${serial}.png`
  a.click()
}

const QrCode = ({ url, size }: { url: string; size: number }) => {
  return (
    <QRCodeCanvas
      marginSize={2}
      className="qr-code-canvas"
      size={size}
      value={url}
    />
  )
}

export const Panel = () => {
  const [modalActive, setModalActive] = useState(false)
  const [serial, setSerial] = useState('')
  const [iconIndex] = useState(() => Math.floor(Math.random() * 4))

  const qrImageUrl = PARKE_URL + '/' + serial

  const handleDownloadClick = () => {
    downloadQrCode(serial)
  }

  const handleCreateClick = () => {
    setSerial('mr1nzp99')
  }

  const handleFrameClick = () => {
    setModalActive(true)
  }

  const handleCloseClick = () => {
    setModalActive(false)
  }

  const icon =
    iconIndex === 0
      ? "(='X'=)"
      : iconIndex === 1
        ? '(^-^*)'
        : iconIndex === 2
          ? '(o^^)o'
          : '(;-;)'

  return (
    <div className="panel">
      <div className="panel-label">QR 코드 생성</div>
      <div className="gen-row">
        <button
          onClick={handleCreateClick}
          className="btn btn-generate"
          id="genBtn"
        >
          생성하기
        </button>
      </div>

      <div className="result-box">
        {serial ? (
          <>
            <div className="result">
              <div className="scan-frame">
                <div className="hover-frame" onClick={handleFrameClick} />
                <QrCode url={qrImageUrl} size={150} />
                <div className="corner tl" />
                <div className="corner tr" />
                <div className="corner bl" />
                <div className="corner br" />
              </div>
              <div className="result-info">
                <div className="lbl">QR 코드 정보</div>
                <div className="serial" id="resultSerial">
                  {serial}
                </div>
                <div className="lbl"></div>
                <div className="url" id="resultUrl">
                  {qrImageUrl}
                </div>
              </div>
            </div>
            <button
              onClick={handleDownloadClick}
              className="btn btn-qrdownload"
            >
              다운로드
            </button>
          </>
        ) : (
          <div className="empty-box">
            <div className="icon">{icon}</div>
            <div className="caption">QR 코드를 생성해주세요!</div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalActive && (
        <div className="modal">
          <div className="qr-wrapper">
            <QrCode url={qrImageUrl} size={300} />
            <div onClick={handleCloseClick} className="btn-close">
              &times;
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

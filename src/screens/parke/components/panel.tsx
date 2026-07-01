export const Panel = () => {
  const tmpData = {
    serial: 'mr1nzp99',
    qrImageUrl:
      'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https%3A%2F%2Fgithub.com%2Fkangdaelyeol%3Ftab%3Doverview%26from%3D2026-06-01%26to%3D2026-06-30',
  }
  return (
    <div className="panel">
      <div className="panel-label">QR 코드 생성</div>
      <div className="gen-row">
        <button className="btn-generate" id="genBtn">
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
          <img id="resultImg" src={tmpData.qrImageUrl} alt="생성된 QR 코드" />
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
    </div>
  )
}

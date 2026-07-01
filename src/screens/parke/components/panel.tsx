export const Panel = () => {
  return (
    <div className="panel">
      <div className="panel-label">새 QR 코드 생성</div>
      <div className="gen-row">
        <input
          type="text"
          id="urlInput"
          placeholder="https://example.com/path"
        />
        <button className="btn-generate" id="genBtn">
          생성
        </button>
      </div>
      <div
        className="error-msg"
        id="errorMsg"
        style={{ display: 'none' }}
      ></div>

      <div className="result" id="resultBox">
        <div className="scan-frame">
          <img id="resultImg" src="" alt="생성된 QR 코드" />
          <div className="corner tl"></div>
          <div className="corner tr"></div>
          <div className="corner bl"></div>
          <div className="corner br"></div>
        </div>
        <div className="result-info">
          <div className="lbl">시리얼 번호</div>
          <div className="serial" id="resultSerial">
            —
          </div>
          <div className="lbl">URL</div>
          <div className="url" id="resultUrl">
            —
          </div>
        </div>
      </div>
    </div>
  )
}

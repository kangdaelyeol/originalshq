import { useCsvImporterViewModel, CHANNEL_OPTIONS } from '../view-model'
import type { DetectedChannel } from '../types'
import { BrandSelect } from './brand-select'
import '../styles/csv-importer.scss'

export const CsvImporter = () => {
  const {
    brandId,
    setBrandId,
    selected,
    setChannelHint,
    removeFile,
    isDragOver,
    setIsDragOver,
    handleDrop,
    fileInputRef,
    handleFileInputChange,
    stage,
    busy,
    preview,
    importResult,
    error,
    totalWarnings,
    handlePreview,
    handleImport,
    reset,
  } = useCsvImporterViewModel()

  return (
    <div className="csv-importer">
      <BrandSelect value={brandId} onChange={setBrandId} disabled={busy} />

      <div
        className={`csv-importer__dropzone${isDragOver ? ' is-dragover' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <p>CSV 파일을 여기로 끌어놓거나 클릭해서 선택하세요</p>
        <p className="csv-importer__dropzone-hint">
          네이버 · 메타 · 구글 · 당근 리포트 CSV를 여러 개 한 번에 올릴 수
          있습니다
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          multiple
          onChange={handleFileInputChange}
          hidden
        />
      </div>

      {selected.length > 0 && (
        <ul className="csv-importer__file-list">
          {selected.map((sf) => (
            <li key={sf.id} className="csv-importer__file-row">
              <span className="csv-importer__file-name">{sf.file.name}</span>
              <select
                value={sf.channelHint ?? ''}
                onChange={(e) =>
                  setChannelHint(
                    sf.id,
                    e.target.value ? (e.target.value as DetectedChannel) : null,
                  )
                }
                disabled={busy}
              >
                <option value="">자동 감지</option>
                {CHANNEL_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="csv-importer__remove"
                onClick={() => removeFile(sf.id)}
                disabled={busy}
                aria-label={`${sf.file.name} 제거`}
              >
                제거
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="csv-importer__actions">
        <button
          type="button"
          onClick={handlePreview}
          disabled={busy || selected.length === 0}
        >
          {stage === 'previewing' ? '미리보는 중…' : '미리보기'}
        </button>
        <button
          type="button"
          className="csv-importer__primary"
          onClick={handleImport}
          disabled={busy || !preview || selected.length === 0}
        >
          {stage === 'importing' ? '적재하는 중…' : '등록하기'}
        </button>
        {(selected.length > 0 || preview) && (
          <button
            type="button"
            className="csv-importer__ghost"
            onClick={reset}
            disabled={busy}
          >
            초기화
          </button>
        )}
      </div>

      {error && <div className="csv-importer__banner is-error">{error}</div>}

      {preview && !importResult && (
        <div className="csv-importer__result">
          {preview.conflicts.length > 0 && (
            <div className="csv-importer__banner is-conflict">
              같은 채널·캠페인·날짜 조합 {preview.conflicts.length}건이 이미
              있습니다. 가져오기를 실행하면 해당 데이터가 덮어써집니다.
            </div>
          )}
          {totalWarnings > 0 && (
            <div className="csv-importer__banner is-warning">
              파싱 경고 {totalWarnings}건 — 아래 파일별 목록을 확인하세요.
            </div>
          )}

          <table className="csv-importer__table">
            <thead>
              <tr>
                <th>파일</th>
                <th>매체</th>
                <th>형식</th>
                <th>행 수</th>
                <th>기간</th>
                <th>경고</th>
              </tr>
            </thead>
            <tbody>
              {preview.files.map((f, i) => (
                <tr key={`${f.source}-${i}`}>
                  <td>{f.source}</td>
                  <td>{f.channel}</td>
                  <td>{f.format}</td>
                  <td className="csv-importer__num">
                    {f.rowCount.toLocaleString()}
                  </td>
                  <td>
                    {f.dateRange[0] && f.dateRange[1]
                      ? `${f.dateRange[0]} ~ ${f.dateRange[1]}`
                      : '—'}
                  </td>
                  <td>
                    {f.warnings.length === 0 ? (
                      '—'
                    ) : (
                      <ul className="csv-importer__warnings">
                        {f.warnings.map((w, wi) => (
                          <li key={wi}>{w}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="csv-importer__total">
            총 {preview.totalRows.toLocaleString()}행 파싱됨
          </p>
        </div>
      )}

      {importResult && (
        <div className="csv-importer__result">
          <div className="csv-importer__banner is-success">
            {importResult.inserted.toLocaleString()}행 저장 완료
            {importResult.deleted > 0 &&
              ` (기존 ${importResult.deleted.toLocaleString()}행 교체)`}
          </div>
          {importResult.warnings.length > 0 && (
            <ul className="csv-importer__warnings">
              {importResult.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

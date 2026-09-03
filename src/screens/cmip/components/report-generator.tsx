import type { ReactNode } from 'react'
import { useReportGeneratorViewModel } from '../view-model'
import type { ReportSection } from '../client'
import type { ReportType } from '../types'
import { BrandSelect } from './brand-select'
import { SegmentedToggle } from './segmented-toggle'
import '../styles/report-generator.scss'

const REPORT_TYPE_OPTIONS: readonly { value: ReportType; label: string }[] = [
  { value: 'weekly', label: '주간' },
  { value: 'monthly', label: '월간' },
]

/** 섹션 종류(kind)별 본문 렌더. build_analysis → sections()의 4가지 형태를 그대로 처리. */
function renderSectionBody(section: ReportSection): ReactNode {
  switch (section.kind) {
    case 'paragraphs':
      return section.body.map((line, i) => (
        <p key={i} className="report-generator__paragraph">
          {line}
        </p>
      ))
    case 'list':
      return (
        <ul className="report-generator__list">
          {section.body.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )
    case 'funnel':
      return <p className="report-generator__funnel">{section.body.text}</p>
    case 'table':
      return (
        <>
          <div className="report-generator__table-wrap">
            <table className="report-generator__table">
              <thead>
                <tr>
                  {section.body.headers.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.body.rows.length === 0 ? (
                  <tr>
                    <td colSpan={section.body.headers.length}>데이터 없음</td>
                  </tr>
                ) : (
                  section.body.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci}>{cell}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {section.footnote && (
            <p className="report-generator__footnote">{section.footnote}</p>
          )}
        </>
      )
  }
}

export const ReportGenerator = () => {
  const {
    brandId,
    setBrandId,
    reportType,
    setReportType,
    dateStart,
    setDateStart,
    dateEnd,
    setDateEnd,
    notes,
    setNotes,
    nextPlanNote,
    setNextPlanNote,
    loading,
    error,
    report,
    openSections,
    toggleSection,
    setAllSections,
    generate,
  } = useReportGeneratorViewModel()

  return (
    <div className="report-generator">
      <BrandSelect value={brandId} onChange={setBrandId} disabled={loading} />

      <SegmentedToggle
        label="보고서 종류"
        options={REPORT_TYPE_OPTIONS}
        value={reportType}
        onChange={setReportType}
        disabled={loading}
      />

      <div className="report-generator__form">
        <div className="report-generator__field">
          <label htmlFor="report-date-start">시작일</label>
          <input
            id="report-date-start"
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="report-generator__field">
          <label htmlFor="report-date-end">종료일</label>
          <input
            id="report-date-end"
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="report-generator__field report-generator__field--wide">
          <label htmlFor="report-notes">매체 운영 현황 (선택)</label>
          <textarea
            id="report-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="report-generator__field report-generator__field--wide">
          <label htmlFor="report-next-plan">다음 기간 계획 (선택)</label>
          <textarea
            id="report-next-plan"
            rows={2}
            value={nextPlanNote}
            onChange={(e) => setNextPlanNote(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      <p className="report-generator__hint">
        시작일·종료일을 비우면{' '}
        {reportType === 'weekly' ? '최근 7일' : '최근 30일'}(어제까지)로 자동
        설정됩니다.
      </p>

      <div className="report-generator__actions">
        <button type="button" onClick={generate} disabled={loading}>
          {loading ? '생성하는 중…' : '보고서 생성'}
        </button>
      </div>

      {error && (
        <div className="report-generator__banner is-error">{error}</div>
      )}

      {report && (
        <div className="report-generator__report">
          <header className="report-generator__report-head">
            <h2 className="report-generator__report-title">{report.title}</h2>
          </header>

          <section className="report-generator__summary">
            <div className="report-generator__summary-head">
              <span className="report-generator__summary-label">Summary</span>
              <span className="report-generator__summary-period">
                {report.periodLabel}
              </span>
            </div>
            <div className="report-generator__summary-grid">
              {report.kpiCards.map((card) => (
                <div key={card.label} className="report-generator__kpi">
                  <span className="report-generator__kpi-label">
                    {card.label}
                  </span>
                  <span className="report-generator__kpi-value">
                    {card.value}
                  </span>
                  {card.delta && (
                    <span className="report-generator__kpi-delta">
                      {card.delta}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="report-generator__section-controls">
            <button type="button" onClick={() => setAllSections(true)}>
              모두 펼치기
            </button>
            <button type="button" onClick={() => setAllSections(false)}>
              모두 접기
            </button>
          </div>

          <div className="report-generator__sections">
            {report.sections.map((section) => {
              const open = openSections.has(section.no)
              return (
                <div key={section.no} className="report-generator__section">
                  <button
                    type="button"
                    className="report-generator__section-header"
                    aria-expanded={open}
                    onClick={() => toggleSection(section.no)}
                  >
                    <span className="report-generator__chevron" aria-hidden>
                      ▸
                    </span>
                    <span className="report-generator__section-title">
                      {section.no}. {section.title}
                    </span>
                  </button>
                  {open && (
                    <div className="report-generator__section-body">
                      {renderSectionBody(section)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

import type { CSSProperties } from 'react'
import type { ChannelSplitSeries, MetricsSummary } from '../client'
import { METRIC_FIELDS } from './metric-fields'
import { SHEET_OPTIONS, type ExportCampaign } from './excel-writer'
import { useExcelExportViewModel } from '../view-model/use-excel-export-view-model'
import '../styles/excel-export-modal.scss'

export type { ExportCampaign } from './excel-writer'

interface ExcelExportModalProps {
  onClose: () => void
  dateStart: string
  dateEnd: string
  total: {
    combined: MetricsSummary
    meta: MetricsSummary
    google: MetricsSummary
    naver: MetricsSummary
  }
  series: ChannelSplitSeries
  campaigns: readonly ExportCampaign[]
}

/** "엑셀 다운로드" 버튼에서 여는 모달 — 전체요약/캠페인/애드셋 중 시트로
 * 내보낼 것(복수 선택)과, 각 시트에 실을 지표(복수 선택, 기본 전체)를 고르면
 * 하나의 .xlsx 파일에 고른 시트를 모두 담아 내려받는다. 전체요약 시트는 맨 위에
 * 요약(채널별 총계) 표를 두고, 월간/주간/일간/이전-지정 일정 비교분석/요일별
 * 마다 combined 표 + 채널별(Meta/Google/Naver 중 데이터 있는 것만) 표를 이어
 * 쌓는다. 캠페인·애드셋 시트는 그 단위별로 같은 시간 축 표들을 쌓는다. 시간
 * 축 표(요약류 제외)는 맨 밑에 지표별 평균 행이 같이 붙는다. 실제 워크시트를
 * 채우는 로직은 excel-writer.ts(순수 함수)에, 그걸 언제 어떻게 호출할지는
 * use-excel-export-view-model.ts에 있고, 이 컴포넌트는 UI만 담당한다. */
export function ExcelExportModal({
  onClose,
  dateStart,
  dateEnd,
  total,
  series,
  campaigns,
}: ExcelExportModalProps) {
  const {
    sheets,
    metricKeys,
    bucketSize,
    setBucketSize,
    isExporting,
    canExport,
    toggleSheet,
    toggleMetric,
    handleExport,
  } = useExcelExportViewModel({
    dateStart,
    dateEnd,
    total,
    series,
    campaigns,
    onExported: onClose,
  })

  return (
    <div className="excel-export-modal" onClick={onClose}>
      <div
        className="excel-export-modal__panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="excel-export-modal__header">
          <h3 className="excel-export-modal__title">엑셀 다운로드</h3>
          <button
            type="button"
            className="excel-export-modal__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        <div className="excel-export-modal__body">
          <section className="excel-export-modal__section">
            <div className="excel-export-modal__section-title">시트 선택</div>
            <p className="excel-export-modal__desc">
              시트마다 전체요약(총계) · 월간 · 주간 · 일간 · 이전 일정 vs 지정
              일정 비교분석 · 요일별 표를 이 순서로 담습니다(캠페인·애드셋은
              그 단위별로 나눠서). 요약류를 제외한 표는 맨 밑에 지표별 평균
              행이 같이 붙습니다. 캠페인·애드셋은 채널 합산 시트 외에
              "캠페인-Meta"처럼 매체별 시트도 데이터가 있는 채널만 골라
              추가로 담습니다. 캠페인·애드셋마다 표 블록을 접었다 펼 수
              있습니다.
            </p>
            <div
              className="excel-export-modal__chip-row"
              role="group"
              aria-label="시트 선택"
            >
              {SHEET_OPTIONS.map((s) => {
                const active = sheets.has(s.key)
                return (
                  <button
                    key={s.key}
                    type="button"
                    className={`excel-export-modal__chip${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => toggleSheet(s.key)}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="excel-export-modal__section">
            <div className="excel-export-modal__section-title">지표 선택</div>
            <div
              className="excel-export-modal__chip-row"
              role="group"
              aria-label="지표 선택"
            >
              {METRIC_FIELDS.map((f) => {
                const active = metricKeys.has(f.key)
                return (
                  <button
                    key={f.key}
                    type="button"
                    className={`excel-export-modal__chip${active ? ' is-active' : ''}`}
                    style={{ '--chip-color': f.color } as CSSProperties}
                    aria-pressed={active}
                    onClick={() => toggleMetric(f.key)}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="excel-export-modal__section">
            <div className="excel-export-modal__section-title">
              이전 일정 vs 지정 일정 구간 일수
            </div>
            <label className="excel-export-modal__period-size">
              <input
                type="number"
                min={1}
                step={1}
                value={bucketSize ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') {
                    setBucketSize(null)
                    return
                  }
                  const parsed = Math.trunc(Number(raw))
                  setBucketSize(
                    Number.isFinite(parsed) && parsed > 0 ? parsed : null,
                  )
                }}
              />
              일 단위 (최신일 기준으로 거꾸로 묶고, 나머지는 버림)
            </label>
          </section>

          {!canExport && (
            <p className="excel-export-modal__hint">
              시트와 지표를 각각 하나 이상 골라주세요.
            </p>
          )}
        </div>

        <footer className="excel-export-modal__footer">
          <button
            type="button"
            className="excel-export-modal__btn excel-export-modal__ghost"
            onClick={onClose}
            disabled={isExporting}
          >
            취소
          </button>
          <button
            type="button"
            className="excel-export-modal__btn excel-export-modal__primary"
            onClick={handleExport}
            disabled={!canExport || isExporting}
          >
            {isExporting ? '생성하는 중…' : '다운로드'}
          </button>
        </footer>
      </div>
    </div>
  )
}

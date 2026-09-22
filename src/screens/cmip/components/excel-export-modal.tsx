import { useState, type CSSProperties } from 'react'
import * as ExcelJS from 'exceljs'
import type { MetricsSummary } from '../client'
import { METRIC_FIELDS, type MetricField } from './metric-fields'
import '../styles/excel-export-modal.scss'

type MetricKey = keyof MetricsSummary

export interface ExcelDailyRow {
  date: string
  metrics: MetricsSummary
}

export interface ExcelCampaignRow {
  name: string
  channels: string
  resultType: string
  metrics: MetricsSummary
}

export interface ExcelAdsetRow {
  name: string
  channels: string
  metrics: MetricsSummary
}

type SheetKey = 'total' | 'campaign' | 'adset'

const SHEET_OPTIONS: readonly { key: SheetKey; label: string }[] = [
  { key: 'total', label: '전체 요약 (일별)' },
  { key: 'campaign', label: '캠페인' },
  { key: 'adset', label: '애드셋' },
]

function metricColumns(fields: readonly MetricField[]) {
  return fields.map((f) => ({
    header: `${f.label} (${f.unit})`,
    key: f.key,
    width: 16,
  }))
}

function styleHeaderRow(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1)
  header.font = { bold: true }
  header.alignment = { vertical: 'middle' }
}

/** 지표 값만 골라 { [지표 key]: 값 } 형태로 — ws.addRow은 columns의 key와
 * 일치하는 필드만 그 칸에 채운다. */
function metricValues(
  metrics: MetricsSummary,
  fields: readonly MetricField[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const f of fields) out[f.key] = metrics[f.key]
  return out
}

interface ExcelExportModalProps {
  onClose: () => void
  dateStart: string
  dateEnd: string
  dailyRows: readonly ExcelDailyRow[]
  campaignRows: readonly ExcelCampaignRow[]
  adsetRows: readonly ExcelAdsetRow[]
}

/** "엑셀 다운로드" 버튼에서 여는 모달 — 전체요약(일별)/캠페인/애드셋 중 시트로
 * 내보낼 것(복수 선택)과, 각 시트에 실을 지표(복수 선택, 기본 전체)를 고르면
 * 하나의 .xlsx 파일에 고른 시트를 모두 담아 내려받는다. */
export function ExcelExportModal({
  onClose,
  dateStart,
  dateEnd,
  dailyRows,
  campaignRows,
  adsetRows,
}: ExcelExportModalProps) {
  const [sheets, setSheets] = useState<ReadonlySet<SheetKey>>(
    () => new Set(SHEET_OPTIONS.map((s) => s.key)),
  )
  const [metricKeys, setMetricKeys] = useState<ReadonlySet<MetricKey>>(
    () => new Set(METRIC_FIELDS.map((f) => f.key)),
  )
  const [isExporting, setIsExporting] = useState(false)

  const toggleSheet = (key: SheetKey) => {
    setSheets((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleMetric = (key: MetricKey) => {
    setMetricKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectedFields = METRIC_FIELDS.filter((f) => metricKeys.has(f.key))
  const canExport = sheets.size > 0 && selectedFields.length > 0

  const handleExport = async () => {
    if (!canExport || isExporting) return
    setIsExporting(true)

    try {
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Originals CMIP'
      wb.created = new Date()

      if (sheets.has('total')) {
        const ws = wb.addWorksheet('전체요약(일별)')
        ws.columns = [
          { header: '날짜', key: 'date', width: 14 },
          ...metricColumns(selectedFields),
        ]
        for (const row of dailyRows) {
          ws.addRow({
            date: row.date,
            ...metricValues(row.metrics, selectedFields),
          })
        }
        styleHeaderRow(ws)
      }

      if (sheets.has('campaign')) {
        const ws = wb.addWorksheet('캠페인')
        ws.columns = [
          { header: 'Campaign', key: 'name', width: 28 },
          { header: 'Channel', key: 'channels', width: 16 },
          { header: '전환 목표', key: 'resultType', width: 16 },
          ...metricColumns(selectedFields),
        ]
        for (const row of campaignRows) {
          ws.addRow({
            name: row.name,
            channels: row.channels,
            resultType: row.resultType,
            ...metricValues(row.metrics, selectedFields),
          })
        }
        styleHeaderRow(ws)
      }

      if (sheets.has('adset')) {
        const ws = wb.addWorksheet('애드셋')
        ws.columns = [
          { header: 'Adset', key: 'name', width: 28 },
          { header: 'Channel', key: 'channels', width: 16 },
          ...metricColumns(selectedFields),
        ]
        for (const row of adsetRows) {
          ws.addRow({
            name: row.name,
            channels: row.channels,
            ...metricValues(row.metrics, selectedFields),
          })
        }
        styleHeaderRow(ws)
      }

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cmip_${dateStart}_${dateEnd}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      onClose()
    } finally {
      setIsExporting(false)
    }
  }

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

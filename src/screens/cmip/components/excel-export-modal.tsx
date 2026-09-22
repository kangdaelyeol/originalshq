import { useState, type CSSProperties } from 'react'
import * as ExcelJS from 'exceljs'
import {
  aggregateMetrics,
  groupByCustomPeriod,
  type ChannelSplitSeries,
  type CombinedAdset,
  type CombinedCampaign,
  type MetricsSummary,
} from '../client'
import { METRIC_FIELDS, type MetricField } from './metric-fields'
import '../styles/excel-export-modal.scss'

type MetricKey = keyof MetricsSummary

/** CombinedCampaign/CombinedAdset에 표시용 채널 라벨 문자열("Meta, Google")을
 * 미리 얹은 모양 — 채널 로고/브랜드색 계산(channelsOf, CHANNELS)은
 * meta-insight.tsx에 있는 걸 그대로 쓰고, 이 모달은 다 계산된 문자열만 받아
 * 엑셀 셀에 그대로 찍는다. */
export type ExportCampaign = CombinedCampaign & {
  channelLabel: string
  adsets: readonly (CombinedAdset & { channelLabel: string })[]
}

type SheetKey = 'total' | 'campaign' | 'adset'

const SHEET_OPTIONS: readonly { key: SheetKey; label: string }[] = [
  { key: 'total', label: '전체 요약' },
  { key: 'campaign', label: '캠페인' },
  { key: 'adset', label: '애드셋' },
]

const metricHeaders = (fields: readonly MetricField[]): string[] =>
  fields.map((f) => `${f.label} (${f.unit})`)

const metricValues = (
  metrics: MetricsSummary,
  fields: readonly MetricField[],
): number[] => fields.map((f) => metrics[f.key])

/** 표 하나를 시트의 startRow부터 그려 넣고, 다음 표가 시작할 행 번호를
 * 돌려준다(제목 행 + 헤더 행 + 데이터 행들 + 빈 줄 하나). 한 시트 안에
 * 컬럼 구성이 서로 다른 표를 여러 개 쌓아야 해서, ws.columns(시트 전체에
 * 적용되는 고정 컬럼 스키마)나 ws.addRow(키 매핑) 대신 셀 좌표를 직접
 * 지정한다. */
function writeTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  headers: readonly string[],
  rows: readonly (string | number)[][],
): number {
  const titleCell = ws.getCell(startRow, 1)
  titleCell.value = title
  titleCell.font = { bold: true, size: 12 }

  const headerRowIndex = startRow + 1
  headers.forEach((h, i) => {
    const cell = ws.getCell(headerRowIndex, i + 1)
    cell.value = h
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1C2128' },
    }
  })

  rows.forEach((row, ri) => {
    row.forEach((value, ci) => {
      ws.getCell(headerRowIndex + 1 + ri, ci + 1).value = value
    })
  })

  return headerRowIndex + rows.length + 2
}

function setColumnWidths(ws: ExcelJS.Worksheet, count: number) {
  ws.getColumn(1).width = 26
  for (let i = 2; i <= count; i++) ws.getColumn(i).width = 16
}

const periodTitle = (label: string, bucketSize: number | null): string =>
  bucketSize
    ? `${label} (${bucketSize}일 단위)`
    : `${label} (구간 일수를 입력해주세요)`

function writeTotalSheet(
  wb: ExcelJS.Workbook,
  series: ChannelSplitSeries,
  fields: readonly MetricField[],
  dateStart: string,
  dateEnd: string,
  bucketSize: number | null,
) {
  const ws = wb.addWorksheet('전체요약')
  setColumnWidths(ws, 1 + fields.length)

  let row = 1
  row = writeTable(
    ws,
    row,
    '일별 성과',
    ['날짜', ...metricHeaders(fields)],
    series.combined.byDate.map((d) => [d.date, ...metricValues(d, fields)]),
  )
  row = writeTable(
    ws,
    row,
    '요일별 성과',
    ['요일', ...metricHeaders(fields)],
    series.combined.byDayOfWeek.map((d) => [
      d.dayOfWeek,
      ...metricValues(d, fields),
    ]),
  )
  row = writeTable(
    ws,
    row,
    '주차별 성과',
    ['기간', ...metricHeaders(fields)],
    series.combined.byGroupedWeek.map((w) => [
      w.period,
      ...metricValues(w, fields),
    ]),
  )
  const customRows = bucketSize
    ? groupByCustomPeriod(
        series.combined.byDate,
        dateStart,
        dateEnd,
        bucketSize,
      )
    : []
  writeTable(
    ws,
    row,
    periodTitle('이전 일정 vs 지정 일정 비교분석', bucketSize),
    ['기간', ...metricHeaders(fields)],
    customRows.map((w) => [w.period, ...metricValues(w, fields)]),
  )
}

function writeCampaignSheet(
  wb: ExcelJS.Workbook,
  campaigns: readonly ExportCampaign[],
  fields: readonly MetricField[],
  dateStart: string,
  dateEnd: string,
  bucketSize: number | null,
) {
  const ws = wb.addWorksheet('캠페인')
  setColumnWidths(ws, 3 + fields.length)

  let row = 1
  row = writeTable(
    ws,
    row,
    '캠페인 합계 요약',
    ['Campaign', 'Channel', '전환 목표', ...metricHeaders(fields)],
    campaigns.map((c) => [
      c.campaignName,
      c.channelLabel,
      c.resultType ?? '',
      ...metricValues(aggregateMetrics(c.combined.byDate), fields),
    ]),
  )
  row = writeTable(
    ws,
    row,
    '캠페인별 일별 성과',
    ['Campaign', '날짜', ...metricHeaders(fields)],
    campaigns.flatMap((c) =>
      c.combined.byDate.map((d) => [
        c.campaignName,
        d.date,
        ...metricValues(d, fields),
      ]),
    ),
  )
  row = writeTable(
    ws,
    row,
    '캠페인별 요일별 성과',
    ['Campaign', '요일', ...metricHeaders(fields)],
    campaigns.flatMap((c) =>
      c.combined.byDayOfWeek.map((d) => [
        c.campaignName,
        d.dayOfWeek,
        ...metricValues(d, fields),
      ]),
    ),
  )
  row = writeTable(
    ws,
    row,
    '캠페인별 주차별 성과',
    ['Campaign', '기간', ...metricHeaders(fields)],
    campaigns.flatMap((c) =>
      c.combined.byGroupedWeek.map((w) => [
        c.campaignName,
        w.period,
        ...metricValues(w, fields),
      ]),
    ),
  )
  writeTable(
    ws,
    row,
    periodTitle('캠페인별 이전 일정 vs 지정 일정 비교분석', bucketSize),
    ['Campaign', '기간', ...metricHeaders(fields)],
    campaigns.flatMap((c) =>
      (bucketSize
        ? groupByCustomPeriod(c.combined.byDate, dateStart, dateEnd, bucketSize)
        : []
      ).map((w) => [c.campaignName, w.period, ...metricValues(w, fields)]),
    ),
  )
}

function writeAdsetSheet(
  wb: ExcelJS.Workbook,
  campaigns: readonly ExportCampaign[],
  fields: readonly MetricField[],
  dateStart: string,
  dateEnd: string,
  bucketSize: number | null,
) {
  const adsets = campaigns.flatMap((c) => c.adsets)
  const ws = wb.addWorksheet('애드셋')
  setColumnWidths(ws, 2 + fields.length)

  let row = 1
  row = writeTable(
    ws,
    row,
    '애드셋 합계 요약',
    ['Adset', 'Channel', ...metricHeaders(fields)],
    adsets.map((a) => [
      a.adsetName,
      a.channelLabel,
      ...metricValues(aggregateMetrics(a.combined.byDate), fields),
    ]),
  )
  row = writeTable(
    ws,
    row,
    '애드셋별 일별 성과',
    ['Adset', '날짜', ...metricHeaders(fields)],
    adsets.flatMap((a) =>
      a.combined.byDate.map((d) => [
        a.adsetName,
        d.date,
        ...metricValues(d, fields),
      ]),
    ),
  )
  row = writeTable(
    ws,
    row,
    '애드셋별 요일별 성과',
    ['Adset', '요일', ...metricHeaders(fields)],
    adsets.flatMap((a) =>
      a.combined.byDayOfWeek.map((d) => [
        a.adsetName,
        d.dayOfWeek,
        ...metricValues(d, fields),
      ]),
    ),
  )
  row = writeTable(
    ws,
    row,
    '애드셋별 주차별 성과',
    ['Adset', '기간', ...metricHeaders(fields)],
    adsets.flatMap((a) =>
      a.combined.byGroupedWeek.map((w) => [
        a.adsetName,
        w.period,
        ...metricValues(w, fields),
      ]),
    ),
  )
  writeTable(
    ws,
    row,
    periodTitle('애드셋별 이전 일정 vs 지정 일정 비교분석', bucketSize),
    ['Adset', '기간', ...metricHeaders(fields)],
    adsets.flatMap((a) =>
      (bucketSize
        ? groupByCustomPeriod(a.combined.byDate, dateStart, dateEnd, bucketSize)
        : []
      ).map((w) => [a.adsetName, w.period, ...metricValues(w, fields)]),
    ),
  )
}

interface ExcelExportModalProps {
  onClose: () => void
  dateStart: string
  dateEnd: string
  series: ChannelSplitSeries
  campaigns: readonly ExportCampaign[]
}

/** "엑셀 다운로드" 버튼에서 여는 모달 — 전체요약/캠페인/애드셋 중 시트로
 * 내보낼 것(복수 선택)과, 각 시트에 실을 지표(복수 선택, 기본 전체)를 고르면
 * 하나의 .xlsx 파일에 고른 시트를 모두 담아 내려받는다. 시트마다 일별/요일별/
 * 주차별/이전-지정 일정 비교분석 표를 전부(캠페인·애드셋은 그 단위별로) 위아래로
 * 쌓아 담는다. */
export function ExcelExportModal({
  onClose,
  dateStart,
  dateEnd,
  series,
  campaigns,
}: ExcelExportModalProps) {
  const [sheets, setSheets] = useState<ReadonlySet<SheetKey>>(
    () => new Set(SHEET_OPTIONS.map((s) => s.key)),
  )
  const [metricKeys, setMetricKeys] = useState<ReadonlySet<MetricKey>>(
    () => new Set(METRIC_FIELDS.map((f) => f.key)),
  )
  // "이전 일정 vs 지정 일정" 표의 구간 일수 — 모든 시트가 공유한다. null이면
  // (입력칸을 지우는 중) 그 표는 헤더만 있고 빈 채로 나간다.
  const [bucketSize, setBucketSize] = useState<number | null>(7)
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
        writeTotalSheet(
          wb,
          series,
          selectedFields,
          dateStart,
          dateEnd,
          bucketSize,
        )
      }
      if (sheets.has('campaign')) {
        writeCampaignSheet(
          wb,
          campaigns,
          selectedFields,
          dateStart,
          dateEnd,
          bucketSize,
        )
      }
      if (sheets.has('adset')) {
        writeAdsetSheet(
          wb,
          campaigns,
          selectedFields,
          dateStart,
          dateEnd,
          bucketSize,
        )
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
            <p className="excel-export-modal__desc"></p>
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

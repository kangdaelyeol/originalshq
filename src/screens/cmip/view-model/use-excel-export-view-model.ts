import { useState } from 'react'
import * as ExcelJS from 'exceljs'
import type { ChannelSplitSeries, MetricsSummary } from '../client'
import { METRIC_FIELDS, type MetricKey } from '../components/metric-fields'
import {
  planExcelSheets,
  writeAdsetSheet,
  writeCampaignSheet,
  writeTotalSheet,
  SHEET_OPTIONS,
  type ExportCampaign,
  type SheetKey,
} from '../components/excel-writer'

interface UseExcelExportViewModelArgs {
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
  onExported: () => void
}

/** excel-export-modal 전용 상태 — 어떤 시트/지표를 담을지 고르는 체크박스
 * 상태와, "이전 일정 vs 지정 일정" 구간 일수, 내보내는 중 스피너를 다루고,
 * 실제 .xlsx 생성·다운로드(handleExport)까지 담당한다. 워크시트를 실제로
 * 채우는 알고리즘 자체는 excel-writer.ts(순수 함수)에 있고, 이 훅은 그걸
 * 호출·조립하는 오케스트레이터다. */
export const useExcelExportViewModel = ({
  dateStart,
  dateEnd,
  total,
  series,
  campaigns,
  onExported,
}: UseExcelExportViewModelArgs) => {
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

      // 어떤 시트가 실제로 만들어질지 먼저 정한다(체크 여부 + 데이터 있는
      // 채널만) — 이 계획대로 아래서 실제 시트를 만든다.
      const planned = planExcelSheets(sheets, campaigns)

      for (const p of planned) {
        if (p.kind === 'total') {
          writeTotalSheet(
            wb,
            total,
            series,
            selectedFields,
            dateStart,
            dateEnd,
            bucketSize,
          )
        } else if (p.kind === 'campaign') {
          writeCampaignSheet(
            wb,
            p.name,
            p.data,
            p.selector,
            selectedFields,
            dateStart,
            dateEnd,
            bucketSize,
          )
        } else {
          writeAdsetSheet(
            wb,
            p.name,
            p.data,
            p.selector,
            selectedFields,
            dateStart,
            dateEnd,
            bucketSize,
          )
        }
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
      onExported()
    } finally {
      setIsExporting(false)
    }
  }

  return {
    // 입력
    sheets,
    metricKeys,
    bucketSize,
    setBucketSize,
    // 진행 상태
    isExporting,
    canExport,
    // 액션
    toggleSheet,
    toggleMetric,
    handleExport,
  }
}

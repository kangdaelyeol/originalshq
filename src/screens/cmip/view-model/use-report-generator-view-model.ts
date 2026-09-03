import { useCallback, useState } from 'react'
import {
  generateReport as requestReport,
  CallableError,
  type GeneratedReport,
} from '../client'
import type { ReportType } from '../types'

export const useReportGeneratorViewModel = () => {
  const [brandId, setBrandId] = useState('')
  const [reportType, setReportType] = useState<ReportType>('weekly')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [nextPlanNote, setNextPlanNote] = useState('')
  const [report, setReport] = useState<GeneratedReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const describeError = (err: unknown, fallback: string): string =>
    err instanceof CallableError || err instanceof Error ? err.message : fallback

  /** 입력값으로 보고서 구조 데이터를 생성. 날짜가 비어 있으면 서버 기본값에 맡긴다. */
  const generate = useCallback(async () => {
    const id = brandId.trim()
    if (!id) return
    setError(null)
    setLoading(true)
    try {
      const result = await requestReport({
        brandId: id,
        reportType,
        dateStart: dateStart.trim() || null,
        dateEnd: dateEnd.trim() || null,
        notes: notes.trim(),
        nextPlanNote: nextPlanNote.trim(),
      })
      setReport(result)
    } catch (err) {
      setError(describeError(err, '보고서 생성 중 오류가 발생했습니다.'))
    } finally {
      setLoading(false)
    }
  }, [brandId, reportType, dateStart, dateEnd, notes, nextPlanNote])

  return {
    // 입력
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
    // 진행 상태
    loading,
    error,
    // 결과
    report,
    // 액션
    generate,
  }
}

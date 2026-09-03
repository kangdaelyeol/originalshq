import { useCallback, useState } from 'react'
import {
  generateReport as requestReport,
  CallableError,
  type GeneratedReport,
} from '../client'
import { BRAND_OPTIONS } from '../types'
import type { BrandId, ReportType } from '../types'

export const useReportGeneratorViewModel = () => {
  const [brandId, setBrandId] = useState<BrandId>(BRAND_OPTIONS[0].id)
  const [reportType, setReportType] = useState<ReportType>('weekly')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [nextPlanNote, setNextPlanNote] = useState('')
  const [report, setReport] = useState<GeneratedReport | null>(null)
  const [openSections, setOpenSections] = useState<ReadonlySet<number>>(
    new Set(),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const describeError = (err: unknown, fallback: string): string =>
    err instanceof CallableError || err instanceof Error ? err.message : fallback

  /** 입력값으로 보고서 구조 데이터를 생성. 날짜가 비어 있으면 서버 기본값에 맡긴다. */
  const generate = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const result = await requestReport({
        brandId,
        reportType,
        dateStart: dateStart.trim() || null,
        dateEnd: dateEnd.trim() || null,
        notes: notes.trim(),
        nextPlanNote: nextPlanNote.trim(),
      })
      setReport(result)
      // 생성 직후엔 모든 섹션을 펼친 상태로 보여준다.
      setOpenSections(new Set(result.sections.map((s) => s.no)))
    } catch (err) {
      setError(describeError(err, '보고서 생성 중 오류가 발생했습니다.'))
    } finally {
      setLoading(false)
    }
  }, [brandId, reportType, dateStart, dateEnd, notes, nextPlanNote])

  /** 섹션 하나 펼침/접힘 토글. */
  const toggleSection = useCallback((no: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(no)) next.delete(no)
      else next.add(no)
      return next
    })
  }, [])

  /** 모든 섹션 펼치기/접기. */
  const setAllSections = useCallback(
    (open: boolean) => {
      setOpenSections(
        open ? new Set(report?.sections.map((s) => s.no) ?? []) : new Set(),
      )
    },
    [report],
  )

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
    openSections,
    toggleSection,
    setAllSections,
    // 액션
    generate,
  }
}

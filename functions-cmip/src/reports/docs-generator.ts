/**
 * 주간/월간 보고서 구조화 데이터 생성 — Python `src/reports/docs_generator.py` 이관.
 *
 * 원본은 python-docx로 .docx 파일을 렌더링해 로컬 디스크에 저장하고 백업했다. 그러나
 * Cloud Functions는 임의 경로 파일 쓰기가 불가하고, 파일 렌더링(.docx/.pdf) 책임은
 * 프론트/후속 파이프라인으로 위임하기로 했다. 따라서 여기서는 분석(`build_analysis`) +
 * KPI 카드 + 섹션 구성까지만 만들어 JSON으로 반환한다. 렌더러는 이 구조만 소비하면 된다.
 *
 * 제거된 원본 요소: python-docx(Document/Pt), `REPORTS_DIR`/`doc.save`, `backup_report`,
 * `Report` 레코드 적재, `pdf_generator` 분기. `fmt`는 어떤 렌더러로 넘길지 힌트로만 echo한다.
 */
import { buildAnalysis } from './analyzer'
import type { BuildAnalysisResult } from './analyzer'
import { kpiCards, sections } from './sections'
import type { KpiCard, ReportSection } from './sections'
import type { ReportFmt, ReportType } from '../data/firestore'
import { addDays, todayISO } from '../utils/dates'
import type { ISODate } from '../types'

export interface GenerateReportOptions {
  reportType?: ReportType
  dateStart?: ISODate | null
  dateEnd?: ISODate | null
  notes?: string
  nextPlanNote?: string
  /** 렌더러 힌트 — 이 함수는 파일을 만들지 않고 값만 echo한다. */
  fmt?: ReportFmt
}

export interface GeneratedReport {
  brand: string
  reportType: ReportType
  fmt: ReportFmt
  dateStart: ISODate
  dateEnd: ISODate
  generatedAt: string
  title: string
  periodLabel: string
  kpiCards: KpiCard[]
  sections: ReportSection[]
  /** 렌더러가 표 외의 원본 수치가 필요할 때를 위한 분석 원본. */
  analysis: BuildAnalysisResult
}

/**
 * 보고서 표시 구조를 만든다 (파일 렌더링·저장은 하지 않는다).
 * Python `generate_report` / `generate_docx_report` 의 데이터 준비 단계에 해당.
 */
export const generateReport = async (
  brandId: string | number,
  opts: GenerateReportOptions = {},
): Promise<GeneratedReport> => {
  const reportType: ReportType = opts.reportType ?? 'weekly'
  const fmt: ReportFmt = opts.fmt ?? 'pdf'
  const notes = opts.notes ?? ''
  const nextPlanNote = opts.nextPlanNote ?? ''

  // 기본 기간: 종료일 = 어제, 시작일 = 종료일 - (주간 6일 / 월간 29일)
  const dateEnd: ISODate = opts.dateEnd ?? addDays(todayISO(), -1)
  const dateStart: ISODate =
    opts.dateStart ?? addDays(dateEnd, reportType === 'weekly' ? -6 : -29)

  const analysis = await buildAnalysis(
    brandId,
    dateStart,
    dateEnd,
    reportType,
    notes,
    nextPlanNote,
  )

  const kindKo = reportType === 'weekly' ? '주간' : '월간'
  return {
    brand: analysis.brand,
    reportType,
    fmt,
    dateStart,
    dateEnd,
    generatedAt: new Date().toISOString(),
    title: `${analysis.brand} ${kindKo} 보고서`,
    periodLabel: `보고 기간 ${dateStart} ~ ${dateEnd} · 생성일 ${todayISO()}`,
    kpiCards: kpiCards(analysis),
    sections: sections(analysis),
    analysis,
  }
}

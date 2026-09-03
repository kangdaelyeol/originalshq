/**
 * generateReport 엔드포인트 클라이언트 — functions-cmip `generateReport`(onRequest) 호출.
 * 응답은 build_analysis 결과에서 뽑은 표시용 구조(KPI 카드 + 섹션). .pdf/.docx 파일
 * 렌더링은 프론트에서 이 구조를 입력으로 별도 처리한다(현재는 미구현).
 */
import { callFunction } from './csv-client'
import type { GenerateReportData, ISODate, ReportFmt, ReportType } from '../types'

export interface ReportKpiCard {
  label: string
  value: string
  delta: string
}

export interface ReportFunnel {
  imps: number
  clicks: number
  conv: number
  ctr: number
  cvr: number
  text: string
}

interface ReportSectionBase {
  no: number
  title: string
}

export interface ReportSectionParagraphs extends ReportSectionBase {
  kind: 'paragraphs'
  body: string[]
}

export interface ReportSectionList extends ReportSectionBase {
  kind: 'list'
  body: string[]
}

export interface ReportSectionFunnel extends ReportSectionBase {
  kind: 'funnel'
  body: ReportFunnel
}

export interface ReportSectionTable extends ReportSectionBase {
  kind: 'table'
  body: { headers: string[]; rows: string[][] }
  footnote?: string
}

export type ReportSection =
  | ReportSectionParagraphs
  | ReportSectionList
  | ReportSectionFunnel
  | ReportSectionTable

export interface GeneratedReport {
  brand: string
  reportType: ReportType
  fmt: ReportFmt
  dateStart: ISODate
  dateEnd: ISODate
  generatedAt: string
  title: string
  periodLabel: string
  kpiCards: ReportKpiCard[]
  sections: ReportSection[]
  /** 분석 원본. UI는 kpiCards/sections로 렌더하므로 상세 타입은 생략한다. */
  analysis: Record<string, unknown>
}

export function generateReport(
  data: GenerateReportData,
): Promise<GeneratedReport> {
  return callFunction<GenerateReportData, GeneratedReport>('generateReport', data)
}

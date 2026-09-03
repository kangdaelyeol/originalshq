/**
 * 보고서 KPI 카드 + 섹션 구성 — Python `src/reports/sections.py`의 `kpi_cards` / `sections` 이관.
 *
 * PDF·DOCX 등 렌더러가 공통으로 소비하는 표시 구조를 `build_analysis` 결과에서 뽑아낸다.
 * 렌더러는 이 구조만 알면 되고 분석 로직은 몰라도 된다.
 *
 * NOTE: 원본 `sections.py`가 현재 저장소에 없어 analyzer 결과(BuildAnalysisResult)의
 * 필드로부터 섹션 구성을 복원했다. 섹션 순서·제목·문구가 원본과 다를 수 있으며,
 * 원본을 확보하면 이 파일만 맞추면 된다. 섹션 번호(`no`)는 실제 출력되는 섹션 기준으로
 * 1부터 순번을 매긴다(건너뛴 섹션이 있어도 번호가 비지 않음).
 */
import type { BuildAnalysisResult, Funnel } from './analyzer'
import { fmtInt, pctChange, pctStr, won } from '../utils/matrix'

// --------------------------------------------------------------------------- //
// 타입
// --------------------------------------------------------------------------- //
export interface KpiCard {
  label: string
  value: string
  delta: string
}

export interface SectionParagraphs {
  no: number
  title: string
  kind: 'paragraphs'
  body: string[]
}

export interface SectionList {
  no: number
  title: string
  kind: 'list'
  body: string[]
}

export interface SectionFunnel {
  no: number
  title: string
  kind: 'funnel'
  body: Funnel
}

export interface SectionTable {
  no: number
  title: string
  kind: 'table'
  body: { headers: string[]; rows: string[][] }
  footnote?: string
}

export type ReportSection =
  | SectionParagraphs
  | SectionList
  | SectionFunnel
  | SectionTable

// --------------------------------------------------------------------------- //
// 헬퍼
// --------------------------------------------------------------------------- //

/** KPI 카드용 증감 표기 — 직전 기간이 없으면 "–". */
const delta = (cur: number, prev: number): string => {
  const c = pctChange(cur, prev)
  return c === null ? '–' : pctStr(c, 1)
}

const pctText = (x: number, digits = 2): string => `${x.toFixed(digits)}%`

// --------------------------------------------------------------------------- //
// kpi_cards
// --------------------------------------------------------------------------- //
export const kpiCards = (ana: BuildAnalysisResult): KpiCard[] => {
  const { cur, prev } = ana
  const cards: KpiCard[] = [
    { label: '광고비', value: won(cur.cost), delta: delta(cur.cost, prev.cost) },
    {
      label: '전환',
      value: `${fmtInt(cur.conv)}건`,
      delta: delta(cur.conv, prev.conv),
    },
    { label: 'CPA', value: won(cur.cpa), delta: delta(cur.cpa, prev.cpa) },
    { label: 'CTR', value: pctText(cur.ctr), delta: delta(cur.ctr, prev.ctr) },
  ]

  if (ana.has_revenue) {
    cards.push({
      label: '통합 매출',
      value: won(ana.report_revenue),
      delta: delta(ana.report_revenue, ana.report_revenue_prev),
    })
    cards.push({
      label: '통합 ROAS',
      value: pctText(ana.report_roas, 1),
      delta: delta(ana.report_roas, ana.report_roas_prev),
    })
  } else {
    cards.push({
      label: 'MORTAR SCORE',
      value: `${ana.mortar.score}점 (${ana.mortar.grade})`,
      delta: '',
    })
  }

  return cards
}

// --------------------------------------------------------------------------- //
// sections
// --------------------------------------------------------------------------- //
export const sections = (ana: BuildAnalysisResult): ReportSection[] => {
  const out: ReportSection[] = []
  let no = 0

  const para = (title: string, body: string[]): void => {
    const lines = body.filter((l) => String(l).trim())
    if (lines.length) {
      out.push({ no: ++no, title, kind: 'paragraphs', body: lines })
    }
  }
  const list = (title: string, body: string[]): void => {
    if (body.length) out.push({ no: ++no, title, kind: 'list', body })
  }

  para('종합 요약 (Executive Summary)', ana.exec_summary)
  para('예산 운영 평가', ana.budget_eval)
  list('채널별 기여도 분석', ana.channel_analysis)

  out.push({ no: ++no, title: '전환 퍼널', kind: 'funnel', body: ana.funnel })

  if (ana.weekly_trend.length) {
    out.push({
      no: ++no,
      title: '주차별 성과 추이',
      kind: 'table',
      body: {
        headers: ['기간', '노출', '클릭', 'CTR', 'CPC', '광고비', '전환', 'CPA'],
        rows: ana.weekly_trend.map((w) => [
          w.label,
          fmtInt(w.imps),
          fmtInt(w.clicks),
          pctText(w.ctr),
          won(w.cpc),
          won(w.cost),
          fmtInt(w.conv),
          won(w.cpa),
        ]),
      },
    })
  }

  if (ana.weekday_perf.length) {
    out.push({
      no: ++no,
      title: '요일별 성과',
      kind: 'table',
      body: {
        headers: ['요일', '광고비', '전환', 'CTR', 'CPA'],
        rows: ana.weekday_perf.map((w) => [
          `${w.day}요일`,
          won(w.cost),
          fmtInt(w.conv),
          pctText(w.ctr),
          won(w.cpa),
        ]),
      },
      footnote: ana.weekday_comment || undefined,
    })
  }

  if (ana.blended.available) {
    para('통합(블렌디드) 성과', [
      ana.blended.summary ?? '',
      ana.blended.note ?? '',
    ])
  }

  if (ana.goal_type_changes.length) {
    para(
      '결과유형(전환 정의) 변경',
      ana.goal_type_changes.map((g) => g.text),
    )
  }

  if (ana.alerts.length) {
    list(
      '이상 징후 알림',
      ana.alerts.map((a) => `[${a.severity}] ${a.title} — ${a.message}`),
    )
  }

  para('MORTAR SCORE', [
    `${ana.mortar.score}점 (${ana.mortar.grade})`,
    ...ana.opportunity_score.reasons,
  ])

  list('액션 플랜', ana.action_plan)

  para('매체 운영 현황 (수기 입력)', [ana.manual_media_status])
  para('다음 기간 계획 (수기 입력)', [ana.manual_next_plan])

  return out
}

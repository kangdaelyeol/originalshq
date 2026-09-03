/**
 * 보고서 분석 엔진 — Python `src/reports/analyzer.py` 이관.
 *
 * 원칙 (세션 축적 피드백 반영):
 *   - 구조: 분석 → 문제점 → 해결안 → 인사이트. 데이터 나열 금지.
 *   - Executive Summary는 수치 반복이 아니라 서술형(세팅 완료 / 학습 시작 / 첫 전환 / 어느 매체가 먼저 반응).
 *   - "권장합니다" 금지 — 운영 주체가 우리이므로 "~하겠습니다". 클라이언트 협조 항목만 "요청드립니다".
 *   - 비교기간이 없으면 +0% 금지 → 절대값 중심 서술.
 *   - 운영 7일 이하: "학습 초기 단계" 명시, 예산 확대 제안 금지, 성과 확정 표현 금지.
 *   - 매출 데이터가 없으면 ROAS 언급 자체를 차단, CPA·CTR·CPC 중심.
 *   - 커머스 브랜드(commerceChannels): 블렌디드 매출/ROAS로 평가. 매체 자체 리포트 매출과
 *     스마트스토어 매출을 합산하지 않는다(같은 돈의 중복 집계).
 *   - 결과유형(전환 정의)이 기간 사이에 바뀌면 CPA/전환 증감 비교를 "비교불가"라 쓰지 않고
 *     바뀐 이유(스마트스토어 이관 → 픽셀 추적 불가 → 목표 변경)를 서술한다.
 *
 * 구현 메모: Firestore는 서버측 SUM/GROUP BY가 없으므로 Python의 `_agg`(SQL 집계) 대신
 * 필요한 구간의 performance 문서를 한 번에 읽어와(`fetchPerfRows`) 메모리에서 합산한다.
 * engine.ts의 `windowStats`와 같은 패턴.
 */
import { calcMortarScore } from '../analysis'
import type { MortarScoreResult } from '../analysis'
import { alertsCol, brandsCol, fetchPerfRows, perfCol } from '../data/firestore'
import type { AlertSeverity, BrandDoc, ReportType } from '../data/firestore'
import type { ParsedRow } from '../csv/parse-result'
import { addDays, diffDays, weekdayKo } from '../utils/dates'
import { derive, fmtInt, pctChange, pctStr, won } from '../utils/matrix'
import { ChannelKo, type ISODate } from '../types'
import { trailingMonthWeeks, weeksCoveringRange } from './week-utils'
import type { WeekSpan } from './week-utils'

const CHANNEL_NOTE: Record<string, string> = {
  meta: 'Meta는 머신러닝 기반 전환 최적화가 진행되는 매체로, 예산 20% 이상 변경 시 학습이 리셋됩니다.',
  google: 'Google은 검색 의도가 높은 사용자의 유입 비중이 큰 매체입니다.',
  naver:
    '네이버 검색광고는 브랜드·비교 탐색 단계의 유입 비중이 높아 초기 CPA가 높게 나타날 수 있습니다.',
  daangn: '당근은 지역 기반 노출 매체로 도달·클릭 중심으로 성과를 해석합니다.',
}

// --------------------------------------------------------------------------- //
// 반환 타입
// --------------------------------------------------------------------------- //
export interface Agg {
  cost: number
  clicks: number
  imps: number
  conv: number
  rev: number
  ctr: number
  cpc: number
  cpm: number
  cpa: number
  roas: number
}

export interface Blended {
  available: boolean
  channels?: string[]
  revenue?: number
  orders?: number
  revenue_prev?: number
  orders_prev?: number
  total_ad_cost?: number
  total_ad_cost_prev?: number
  roas?: number
  roas_prev?: number
  cps?: number
  ad_conv?: number
  summary?: string
  note?: string
}

export interface GoalTypeChange {
  channel: string
  cur: string
  prev: string
  text: string
}

export interface Funnel {
  imps: number
  clicks: number
  conv: number
  ctr: number
  cvr: number
  text: string
}

export interface WeeklyTrendEntry {
  label: string
  start: ISODate
  end: ISODate
  imps: number
  clicks: number
  ctr: number
  cpc: number
  cost: number
  conv: number
  cpa: number
}

export interface WeekdayPerf {
  day: string
  cost: number
  conv: number
  ctr: number
  cpa: number
}

export interface AnalysisAlert {
  title: string
  message: string
  severity: AlertSeverity
}

export interface BuildAnalysisResult {
  brand: string
  industry: string
  main_kpi: string
  report_type: ReportType
  date_start: ISODate
  date_end: ISODate
  prev_start: ISODate
  prev_end: ISODate
  span_days: number
  op_days: number
  is_new_account: boolean
  has_prev: boolean
  has_revenue: boolean
  multi_channel: boolean
  ad_channels: string[]
  cur: Agg
  prev: Agg
  channel_cur: Record<string, Agg>
  channel_prev: Record<string, Agg>
  report_revenue: number
  report_roas: number
  report_revenue_prev: number
  report_roas_prev: number
  blended: Blended
  goal_type_changes: GoalTypeChange[]
  mortar: MortarScoreResult
  opportunity_score: {
    score: number
    grade: MortarScoreResult['grade']
    reasons: string[]
  }
  exec_summary: string[]
  budget_eval: string[]
  channel_analysis: string[]
  funnel: Funnel
  weekly_trend: WeeklyTrendEntry[]
  weekday_perf: WeekdayPerf[]
  weekday_comment: string
  action_plan: string[]
  manual_media_status: string
  manual_next_plan: string
  alerts: AnalysisAlert[]
}

// --------------------------------------------------------------------------- //
// 내부 헬퍼
// --------------------------------------------------------------------------- //

/** `CHANNEL_KO.get(c, c)` — 매핑 없으면 원문 그대로. */
const chKo = (c: string): string =>
  (ChannelKo as Record<string, string>)[c] ?? c

/** Python `_fmt_change` — 직전 기간이 없으면 문구, 있으면 `+1.2%`. */
const fmtChange = (cur: number, prev: number, unit = ''): string => {
  const c = pctChange(cur, prev)
  if (c === null) return '직전 기간 데이터 없음'
  return `${pctStr(c, 1)}${unit}`
}

/**
 * Python `_agg` — rows(메모리)를 [start,end] + (선택)channel로 필터해 합계/파생지표.
 * ISO 문자열 날짜는 사전식 비교가 곧 날짜 비교다.
 */
const agg = (
  rows: ParsedRow[],
  startISO: ISODate,
  endISO: ISODate,
  channel: string | null = null,
): Agg => {
  let cost = 0
  let clicks = 0
  let imps = 0
  let conv = 0
  let rev = 0
  for (const r of rows) {
    if (r.date < startISO || r.date > endISO) continue
    if (channel && r.channel !== channel) continue
    cost += r.cost || 0
    clicks += r.clicks || 0
    imps += r.impressions || 0
    conv += r.conversion || 0
    rev += r.revenue || 0
  }
  const d = derive({ cost, clicks, imps, conv, rev })
  return {
    cost,
    clicks,
    imps,
    conv,
    rev,
    ctr: d.ctr,
    cpc: d.cpc,
    cpm: d.cpm,
    cpa: d.cpa,
    roas: d.roas,
  }
}

/** Python `_dominant_result_type` — 비용 합이 가장 큰 결과유형(전환 정의). 없으면 null. */
const dominantResultType = (
  rows: ParsedRow[],
  channel: string,
  startISO: ISODate,
  endISO: ISODate,
): string | null => {
  const byType = new Map<string, number>()
  for (const r of rows) {
    if (r.date < startISO || r.date > endISO) continue
    if (r.channel !== channel) continue
    const rt = r.result_type
    if (!rt) continue // null / "" 제외
    byType.set(rt, (byType.get(rt) ?? 0) + (r.cost || 0))
  }
  if (byType.size === 0) return null
  let best: string | null = null
  let bestCost = -Infinity
  for (const [rt, c] of byType) {
    if (c > bestCost) {
      bestCost = c
      best = rt
    }
  }
  return best
}

// --------------------------------------------------------------------------- //
// build_analysis
// --------------------------------------------------------------------------- //
export const buildAnalysis = async (
  brandId: string | number,
  dateStart: ISODate,
  dateEnd: ISODate,
  reportType: ReportType = 'weekly',
  notes = '',
  nextPlanNote = '',
): Promise<BuildAnalysisResult> => {
  const brandSnap = await brandsCol().doc(String(brandId)).get()
  if (!brandSnap.exists) throw new Error(`브랜드 ${brandId} 없음`)
  const brand = brandSnap.data() as BrandDoc

  const spanDays = diffDays(dateStart, dateEnd) + 1
  const prevEnd = addDays(dateStart, -1)
  const prevStart = addDays(prevEnd, -(spanDays - 1))

  // 주차별 추이 구간 (weekly=최근 4주, monthly=범위를 덮는 주들)
  const weeks: WeekSpan[] =
    reportType === 'monthly'
      ? weeksCoveringRange(dateStart, dateEnd)
      : trailingMonthWeeks(dateEnd, 4)

  // 한 번에 읽어올 구간: 직전 기간과 주차 추이의 가장 이른 시작일까지 포괄
  const windowStart = [prevStart, ...weeks.map((w) => w.start)].reduce(
    (a, b) => (a < b ? a : b),
  )
  const rows = await fetchPerfRows(brandId, windowStart, dateEnd)

  const cur = agg(rows, dateStart, dateEnd)
  const prv = agg(rows, prevStart, prevEnd)

  // 실제 운영일수(데이터가 존재하는 날) — "운영 7일 이하 = 학습 초기" 판정용.
  const opSnap = await perfCol(brandId)
    .where('date', '<=', dateEnd)
    .select('date')
    .get()
  const opDays = new Set(opSnap.docs.map((d) => d.get('date') as string)).size

  const activeChannels = [
    ...new Set(
      rows
        .filter((r) => r.date >= dateStart && r.date <= dateEnd)
        .map((r) => r.channel),
    ),
  ]
  const commerceChannels: string[] = brand.commerceChannels ?? []
  const adChannels = activeChannels.filter((c) => !commerceChannels.includes(c))
  const multiChannel = adChannels.length > 1

  const chCur: Record<string, Agg> = {}
  const chPrv: Record<string, Agg> = {}
  for (const c of activeChannels) {
    chCur[c] = agg(rows, dateStart, dateEnd, c)
    chPrv[c] = agg(rows, prevStart, prevEnd, c)
  }

  // ---------- 블렌디드 (커머스 브랜드) ----------
  const blended: Blended = { available: false }
  if (commerceChannels.length) {
    const sumBy = (
      m: Record<string, Agg>,
      chans: string[],
      k: keyof Agg,
    ): number => chans.reduce((s, c) => s + (m[c]?.[k] ?? 0), 0)

    const comRev = sumBy(chCur, commerceChannels, 'rev')
    const comOrders = sumBy(chCur, commerceChannels, 'conv')
    const comRevPrev = sumBy(chPrv, commerceChannels, 'rev')
    const comOrdersPrev = sumBy(chPrv, commerceChannels, 'conv')
    const totalAdCost = sumBy(chCur, adChannels, 'cost')
    const totalAdCostPrev = sumBy(chPrv, adChannels, 'cost')
    const adConv = sumBy(chCur, adChannels, 'conv')

    if (comRev > 0 || comOrders > 0) {
      const koList = commerceChannels.map((c) => chKo(c))
      const roas = totalAdCost ? (comRev / totalAdCost) * 100 : 0
      const cps = comOrders ? totalAdCost / comOrders : 0
      blended.available = true
      blended.channels = koList
      blended.revenue = comRev
      blended.orders = comOrders
      blended.revenue_prev = comRevPrev
      blended.orders_prev = comOrdersPrev
      blended.total_ad_cost = totalAdCost
      blended.total_ad_cost_prev = totalAdCostPrev
      blended.roas = roas
      blended.roas_prev = totalAdCostPrev
        ? (comRevPrev / totalAdCostPrev) * 100
        : 0
      blended.cps = cps
      blended.ad_conv = adConv
      blended.summary =
        `이번 기간 ${koList.join(', ')} ` +
        `매출은 ${won(comRev)}, 구매건수 ${fmtInt(comOrders)}건, ` +
        `전체 광고비는 ${won(totalAdCost)}으로 집계되었으며, ` +
        `통합 ROAS는 ${roas.toFixed(1)}%, ` +
        `CPS는 ${won(cps)}을 기록하였습니다.`
      blended.note =
        '결제가 스마트스토어에서 발생해 광고 매체 자체 전환 추적이 되지 않으므로, ' +
        '매체별 ROAS 대신 전체 광고비 대비 통합 매출 기준으로 성과를 평가합니다. ' +
        '매체별 기여는 전환수 기준으로 표기합니다.'
    }
  }

  // 보고서에서 쓸 매출/ROAS — 커머스면 블렌디드, 아니면 매체 리포트 값
  const reportRevenue = blended.available ? (blended.revenue ?? 0) : cur.rev
  const reportRoas = blended.available ? (blended.roas ?? 0) : cur.roas
  const reportRevenuePrev = blended.available
    ? (blended.revenue_prev ?? 0)
    : prv.rev
  const reportRoasPrev = blended.available ? (blended.roas_prev ?? 0) : prv.roas
  const hasRevenue = reportRevenue > 0

  // ---------- 결과유형 변경 감지 ----------
  const goalTypeChanges: GoalTypeChange[] = []
  for (const c of adChannels) {
    const curRt = dominantResultType(rows, c, dateStart, dateEnd)
    const prvRt = dominantResultType(rows, c, prevStart, prevEnd)
    if (curRt && prvRt && curRt !== prvRt) {
      goalTypeChanges.push({
        channel: c,
        cur: curRt,
        prev: prvRt,
        text:
          `${chKo(c)}는 이번 기간 '${curRt}'를 결과 기준으로, ` +
          `직전 기간은 '${prvRt}'를 기준으로 운영했습니다. ` +
          '결제 페이지가 스마트스토어로 이관되며 픽셀이 실제 구매를 추적할 수 없게 되어 ' +
          '운영 목표를 변경한 것으로, 두 기간의 CPA·전환 수치는 서로 다른 행동을 세고 있어 ' +
          '증감 비교가 실제 효율 변화를 의미하지 않습니다. 성과는 통합(블렌디드) 지표로 판단합니다.',
      })
    }
  }

  // ---------- MORTAR SCORE ----------
  const ms = await calcMortarScore(brandId, dateEnd, Math.min(spanDays, 14))

  const isNew = opDays <= 7
  const hasPrev = prv.cost > 0

  // ---------- Executive Summary ----------
  const execLines: string[] = []
  if (isNew) {
    let firstCh: string | null = null
    let firstConv = -Infinity
    for (const [c, s] of Object.entries(chCur)) {
      if (s.conv > firstConv) {
        firstConv = s.conv
        firstCh = c
      }
    }
    let share = ''
    if (firstCh && cur.conv) {
      const pct = (chCur[firstCh].conv / cur.conv) * 100
      share = ` ${chKo(firstCh)}에서 전체 전환의 ${pct.toFixed(0)}%가 발생하며 초기 성과를 확인했습니다.`
    }
    execLines.push(
      '이번 기간은 광고 계정 세팅 및 초기 학습이 진행된 운영 초기 주차입니다. ' +
        `총 ${fmtInt(cur.conv)}건의 전환이 발생했으며,${share} ` +
        '현재는 머신러닝 학습 단계로, 다음 주부터 데이터 안정화가 예상됩니다.',
    )
  } else if (!hasPrev) {
    execLines.push(
      '직전 기간 비교 데이터가 없어 절대값 중심으로 분석했습니다. ' +
        `이번 기간 광고비 ${won(cur.cost)}, 전환 ${fmtInt(cur.conv)}건, ` +
        `클릭 ${fmtInt(cur.clicks)}회가 집계되었습니다.`,
    )
  } else {
    const parts = [`광고비 ${fmtChange(cur.cost, prv.cost)}`]
    parts.push(`전환 ${fmtChange(cur.conv, prv.conv)}`)
    if (goalTypeChanges.length === 0) {
      parts.push(`CPA ${fmtChange(cur.cpa, prv.cpa)}`)
    }
    execLines.push('전기 대비 ' + parts.join(', ') + '의 흐름을 보였습니다.')
    if (hasRevenue) {
      execLines.push(
        `통합 매출은 ${won(reportRevenue)}` +
          (reportRevenuePrev
            ? ` (${fmtChange(reportRevenue, reportRevenuePrev)})`
            : '') +
          `, 통합 ROAS ${reportRoas.toFixed(1)}%를 기록했습니다.`,
      )
    } else {
      execLines.push(
        '매출 연동 데이터가 충분하지 않아 이번 기간은 CPA·CTR·전환 중심으로 평가했습니다.',
      )
    }
  }

  // ---------- 예산 운영 평가 ----------
  const budgetLines: string[] = []
  const costChg = pctChange(cur.cost, prv.cost)
  if (costChg !== null && costChg >= 30) {
    budgetLines.push(
      `광고비가 전기 대비 ${pctStr(costChg)} 증가했습니다. ` +
        '예산 확대 대비 성과 유지 여부를 지속 모니터링하겠습니다.',
    )
    for (const c of adChannels) {
      const cc = pctChange(chCur[c].cost, chPrv[c].cost)
      if (cc !== null && cc >= 20) {
        budgetLines.push(
          `${chKo(c)}는 예산이 ${pctStr(cc)} 변동되어 ` +
            '학습이 재탐색 단계에 들어갔을 가능성이 있습니다.',
        )
      }
    }
  } else if (costChg !== null && costChg <= -30) {
    budgetLines.push(
      `광고비가 전기 대비 ${pctStr(costChg)} 감소했습니다. ` +
        '노출 감소에 따른 전환 감소 가능성을 함께 고려해 배분을 조정하겠습니다.',
    )
  } else {
    budgetLines.push(
      `이번 기간 광고비는 ${won(cur.cost)}으로, 전기와 유사한 수준에서 운영했습니다.`,
    )
  }

  // ---------- 채널별 기여도 ----------
  const channelLines: string[] = []
  for (const c of [...adChannels].sort(
    (a, b) => chCur[b].cost - chCur[a].cost,
  )) {
    const s = chCur[c]
    const share = cur.conv ? (s.conv / cur.conv) * 100 : 0
    channelLines.push(
      `${chKo(c)} · 광고비 ${won(s.cost)} / 전환 ${fmtInt(s.conv)}건` +
        `(전체의 ${share.toFixed(0)}%) / CTR ${s.ctr.toFixed(2)}% / CPA ${won(s.cpa)}`,
    )
    const note = CHANNEL_NOTE[c]
    if (note) channelLines.push('  └ ' + note)
    for (const g of goalTypeChanges) {
      if (g.channel === c) channelLines.push('  └ ' + g.text)
    }
  }

  // ---------- 전환 퍼널 ----------
  const cvr = cur.clicks ? (cur.conv / cur.clicks) * 100 : 0
  const funnel: Funnel = {
    imps: cur.imps,
    clicks: cur.clicks,
    conv: cur.conv,
    ctr: cur.ctr,
    cvr,
    text:
      `노출 ${fmtInt(cur.imps)} → 클릭 ${fmtInt(cur.clicks)} (CTR ${cur.ctr.toFixed(2)}%) ` +
      `→ 전환 ${fmtInt(cur.conv)} (CVR ${cvr.toFixed(2)}%)`,
  }

  // ---------- 주차별 성과 추이 ----------
  const weeklyTrend: WeeklyTrendEntry[] = weeks.map((wk) => {
    const w = agg(rows, wk.start, wk.end)
    return {
      label: wk.label,
      start: wk.start,
      end: wk.end,
      imps: w.imps,
      clicks: w.clicks,
      ctr: w.ctr,
      cpc: w.cpc,
      cost: w.cost,
      conv: w.conv,
      cpa: w.cpa,
    }
  })

  // ---------- 요일별 성과 ----------
  interface WdAcc {
    cost: number
    clicks: number
    imps: number
    conv: number
  }
  const wd = new Map<string, WdAcc>()
  for (const r of rows) {
    if (r.date < dateStart || r.date > dateEnd) continue
    const k = weekdayKo(r.date)
    const v = wd.get(k) ?? { cost: 0, clicks: 0, imps: 0, conv: 0 }
    v.cost += r.cost || 0
    v.clicks += r.clicks || 0
    v.imps += r.impressions || 0
    v.conv += r.conversion || 0
    wd.set(k, v)
  }
  const weekdayPerf: WeekdayPerf[] = []
  for (const k of '월화수목금토일') {
    const v = wd.get(k)
    if (!v) continue
    weekdayPerf.push({
      day: k,
      cost: v.cost,
      conv: v.conv,
      ctr: v.imps ? (v.clicks / v.imps) * 100 : 0,
      cpa: v.conv ? v.cost / v.conv : 0,
    })
  }
  let wdComment = ''
  if (weekdayPerf.length) {
    const paid = weekdayPerf.filter((w) => w.cpa > 0)
    if (paid.length) {
      const best = paid.reduce((a, b) => (b.cpa < a.cpa ? b : a))
      const worst = paid.reduce((a, b) => (b.cpa > a.cpa ? b : a))
      wdComment =
        `${best.day}요일 CPA ${won(best.cpa)}로 가장 효율이 높았고, ` +
        `${worst.day}요일이 ${won(worst.cpa)}로 상대적으로 저조했습니다.`
    }
  }

  // ---------- 액션 플랜 (항상 3~5개, 우선순위 고정) ----------
  const actions: string[] = []
  // ① 광고 운영
  if (goalTypeChanges.length) {
    actions.push(
      '전환 정의가 변경된 매체는 통합(블렌디드) 지표로 성과를 관리하고, ' +
        '픽셀/전환 이벤트 복구 방안을 점검하겠습니다.',
    )
  }
  let worstCh: string | null = null
  let worstCpa = -Infinity
  for (const c of adChannels) {
    if (chCur[c].cpa > worstCpa) {
      worstCpa = chCur[c].cpa
      worstCh = c
    }
  }
  if (worstCh && chCur[worstCh].cpa > 0) {
    actions.push(
      `${chKo(worstCh)}의 저효율 캠페인·키워드를 ` +
        '단위별로 분리해 입찰가와 예산을 조정하겠습니다.',
    )
  }
  // ② 소재
  actions.push(
    '성과 상위 소재 중심으로 예산을 집중하고, 하위 소재는 단계적으로 교체하겠습니다 ' +
      '(한 번에 다수 변경 시 학습이 재설정되므로 순차 진행).',
  )
  // ③ 랜딩페이지
  actions.push(
    '랜딩페이지의 후기·CTA·상품 상세를 점검해 클릭 이후 전환율(CVR) 개선을 진행하겠습니다.',
  )
  // ④ 트래킹 (클라이언트 협조 필요 → 요청형)
  if (!hasRevenue) {
    actions.push(
      '정확한 매출·ROAS 산출을 위해 GA4/픽셀 구매 이벤트 연동 상태 점검에 대한 ' +
        '협조를 요청드립니다.',
    )
  }
  // ⑤ 신규 테스트
  if (!isNew) {
    actions.push(
      '현재 효율이 확인된 매체를 대상으로 신규 타겟·소재 A/B 테스트를 준비하겠습니다.',
    )
  }
  const actionPlan = actions.slice(0, 5)
  if (actionPlan.length < 3) {
    actionPlan.push(
      '다음 주 데이터 확보 후 소재·타겟 효율을 재평가해 최적화를 진행하겠습니다.',
    )
  }

  // ---------- 미확인 알림 ----------
  const alertSnap = await alertsCol(brandId)
    .where('isRead', '==', 0)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get()
  const alerts: AnalysisAlert[] = alertSnap.docs.map((d) => {
    const x = d.data() as Record<string, unknown>
    return {
      title: String(x.title ?? ''),
      message: String(x.message ?? ''),
      severity: (x.severity as AlertSeverity) ?? 'info',
    }
  })

  return {
    brand: brand.name,
    industry: brand.industry || '',
    main_kpi: brand.mainKpi || 'CPA',
    report_type: reportType,
    date_start: dateStart,
    date_end: dateEnd,
    prev_start: prevStart,
    prev_end: prevEnd,
    span_days: spanDays,
    op_days: opDays,
    is_new_account: isNew,
    has_prev: hasPrev,
    has_revenue: hasRevenue,
    multi_channel: multiChannel,
    ad_channels: adChannels,
    cur,
    prev: prv,
    channel_cur: chCur,
    channel_prev: chPrv,
    report_revenue: reportRevenue,
    report_roas: reportRoas,
    report_revenue_prev: reportRevenuePrev,
    report_roas_prev: reportRoasPrev,
    blended,
    goal_type_changes: goalTypeChanges,
    mortar: ms,
    opportunity_score: {
      score: ms.score,
      grade: ms.grade,
      reasons: ms.reasons,
    },
    exec_summary: execLines,
    budget_eval: budgetLines,
    channel_analysis: channelLines,
    funnel,
    weekly_trend: weeklyTrend,
    weekday_perf: weekdayPerf,
    weekday_comment: wdComment,
    action_plan: actionPlan,
    manual_media_status: (notes || '').trim(),
    manual_next_plan: (nextPlanNote || '').trim(),
    alerts,
  }
}

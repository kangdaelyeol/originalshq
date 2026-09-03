/**
 * 룰 기반 분석 엔진 — Python `src/analysis/engine.py` 이관.
 * 이상 징후 감지(Alert) + MORTAR SCORE.
 *
 * 절대 규칙: 비교 기준일은 `todayISO()`가 아니라 `refDate`(임포트된 데이터의 최신일 /
 * 보고서 종료일)로 앵커링한다. MIP는 과거 CSV 후행 업로드 방식이라 today 고정이면
 * 알림이 조용히 안 뜬다. 대시보드 등 "지금" 화면만 기본값(오늘)을 쓴다.
 */
import { addDays, todayISO } from '../utils/dates'
import { won, pctStr } from '../utils/matrix'
import { alertsCol, fetchPerfRows, FieldValue } from '../data/firestore'
import type { AlertDoc, AlertSeverity } from '../data/firestore'
import type { DetectedChannel } from '../csv/channel'
import type { ParsedRow } from '../csv/parse-result'
import { AlertType, Channel, ISODate, WindowStats } from '../types'
import {
  CONV_DOWN_PCT,
  COST_UP_PCT,
  CPA_IMPROVE_PCT,
  CPA_SURGE_PCT,
  CTR_DROP_PCT,
} from '../constants'

function pct(cur: number, prev: number): number | null {
  if (!prev) return null
  return ((cur - prev) / prev) * 100
}

/** rows(메모리) 를 [start,end] + channel 로 필터해 합계/지표. Python `_window_stats`. */
function windowStats(
  rows: ParsedRow[],
  channel: DetectedChannel | null,
  startISO: ISODate,
  endISO: ISODate,
): WindowStats {
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
  return {
    cost,
    clicks,
    imps,
    conv,
    rev,
    ctr: imps ? (clicks / imps) * 100 : 0,
    cpa: conv ? cost / conv : 0,
    roas: cost ? (rev / cost) * 100 : 0,
  }
}



/**
 * NOTE: firestore.ts의 AlertDoc 스키마 주석에는 brandId가 없었는데, 여기서는 매 알림에
 * brandId를 채워 넣는다. 서브컬렉션(brands/{brandId}/alerts)이라 상위 문서 ID로도 알 수
 * 있어 중복이지만, 쿼리 편의(collectionGroup 등)를 위한 의도적 비정규화로 보인다.
 * firestore.ts의 스키마 주석/AlertDoc 정의도 이에 맞춰 업데이트가 필요하다.
 */
interface AlertInsert extends Omit<AlertDoc, 'alertType'> {
  brandId: string
  alertType: AlertType
}

/**
 * refDate 기준 최근 N일 vs 직전 N일을 매체별로 비교해 Alert를 생성한다.
 * 같은 (채널, 유형)의 미확인 알림이 이미 있으면 새로 만들지 않는다.
 * @returns 새로 생성된 알림 수
 */
export const runAlertCheck = async (
  brandId: string | number,
  refDate: ISODate | null = null,
  periodLen = 7,
): Promise<number> => {
  const ref = refDate || todayISO()
  const curStart = addDays(ref, -(periodLen - 1))
  const prevEnd = addDays(curStart, -1)
  const prevStart = addDays(prevEnd, -(periodLen - 1))

  const rows = await fetchPerfRows(brandId, prevStart, ref)

  const openSnap = await alertsCol(brandId).where('isRead', '==', 0).get()
  const openKeys = new Set(
    openSnap.docs.map((d) => `${d.get('channel')}|${d.get('alertType')}`),
  )

  const present: DetectedChannel[] = [...new Set(rows.map((r) => r.channel))]
  const channels: readonly DetectedChannel[] = present.length
    ? present
    : Channel

  const newAlerts: AlertInsert[] = []
  const add = (
    ch: DetectedChannel,
    atype: AlertType,
    severity: AlertSeverity,
    title: string,
    msg: string,
  ): void => {
    const k = `${ch}|${atype}`
    if (openKeys.has(k)) return
    openKeys.add(k)
    newAlerts.push({
      brandId: String(brandId),
      channel: ch,
      alertType: atype,
      severity,
      title,
      message: msg,
      refDate: ref,
      isRead: 0,
      createdAt: FieldValue.serverTimestamp(),
    })
  }

  for (const ch of channels) {
    const cur = windowStats(rows, ch, curStart, ref)
    const prv = windowStats(rows, ch, prevStart, prevEnd)
    if (cur.cost === 0 && prv.cost === 0) continue

    const cpaChg = pct(cur.cpa, prv.cpa)
    const ctrChg = pct(cur.ctr, prv.ctr)
    const costChg = pct(cur.cost, prv.cost)
    const convChg = pct(cur.conv, prv.conv)
    const U = ch.toUpperCase()

    if (cpaChg != null && cpaChg >= CPA_SURGE_PCT && cur.conv >= 3) {
      add(
        ch,
        'CPA_SURGE',
        'critical',
        `${U} CPA 급등`,
        `전기 대비 CPA ${pctStr(cpaChg)} (${won(prv.cpa)} → ${won(cur.cpa)}). ` +
          '전환경로·소재·랜딩 점검이 필요합니다.',
      )
    } else if (cpaChg != null && cpaChg <= CPA_IMPROVE_PCT && cur.conv >= 3) {
      add(
        ch,
        'CPA_IMPROVE',
        'info',
        `${U} CPA 개선`,
        `전기 대비 CPA ${pctStr(cpaChg)}. 현재 구조를 유지하며 운영합니다.`,
      )
    }

    if (ctrChg != null && ctrChg <= CTR_DROP_PCT && cur.imps >= 500) {
      add(
        ch,
        'CTR_DROP',
        'warn',
        `${U} CTR 감소 — 소재 피로도 의심`,
        `전기 대비 CTR ${pctStr(ctrChg)} (${prv.ctr.toFixed(2)}% → ${cur.ctr.toFixed(2)}%).`,
      )
    }

    if (
      costChg != null &&
      costChg >= COST_UP_PCT &&
      convChg != null &&
      convChg <= CONV_DOWN_PCT
    ) {
      add(
        ch,
        'INEFFICIENCY',
        'warn',
        `${U} 비용 증가 + 전환 감소`,
        `비용 ${pctStr(costChg)} / 전환 ${pctStr(convChg)}. 예산 배분과 소재를 점검합니다.`,
      )
    }
  }

  if (newAlerts.length) {
    const batch = alertsCol(brandId).firestore.batch()
    for (const a of newAlerts) batch.set(alertsCol(brandId).doc(), a)
    await batch.commit()
  }
  return newAlerts.length
}

export interface MortarScoreResult {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  reasons: string[]
  cur: WindowStats
  prev: WindowStats
  ref_date: ISODate
}

/**
 * MORTAR SCORE — 0~100. 근거(reasons)를 함께 반환. Python `calc_mortar_score`.
 */
export const calcMortarScore = async (
  brandId: string | number,
  refDate: ISODate | null = null,
  periodLen = 7,
): Promise<MortarScoreResult> => {
  const ref = refDate || todayISO()
  const curStart = addDays(ref, -(periodLen - 1))
  const prevEnd = addDays(curStart, -1)
  const prevStart = addDays(prevEnd, -(periodLen - 1))

  const rows = await fetchPerfRows(brandId, prevStart, ref)
  return scoreFromRows(rows, ref, curStart, prevStart, prevEnd)
}

/** 이미 읽어온 rows 로 점수 계산 (보고서 analyzer가 재사용). */
export const scoreFromRows = (
  rows: ParsedRow[],
  ref: ISODate,
  curStart: ISODate,
  prevStart: ISODate,
  prevEnd: ISODate,
): MortarScoreResult => {
  const cur = windowStats(rows, null, curStart, ref)
  const prv = windowStats(rows, null, prevStart, prevEnd)

  let score = 50
  const reasons: string[] = ['기준 50']

  const cpaChg = pct(cur.cpa, prv.cpa)
  if (cpaChg != null) {
    if (cpaChg <= -10) {
      score += 15
      reasons.push(`CPA 개선 ${pctStr(cpaChg)} → +15`)
    } else if (cpaChg >= 20) {
      score -= 15
      reasons.push(`CPA 악화 ${pctStr(cpaChg)} → -15`)
    }
  }
  const ctrChg = pct(cur.ctr, prv.ctr)
  if (ctrChg != null) {
    if (ctrChg >= 10) {
      score += 10
      reasons.push(`CTR 상승 ${pctStr(ctrChg)} → +10`)
    } else if (ctrChg <= -25) {
      score -= 10
      reasons.push(`CTR 급락 ${pctStr(ctrChg)} → -10`)
    }
  }
  const convChg = pct(cur.conv, prv.conv)
  if (convChg != null) {
    if (convChg >= 15) {
      score += 10
      reasons.push(`전환 증가 ${pctStr(convChg)} → +10`)
    } else if (convChg <= -20) {
      score -= 10
      reasons.push(`전환 감소 ${pctStr(convChg)} → -10`)
    }
  }
  if (cur.conv < 5) {
    score -= 5
    reasons.push('전환 5건 미만(데이터 부족) → -5')
  }

  score = Math.max(0, Math.min(100, score))
  const grade: MortarScoreResult['grade'] =
    score >= 85
      ? 'A'
      : score >= 70
        ? 'B'
        : score >= 55
          ? 'C'
          : score >= 40
            ? 'D'
            : 'F'
  return { score, grade, reasons, cur, prev: prv, ref_date: ref }
}

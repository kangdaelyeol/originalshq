/**
 * Firestore 접근 계층 — Python `src/core/database.py`의 세션/모델 역할.
 *
 * 컬렉션 구조 (SQLite 테이블 → 서브컬렉션):
 *   brands/{brandId}
 *     - name, industry, mainKpi(CPA|ROAS|DB), commerceChannels: string[], memo, createdAt
 *   brands/{brandId}/performance/{autoId}
 *     - date: "YYYY-MM-DD"(문자열, 타임존 없는 달력일), channel, campaignName, adgroupName,
 *       keyword, impressions, clicks, cost, conversion, convIndirect, convPurchase,
 *       revenue, resultType, createdAt
 *   brands/{brandId}/alerts/{autoId}
 *     - channel, alertType, severity(info|warn|critical), title, message,
 *       refDate: "YYYY-MM-DD"|null, isRead: 0|1, createdAt
 *   brands/{brandId}/reports/{autoId}
 *     - reportType(weekly|monthly), dateStart, dateEnd, fmt(pdf|docx), storagePath, createdAt
 *
 * 집계(SUM/GROUP BY)는 Firestore가 서버측으로 못 하므로, 분석/보고서는 해당 기간
 * performance 문서를 한 번에 읽어와 메모리에서 합산한다 (기간이 짧아 문서 수가 적다).
 */
import { initializeApp, getApps } from 'firebase-admin/app'
import {
  getFirestore,
  FieldValue,
  type CollectionReference,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase-admin/firestore'

import type { ISODate } from '../types'
import type { DetectedChannel } from '../csv/channel'
import type { ParsedRow } from '../csv/parse-result'
import { Channel } from '../types'

if (getApps().length === 0) initializeApp()

export const db = getFirestore('xtool-read')
export { FieldValue }

// --------------------------------------------------------------------------- //
// 문서 스키마
// --------------------------------------------------------------------------- //
export type MainKpi = 'CPA' | 'ROAS' | 'DB'

export interface BrandDoc {
  name: string
  industry: string
  mainKpi: MainKpi
  commerceChannels: Channel[]
  memo: string
  createdAt: Timestamp | FieldValue
}

/** performance 서브컬렉션 문서. ParsedRow(csv/parse-result.ts)와 같은 데이터를 담되
 *  Firestore 관례상 camelCase 필드명을 쓴다 — perfDocToRow/rowToPerfDoc이 서로 변환한다. */
export interface PerformanceDoc {
  brandId: string
  date: ISODate
  channel: DetectedChannel
  campaignName: string
  adgroupName: string
  keyword: string
  impressions: number
  clicks: number
  cost: number
  conversion: number
  convIndirect: number
  convPurchase: number
  revenue: number
  resultType: string | null
  createdAt: Timestamp | FieldValue
}

export type AlertSeverity = 'info' | 'warn' | 'critical'

export interface AlertDoc {
  channel: string
  alertType: string
  severity: AlertSeverity
  title: string
  message: string
  refDate: ISODate | null
  isRead: 0 | 1
  createdAt: Timestamp | FieldValue
}

export type ReportType = 'weekly' | 'monthly'
export type ReportFmt = 'pdf' | 'docx'

export interface ReportDoc {
  reportType: ReportType
  dateStart: ISODate
  dateEnd: ISODate
  fmt: ReportFmt
  storagePath: string
  createdAt: Timestamp | FieldValue
}

// --------------------------------------------------------------------------- //
// 컬렉션 참조
// --------------------------------------------------------------------------- //
export const brandsCol = (): CollectionReference<DocumentData> =>
  db.collection('brands')

export const perfCol = (
  brandId: string | number,
): CollectionReference<DocumentData> =>
  db.collection('brands').doc(String(brandId)).collection('performance')

export const alertsCol = (
  brandId: string | number,
): CollectionReference<DocumentData> =>
  db.collection('brands').doc(String(brandId)).collection('alerts')

export const reportsCol = (
  brandId: string | number,
): CollectionReference<DocumentData> =>
  db.collection('brands').doc(String(brandId)).collection('reports')

// --------------------------------------------------------------------------- //
// 문서 ↔ ParsedRow 변환
// --------------------------------------------------------------------------- //

/** performance 문서 → 분석 코드가 쓰는 평탄 객체. csv 파서의 ParsedRow와 동일 형태(+id). */
export const perfDocToRow = (
  d: QueryDocumentSnapshot<DocumentData>,
): ParsedRow & { id: string } => {
  const x = d.data() as Partial<PerformanceDoc>
  return {
    id: d.id,
    date: x.date ?? '',
    channel: x.channel ?? 'generic',
    campaign_name: x.campaignName ?? '',
    adgroup_name: x.adgroupName ?? '',
    keyword: x.keyword ?? '',
    impressions: x.impressions ?? 0,
    clicks: x.clicks ?? 0,
    cost: x.cost ?? 0,
    conversion: x.conversion ?? 0,
    conv_indirect: x.convIndirect ?? 0,
    conv_purchase: x.convPurchase ?? 0,
    revenue: x.revenue ?? 0,
    result_type: x.resultType ?? null,
  }
}

/** 파서 ParsedRow → performance 문서 필드 (createdAt은 서버 타임스탬프로 채움). */
export const rowToPerfDoc = (
  brandId: string | number,
  r: ParsedRow,
): PerformanceDoc => {
  return {
    brandId: String(brandId),
    date: r.date,
    channel: r.channel,
    campaignName: r.campaign_name || '',
    adgroupName: r.adgroup_name || '',
    keyword: r.keyword || '',
    impressions: Math.trunc(Number(r.impressions) || 0),
    clicks: Math.trunc(Number(r.clicks) || 0),
    cost: Number(r.cost) || 0,
    conversion: Number(r.conversion) || 0,
    convIndirect: Number(r.conv_indirect) || 0,
    convPurchase: Number(r.conv_purchase) || 0,
    revenue: Number(r.revenue) || 0,
    resultType: r.result_type ?? null,
    createdAt: FieldValue.serverTimestamp(),
  }
}

/** 브랜드의 [start, end] (포함) 구간 performance rows. 한 번 읽어 메모리 집계용. */
export const fetchPerfRows = async (
  brandId: string | number,
  startISO: ISODate,
  endISO: ISODate,
  channel: DetectedChannel | null = null,
): Promise<Array<ParsedRow & { id: string }>> => {
  let q: Query<DocumentData> = perfCol(brandId)
    .where('date', '>=', startISO)
    .where('date', '<=', endISO)
  if (channel) q = q.where('channel', '==', channel)
  const snap = await q.get()
  return snap.docs.map(perfDocToRow)
}

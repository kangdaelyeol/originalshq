/**
 * cmip 백엔드는 onRequest + cors 로 구성되어 있어 순수 JSON 요청/응답이다
 * (onCall의 { data }/{ result } 콜러블 프로토콜이 아님). 성공 시 반환값이 body에
 * 그대로 오고, 실패 시 { error: string } 형태로 온다 (index.ts의 sendError 참고).
 */
import { CMIP_API_BASE } from '@/screens/xtool-lead-manager/constants'
import type {
  ImportCsvData,
  ImportCsvResult,
  AlertCheckData,
  MortarScoreData,
  WindowStats,
  ISODate,
} from '../types'

export class CallableError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'CallableError'
    this.status = status
  }
}

interface ErrorBody {
  error?: string
}

export async function callFunction<TReq, TRes>(
  name: string,
  data: TReq,
): Promise<TRes> {
  const res = await fetch(`${CMIP_API_BASE}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(`${name} 응답을 해석할 수 없습니다.`, res.status)
  }

  if (!res.ok) {
    const message =
      (body as ErrorBody)?.error ??
      `${name} 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  return body as TRes
}

export function importCsv(data: ImportCsvData): Promise<ImportCsvResult> {
  return callFunction<ImportCsvData, ImportCsvResult>('importCsv', data)
}

// --------------------------------------------------------------------------- //
// MORTAR SCORE / Alert
// --------------------------------------------------------------------------- //

export interface MortarScoreResult {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  reasons: string[]
  cur: WindowStats
  prev: WindowStats
  ref_date: ISODate
}

export interface AlertCheckResult {
  created: number
}

export type AlertSeverity = 'info' | 'warn' | 'critical'

export interface AlertSummary {
  id: string
  channel: string
  alertType: string
  severity: AlertSeverity
  title: string
  message: string
  refDate: ISODate | null
  createdAt: string | null
}

export interface ListAlertsData {
  brandId: string | number
  limit?: number
}

export interface ListAlertsResult {
  alerts: AlertSummary[]
}

export function mortarScore(data: MortarScoreData): Promise<MortarScoreResult> {
  return callFunction<MortarScoreData, MortarScoreResult>('mortarScore', data)
}

export function alertCheck(data: AlertCheckData): Promise<AlertCheckResult> {
  return callFunction<AlertCheckData, AlertCheckResult>('alertCheck', data)
}

export function listAlerts(data: ListAlertsData): Promise<ListAlertsResult> {
  return callFunction<ListAlertsData, ListAlertsResult>('listAlerts', data)
}

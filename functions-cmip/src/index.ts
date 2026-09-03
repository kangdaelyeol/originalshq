/**
 * MIP 백엔드 진입점 — Firebase Functions v2 HTTP(onRequest) + cors 미들웨어.
 *
 * onCall → onRequest 전환: onCall은 CallableRequest 시그니처라 cors 패키지의
 * Express 스타일 미들웨어를 못 끼운다. xtool의 createLead 등과 동일한
 * onRequest + corsHandler 패턴으로 통일했다. 클라이언트는 { data }/{ result }
 * 콜러블 프로토콜이 아니라 순수 JSON 요청/응답을 그대로 주고받는다.
 *
 * NOTE: Auth 검증은 요청에 따라 일단 제거한 상태 — 프로덕션 전환 전 App Check 또는
 * Auth 검증을 다시 붙일 것.
 * NOTE: 2세대 Cloud Functions는 "공개 호출(allUsers invoker)" 권한이 프로젝트
 * 정책에 따라 별도로 필요할 수 있다.
 */
import { onRequest } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import cors from 'cors'

import {
  db,
  alertsCol,
  importRowsBatch,
  existingConflictKeys,
  saveManualSmartstore,
} from './data'
import { runAlertCheck, calcMortarScore } from './analysis'
import { ParseResult, parseBuffer } from './csv'
import type {
  AlertCheckData,
  ImportBatchResult,
  ImportCsvData,
  ImportCsvResult,
  PreviewCsvData,
  PreviewCsvResult,
  MortarScoreData,
  SaveCommerceRevenueData,
  CsvFileInput,
} from './types'

const corsHandler = cors({ origin: true })

setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10 })

function sendError(
  response: import('express').Response,
  status: number,
  message: string,
): void {
  response.status(status).send({ error: message })
}

/** 파일 base64 배열 → ParseResult 배열. */
function parseFiles(files: CsvFileInput[] | undefined): ParseResult[] {
  return (files || []).map((f) => {
    const buf = Buffer.from(f.contentBase64, 'base64')
    return parseBuffer(buf, f.name || 'upload.csv', f.channelHint || null)
  })
}

/**
 * CSV 미리보기(드라이런) — 적재 없이 파싱 결과 + 충돌 키만 반환.
 */
export const previewCsv = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const { brandId, files } = (request.body ?? {}) as Partial<PreviewCsvData>
      if (!brandId) {
        sendError(response, 400, 'brandId 필요')
        return
      }

      const results = parseFiles(files)
      const allRows = results.flatMap((r) => r.rows)
      const conflicts = await existingConflictKeys(db, brandId, allRows)

      const result: PreviewCsvResult = {
        files: results.map((r) => ({
          source: r.sourceName,
          channel: r.channel,
          format: r.detectedFormat,
          rowCount: r.rows.length,
          dateRange: r.dateRange,
          warnings: r.warnings,
          sample: r.rows.slice(0, 5),
        })),
        totalRows: allRows.length,
        conflicts,
      }
      response.status(200).send(result)
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : '서버 오류')
    }
  })
})

/**
 * CSV 적재 — 배치 전체 (채널+캠페인+날짜) 1회 삭제 후 전체 삽입.
 */
export const importCsv = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const { brandId, files } = (request.body ?? {}) as Partial<ImportCsvData>
      if (!brandId) {
        sendError(response, 400, 'brandId 필요')
        return
      }

      const results = parseFiles(files)
      const { inserted, deleted } = await importRowsBatch(db, brandId, results)
      const result: ImportCsvResult = {
        inserted,
        deleted,
        warnings: results.flatMap((r) => r.warnings),
      }
      response.status(200).send(result)
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : '서버 오류')
    }
  })
})

/**
 * 스마트스토어 등 커머스 채널 매출·구매건 수기입력.
 */
export const saveCommerceRevenue = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const { brandId, entries, channel } = (request.body ??
        {}) as Partial<SaveCommerceRevenueData>
      if (!brandId || !Array.isArray(entries)) {
        sendError(response, 400, 'brandId, entries 필요')
        return
      }
      const result: ImportBatchResult = await saveManualSmartstore(
        db,
        brandId,
        entries,
        channel || 'smartstore',
      )
      response.status(200).send(result)
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : '서버 오류')
    }
  })
})

/**
 * 이상 징후 재검사.
 * refDate 미지정 시 오늘 — 후행 업로드 검사에서는 임포트된 최신일을 넘길 것.
 */
export const alertCheck = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const { brandId, refDate, periodLen } = (request.body ??
        {}) as Partial<AlertCheckData>
      if (!brandId) {
        sendError(response, 400, 'brandId 필요')
        return
      }
      const created = await runAlertCheck(
        brandId,
        refDate || null,
        periodLen || 7,
      )
      response.status(200).send({ created })
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : '서버 오류')
    }
  })
})

/** MORTAR SCORE. */
export const mortarScore = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const { brandId, refDate, periodLen } = (request.body ??
        {}) as Partial<MortarScoreData>
      if (!brandId) {
        sendError(response, 400, 'brandId 필요')
        return
      }
      const result = await calcMortarScore(
        brandId,
        refDate || null,
        periodLen || 7,
      )
      response.status(200).send(result)
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : '서버 오류')
    }
  })
})

// --------------------------------------------------------------------------- //
// listAlerts — 미확인 알림 조회
// NOTE: 아래 3개 타입(ListAlertsData/AlertSummary/ListAlertsResult)은 아직 './types'에
// 없어서 로컬로 선언했다. 프론트와 계약을 공유하려면 './types'로 옮기고 프론트
// types 파일에도 동일하게 반영할 것.
// --------------------------------------------------------------------------- //
export interface ListAlertsData {
  brandId: string | number
  limit?: number
}

export interface AlertSummary {
  id: string
  channel: string
  alertType: string
  severity: 'info' | 'warn' | 'critical'
  title: string
  message: string
  refDate: string | null
  createdAt: string | null
}

export interface ListAlertsResult {
  alerts: AlertSummary[]
}

/** 브랜드의 미확인(isRead=0) 알림을 최신순으로 조회. alertCheck는 "재계산", 이건 "조회" 전용. */
export const listAlerts = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const { brandId, limit } = (request.body ?? {}) as Partial<ListAlertsData>
      if (!brandId) {
        sendError(response, 400, 'brandId 필요')
        return
      }

      const snap = await alertsCol(brandId)
        .where('isRead', '==', 0)
        .orderBy('createdAt', 'desc')
        .limit(limit && limit > 0 ? limit : 20)
        .get()

      const alerts: AlertSummary[] = snap.docs.map((d) => {
        const x = d.data() as Record<string, unknown>
        const createdAt = x.createdAt as { toDate?: () => Date } | undefined
        return {
          id: d.id,
          channel: String(x.channel ?? ''),
          alertType: String(x.alertType ?? ''),
          severity: (x.severity as AlertSummary['severity']) ?? 'info',
          title: String(x.title ?? ''),
          message: String(x.message ?? ''),
          refDate: (x.refDate as string | undefined) ?? null,
          createdAt: createdAt?.toDate
            ? createdAt.toDate().toISOString()
            : null,
        }
      })

      const result: ListAlertsResult = { alerts }
      response.status(200).send(result)
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : '서버 오류')
    }
  })
})

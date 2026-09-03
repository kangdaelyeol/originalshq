import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import type { CallableRequest } from 'firebase-functions/v2/https'
import {
  db,
  importRowsBatch,
  existingConflictKeys,
  saveManualSmartstore,
} from './data'
import { runAlertCheck, calcMortarScore } from './analysis'
import { ParseResult, parseBuffer } from './csv'
import {
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

setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10 })

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
export const previewCsv = onCall(
  async (
    req: CallableRequest<Partial<PreviewCsvData>>,
  ): Promise<PreviewCsvResult> => {
    const { brandId, files } = req.data ?? {}
    if (!brandId) throw new HttpsError('invalid-argument', 'brandId 필요')

    const results = parseFiles(files)
    const allRows = results.flatMap((r) => r.rows)
    const conflicts = await existingConflictKeys(db, brandId, allRows)

    return {
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
  },
)

/**
 * CSV 적재 — 배치 전체 (채널+캠페인+날짜) 1회 삭제 후 전체 삽입.
 */
export const importCsv = onCall(
  async (
    req: CallableRequest<Partial<ImportCsvData>>,
  ): Promise<ImportCsvResult> => {
    const { brandId, files } = req.data ?? {}
    if (!brandId) throw new HttpsError('invalid-argument', 'brandId 필요')

    const results = parseFiles(files)
    const { inserted, deleted } = await importRowsBatch(db, brandId, results)
    return {
      inserted,
      deleted,
      warnings: results.flatMap((r) => r.warnings),
    }
  },
)

/**
 * 스마트스토어 등 커머스 채널 매출·구매건 수기입력.
 */
export const saveCommerceRevenue = onCall(
  async (
    req: CallableRequest<Partial<SaveCommerceRevenueData>>,
  ): Promise<ImportBatchResult> => {
    const { brandId, entries, channel } = req.data ?? {}
    if (!brandId || !Array.isArray(entries))
      throw new HttpsError('invalid-argument', 'brandId, entries 필요')
    return saveManualSmartstore(db, brandId, entries, channel || 'smartstore')
  },
)

/**
 * 이상 징후 재검사.
 * refDate 미지정 시 오늘 — 후행 업로드 검사에서는 임포트된 최신일을 넘길 것.
 */
export const alertCheck = onCall(
  async (req: CallableRequest<Partial<AlertCheckData>>) => {
    const { brandId, refDate, periodLen } = req.data ?? {}
    if (!brandId) throw new HttpsError('invalid-argument', 'brandId 필요')
    const created = await runAlertCheck(
      brandId,
      refDate || null,
      periodLen || 7,
    )
    return { created }
  },
)

/** MORTAR SCORE. */
export const mortarScore = onCall(
  async (req: CallableRequest<Partial<MortarScoreData>>) => {
    const { brandId, refDate, periodLen } = req.data ?? {}
    if (!brandId) throw new HttpsError('invalid-argument', 'brandId 필요')
    return calcMortarScore(brandId, refDate || null, periodLen || 7)
  },
)

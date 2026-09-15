import { onRequest } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import cors from 'cors'
import {
  db,
  alertsCol,
  brandsCol,
  FieldValue,
  importRowsBatch,
  existingConflictKeys,
  saveManualSmartstore,
} from './data'
import { runAlertCheck, calcMortarScore } from './analysis'
import { generateReport as buildReport } from './reports'
import { ParseResult, parseBuffer } from './csv'
import type {
  AlertCheckData,
  GenerateReportData,
  ImportBatchResult,
  ImportCsvData,
  ImportCsvResult,
  PreviewCsvData,
  PreviewCsvResult,
  MortarScoreData,
  SaveCommerceRevenueData,
  UpsertBrandData,
  CsvFileInput,
  OauthCallbackQuery,
  OauthCallbackResult,
} from './types'
import { defineSecret } from 'firebase-functions/params'
import { getMetaInsight } from './channel/meta'
import { validateGetInsightBody } from './util'
import {
  exchangeAndSaveGoogleTokens,
  getGoogleInsight,
  buildGoogleAdsAuthUrl,
  checkGoogleAuthStatus,
} from './channel/google'
import { GetGoogleInsightParams } from './channel/google/types'

const corsHandler = cors({ origin: true })

setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10 })

const metaAdsId = defineSecret('META_INSIGHT_ACCESS_TOKEN')
const googleClientId = defineSecret('GOOGLE_CLIENT_ID')
const googleClientSecret = defineSecret('GOOGLE_CLIENT_SECRET')
const googleDeveloperToken = defineSecret('GOOGLE_DEVELOPER_TOKEN')

// Google Cloud Console의 Authorized redirect URIs에 등록된 값과 반드시 동일해야
// 한다 — oauthCallback(토큰 교환)과 getGoogleAuthUrl(동의 화면 URL 생성) 양쪽에서
// 같은 값을 써야 "redirect_uri_mismatch" 없이 오간다.
const GOOGLE_OAUTH_REDIRECT_URI =
  'https://asia-northeast3-xtool-63b29.cloudfunctions.net/oauthCallback'

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

/**
 * 주간/월간 보고서 구조 데이터 — KPI 카드 + 섹션 + 분석 원본(analysis).
 * build_analysis 를 감싼 최상위 엔드포인트. .pdf/.docx 파일 렌더링은 이 구조를
 * 입력으로 별도 파이프라인에서 처리한다(fmt 는 어느 렌더러로 넘길지 힌트).
 */
export const generateReport = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const {
        brandId,
        reportType,
        dateStart,
        dateEnd,
        notes,
        nextPlanNote,
        fmt,
      } = (request.body ?? {}) as Partial<GenerateReportData>
      if (!brandId) {
        sendError(response, 400, 'brandId 필요')
        return
      }
      const result = await buildReport(brandId, {
        reportType: reportType ?? 'weekly',
        dateStart: dateStart ?? null,
        dateEnd: dateEnd ?? null,
        notes: notes ?? '',
        nextPlanNote: nextPlanNote ?? '',
        fmt: fmt ?? 'pdf',
      })
      response.status(200).send(result)
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : '서버 오류')
    }
  })
})

/**
 * 브랜드 문서 생성/수정 — brands/{brandId}.
 * 이 문서가 없으면 generateReport(build_analysis)가 "브랜드 없음"으로 막힌다.
 * 최초 셋업(빈 값이면 기본값 채움) 및 부분 수정(merge) 겸용.
 */
export const upsertBrand = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const { brandId, name, industry, mainKpi, commerceChannels, memo } =
        (request.body ?? {}) as Partial<UpsertBrandData>
      if (!brandId) {
        sendError(response, 400, 'brandId 필요')
        return
      }

      const ref = brandsCol().doc(String(brandId))
      const snap = await ref.get()

      const patch: Record<string, unknown> = {}
      if (name !== undefined) patch.name = name
      if (industry !== undefined) patch.industry = industry
      if (mainKpi !== undefined) patch.mainKpi = mainKpi
      if (commerceChannels !== undefined)
        patch.commerceChannels = commerceChannels
      if (memo !== undefined) patch.memo = memo

      if (!snap.exists) {
        patch.name = patch.name ?? `브랜드 ${brandId}`
        patch.industry = patch.industry ?? ''
        patch.mainKpi = patch.mainKpi ?? 'CPA'
        patch.commerceChannels = patch.commerceChannels ?? []
        patch.memo = patch.memo ?? ''
        patch.createdAt = FieldValue.serverTimestamp()
      }

      await ref.set(patch, { merge: true })
      response
        .status(200)
        .send({ brandId: String(brandId), created: !snap.exists })
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

export const getAllInsights = onRequest(
  { secrets: [metaAdsId] },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== 'GET') {
        res.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationRes = validateGetInsightBody(req.query)

      if (!validationRes.ok) {
        sendError(res, 400, validationRes.error)
        return
      }

      const { dateStart, dateEnd } = validationRes.data

      try {
        const metaRes = await getMetaInsight(
          dateStart,
          dateEnd,
          metaAdsId.value(),
        )
        res.status(200).send(metaRes)
      } catch (err) {
        sendError(res, 500, err instanceof Error ? err.message : '서버 오류')
      }
    })
  },
)

/**
 * Google Ads OAuth 2.0 콜백 엔드포인트
 * - Google Cloud Console Authorized redirect URIs에 입력할 URL:
 *   https://asia-northeast3-xtool-63b29.cloudfunctions.net/oauthCallback
 */
export const oauthCallback = onRequest(
  { secrets: [googleClientId, googleClientSecret] },
  (request, response) => {
    corsHandler(request, response, async () => {
      try {
        // 1. HTTP Method 검증 (구글 OAuth 콜백은 GET 방식)
        if (request.method !== 'GET') {
          sendError(response, 405, 'Method Not Allowed')
          return
        }

        const { code, state, error, error_description } =
          request.query as OauthCallbackQuery

        // 2. 구글에서 인증 거부/오류 반환 시 처리
        if (error) {
          sendError(
            response,
            400,
            `Google OAuth Error: ${error_description || error}`,
          )
          return
        }

        // 3. 필수 파라미터 검증 (code: 인증 코드, state: 브랜드 구분용 brandId)
        if (!code) {
          sendError(response, 400, 'Authorization code(code)가 누락되었습니다.')
          return
        }

        if (!state) {
          sendError(
            response,
            400,
            'state(brandId) 파라미터가 누락되어 브랜드 식별이 불가능합니다.',
          )
          return
        }

        const brandId = String(state)

        // 4. 토큰 교환 및 Firestore 저장 수행
        await exchangeAndSaveGoogleTokens(
          code,
          brandId,
          googleClientId.value(),
          googleClientSecret.value(),
          GOOGLE_OAUTH_REDIRECT_URI,
        )

        // 5. 처리 완료 후 처리 (프론트엔드로 성공 리디렉션 또는 JSON 반환)
        // A. 웹 서비스 화면으로 리디렉션 시:
        // response.redirect(`https://your-frontend-domain.com/brands/${brandId}/settings?google_ads=success`)

        // B. API 형태로 완료 결과 응답 시:
        response.status(200).send({
          success: true,
          brandId,
          message:
            'Google Ads API 연동 및 Refresh Token 저장이 완료되었습니다.',
        } as OauthCallbackResult)
      } catch (err) {
        sendError(
          response,
          500,
          err instanceof Error ? err.message : 'Google OAuth 인증 실패',
        )
      }
    })
  },
)

// --------------------------------------------------------------------------- //
// Google Ads 연동 테스트용 보조 엔드포인트
// (src/screens/cmip GoogleTestPanel 전용) — client_id/secret은 프론트로 절대
// 나가지 않고, 서버가 만든 동의 화면 URL만 새 탭으로 열어주는 식으로 연동을
// 검증한다.
// --------------------------------------------------------------------------- //
export interface GetGoogleAuthUrlData {
  brandId: string
}

export interface GetGoogleAuthUrlResult {
  url: string
}

/**
 * Google Ads OAuth 동의 화면 URL 발급.
 */
export const getGoogleAuthUrl = onRequest(
  { secrets: [googleClientId, googleClientSecret] },
  (request, response) => {
    corsHandler(request, response, async () => {
      try {
        if (request.method !== 'GET') {
          sendError(response, 405, 'Method Not Allowed')
          return
        }
        const { brandId } = request.query as Partial<GetGoogleAuthUrlData>
        if (!brandId) {
          sendError(response, 400, 'brandId 필요')
          return
        }
        const url = buildGoogleAdsAuthUrl(
          String(brandId),
          googleClientId.value(),
          googleClientSecret.value(),
          GOOGLE_OAUTH_REDIRECT_URI,
        )
        const result: GetGoogleAuthUrlResult = { url }
        response.status(200).send(result)
      } catch (err) {
        sendError(
          response,
          500,
          err instanceof Error ? err.message : '서버 오류',
        )
      }
    })
  },
)

export interface GetGoogleAuthStatusData {
  brandId: string
}

export interface GetGoogleAuthStatusResult {
  connected: boolean
  updatedAt: string | null
}

/**
 * 이 브랜드에 Google Ads refreshToken이 저장돼 있는지 확인 — "연동 시작"과
 * "조회"(getGoogleAdsInsight) 중 뭘 먼저 눌러야 하는지 UI가 판단하는 용도.
 */
export const getGoogleAuthStatus = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'GET') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const { brandId } = request.query as Partial<GetGoogleAuthStatusData>
      if (!brandId) {
        sendError(response, 400, 'brandId 필요')
        return
      }
      const result: GetGoogleAuthStatusResult = await checkGoogleAuthStatus(
        String(brandId),
      )
      response.status(200).send(result)
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : '서버 오류')
    }
  })
})

/**
 * Google Ads 인사이트 조회 엔드포인트
 */
export const getGoogleAdsInsight = onRequest(
  { secrets: [googleClientId, googleClientSecret, googleDeveloperToken] },
  (req, res) => {
    corsHandler(req, res, async () => {
      try {
        if (req.method !== 'GET' && req.method !== 'POST') {
          sendError(res, 405, 'Method Not Allowed')
          return
        }

        // GET 쿼리 또는 POST 바디 처리
        const params = (
          req.method === 'GET' ? req.query : req.body
        ) as Partial<GetGoogleInsightParams> & { customerId?: string }
        const { brandId, dateStart, dateEnd, customerId, loginCustomerId } =
          params

        if (
          !brandId ||
          !dateStart ||
          !dateEnd ||
          !customerId ||
          !loginCustomerId
        ) {
          sendError(
            res,
            400,
            'brandId, dateStart, dateEnd, customerId 가 모두 필요합니다.',
          )
          return
        }

        const insightData = await getGoogleInsight(
          String(brandId),
          String(dateStart),
          String(dateEnd),
          googleClientId.value(),
          googleClientSecret.value(),
          googleDeveloperToken.value(),
          String(customerId),
          loginCustomerId,
        )

        res.status(200).send(insightData)
      } catch (err) {
        sendError(
          res,
          500,
          err instanceof Error ? err.message : 'Google Ads 인사이트 조회 실패',
        )
      }
    })
  },
)

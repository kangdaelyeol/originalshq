import { onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { setGlobalOptions } from 'firebase-functions/v2'
import * as logger from 'firebase-functions/logger'
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
import {
  debugFetchMetaInsightRaw,
  getMetaInsightWithHistory,
  syncMetaInsightRows,
} from './channel/meta'
import { validateGetInsightBody } from './util'
import {
  exchangeAndSaveGoogleTokens,
  buildGoogleAdsAuthUrl,
  checkGoogleAuthStatus,
  getGoogleCampaignInsightWithHistory,
  getGoogleAdGroupInsightWithHistory,
  syncGoogleCampaignInsightRows,
  syncGoogleAdGroupInsightRows,
  debugFetchGoogleCampaignRaw,
  debugFetchGoogleAdGroupRaw,
  GOOGLE_SYNC_BRAND_ID,
  GOOGLE_SYNC_CUSTOMER_ID,
  GOOGLE_SYNC_LOGIN_CUSTOMER_ID,
} from './channel/google'
import { GetGoogleInsightParams } from './channel/google/types'
import {
  getNaverInsightWithHistory,
  debugFetchNaverRaw,
  debugFetchNaverInsightRows,
  syncNaverInsightRows,
} from './channel/naver'
import { CUSTOMER_ID as NAVER_CUSTOMER_ID } from './channel/naver/constants'
import {
  getOfflineRevenue as fetchOfflineRevenue,
  syncOfflineSalesFromMonday,
  debugFetchOfflineSalesRaw,
} from './monday-crm'
import {
  buildCafe24AuthUrl,
  checkCafe24AuthStatus,
  debugFetchCafe24OrdersRaw,
  debugFetchCafe24RefundsRaw,
  exchangeAndSaveCafe24Tokens,
  getCafe24Revenue as fetchCafe24Revenue,
  syncCafe24Orders as syncCafe24OrdersFromApi,
} from './cafe24'
import { addDays, todayISO } from './channel/utils'

const corsHandler = cors({ origin: true })

setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10 })

const metaAdsId = defineSecret('META_INSIGHT_ACCESS_TOKEN')
const googleClientId = defineSecret('GOOGLE_CLIENT_ID')
const googleClientSecret = defineSecret('GOOGLE_CLIENT_SECRET')
const googleDeveloperToken = defineSecret('GOOGLE_DEVELOPER_TOKEN')
const naverSecretKey = defineSecret('NAVER_SECRET_KEY')
const naverAccessLicense = defineSecret('NAVER_ACCESS_LICENSE')
const mondayApiKey = defineSecret('MONDAY_API_KEY')
const cafe24ClientId = defineSecret('CAFE24_CLIENT_ID')
const cafe24SecretKey = defineSecret('CAFE24_SECRET_KEY')
const cafe24MainId = 'hiswill00'

// Google Cloud Console의 Authorized redirect URIs에 등록된 값과 반드시 동일해야
// 한다 — oauthCallback(토큰 교환)과 getGoogleAuthUrl(동의 화면 URL 생성) 양쪽에서
// 같은 값을 써야 "redirect_uri_mismatch" 없이 오간다.
const GOOGLE_OAUTH_REDIRECT_URI =
  'https://asia-northeast3-xtool-63b29.cloudfunctions.net/oauthCallback'

// Cafe24 개발자센터의 앱 설정(redirect_uri)에 이 값 그대로 등록해야 한다 —
// getCafe24AuthUrl(동의 화면 URL 생성)과 cafe24OauthCallback(토큰 교환) 양쪽이
// 같은 값을 써야 Cafe24가 "redirect_uri 불일치" 없이 콜백을 돌려준다.
const CAFE24_OAUTH_REDIRECT_URI =
  'https://asia-northeast3-xtool-63b29.cloudfunctions.net/cafe24OauthCallback'

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
        // getMetaInsight(라이브 전체 조회) 대신 getMetaInsightWithHistory를
        // 쓴다 — 최근 7일은 라이브 API, 8일 이상 전은 Firestore
        // (metaInsightDaily) 배치 동기화 값을 읽어서 합친다. 반환 모양은
        // 그대로라 프론트는 손댈 게 없다(channel/meta/index.ts의
        // getMetaInsightWithHistory 주석 참고).
        const metaRes = await getMetaInsightWithHistory(
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
 * 디버그 전용 — Meta Graph API 인사이트 원본 행을 눈으로 확인/대조하는 용도
 * (cafe24의 debugCafe24OrdersRaw와 같은 목적). 메인/서브 두 광고계정을 합친
 * count와 계정별 count를 같이 보여준다.
 */
export const debugMetaInsightRaw = onRequest(
  { secrets: [metaAdsId] },
  (request, response) => {
    corsHandler(request, response, async () => {
      if (request.method !== 'GET') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const { startDate, endDate } = request.query as {
        startDate?: string
        endDate?: string
      }
      if (!startDate || !endDate) {
        sendError(response, 400, 'startDate, endDate 필요')
        return
      }
      try {
        const raw = await debugFetchMetaInsightRaw(
          startDate,
          endDate,
          metaAdsId.value(),
        )
        response.status(200).send(raw)
      } catch (err) {
        sendError(response, 500, err instanceof Error ? err.message : '서버 오류')
      }
    })
  },
)

// ────────────────────────────────
// Meta 인사이트 — 동기화 + 조회. Cafe24 주문과 같은 이유로(매일 계속 쌓이고
// 어트리뷰션이 갱신되는 데이터) 삭제 없이 upsert만 한다(meta/firestore.ts
// 참고).
// ────────────────────────────────

// 롤링 재동기화 기본 범위 — LIVE_WINDOW_DAYS(7일)보다 여유 있게 잡아서,
// 어트리뷰션이 웬만큼 안정된 뒤에 DB에 반영되게 한다(cafe24의
// CAFE24_SYNC_WINDOW_DAYS와 같은 이유).
const META_SYNC_WINDOW_DAYS = 14

/**
 * Meta 인사이트를 지정한 기간만큼 라이브로 가져와 Firestore(metaInsightDaily)에
 * upsert한다. body에 startDate/endDate를 안 주면 기본으로 "최근 14일"을
 * 동기화한다 — 과거 데이터를 넓게 백필하고 싶을 때만 명시적으로 범위를
 * 넘기면 된다.
 */
export const syncMetaInsights = onRequest(
  { secrets: [metaAdsId], timeoutSeconds: 300 },
  (request, response) => {
    corsHandler(request, response, async () => {
      if (request.method !== 'POST') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const { startDate, endDate } = (request.body ?? {}) as {
        startDate?: string
        endDate?: string
      }
      const dateEnd = endDate || todayISO()
      const dateStart = startDate || addDays(dateEnd, -META_SYNC_WINDOW_DAYS)

      try {
        const result = await syncMetaInsightRows(
          dateStart,
          dateEnd,
          metaAdsId.value(),
        )
        response.status(200).send(result)
      } catch (err) {
        sendError(
          response,
          500,
          err instanceof Error ? err.message : 'Meta 인사이트 동기화 실패',
        )
      }
    })
  },
)

/**
 * Meta 인사이트를 매일 자정(KST) 최근 14일 롤링 재동기화한다 —
 * syncCafe24OrdersScheduled와 같은 패턴.
 */
export const syncMetaInsightsScheduled = onSchedule(
  {
    schedule: '0 0 * * *',
    timeZone: 'Asia/Seoul',
    secrets: [metaAdsId],
    timeoutSeconds: 300,
  },
  async () => {
    const dateEnd = todayISO()
    const dateStart = addDays(dateEnd, -META_SYNC_WINDOW_DAYS)
    try {
      const result = await syncMetaInsightRows(
        dateStart,
        dateEnd,
        metaAdsId.value(),
      )
      logger.info('Meta 인사이트 자동 동기화 성공:', result)
    } catch (err) {
      logger.error(
        'Meta 인사이트 자동 동기화 실패:',
        err instanceof Error ? err.message : err,
      )
    }
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
export const getGoogleCampaignInsight = onRequest(
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
            'brandId, dateStart, dateEnd, customerId, loginCustomerId 가 모두 필요합니다.',
          )
          return
        }

        // getGoogleInsight(라이브 전체 조회) 대신
        // getGoogleCampaignInsightWithHistory를 쓴다 — 최근 7일은 라이브
        // API, 8일 이상 전은 Firestore(googleCampaignInsightDaily) 배치
        // 동기화 값을 읽어서 합친다. 반환 모양은 그대로라 프론트/
        // GoogleTestPanel 모두 손댈 게 없다(channel/google/index.ts 참고).
        const insightData = await getGoogleCampaignInsightWithHistory(
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
            'brandId, dateStart, dateEnd, customerId, loginCustomerId 가 모두 필요합니다.',
          )
          return
        }

        // getGoogleAdGroupInsight 대신 getGoogleAdGroupInsightWithHistory —
        // 위 getGoogleCampaignInsight 핸들러와 동일한 이유.
        const insightData = await getGoogleAdGroupInsightWithHistory(
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

/**
 * 디버그 전용 — Google Ads 캠페인/adGroup 원본(가공은 됐지만 배치 안 된) 행을
 * 눈으로 확인/대조하는 용도(cafe24의 debugCafe24OrdersRaw/debugCafe24RefundsRaw
 * 두 리소스 분리 패턴과 동일). brandId/customerId/loginCustomerId를 생략하면
 * GOOGLE_SYNC_* 기본값(현재 연동된 유일한 계정)을 쓴다.
 */
export const debugGoogleCampaignInsightRaw = onRequest(
  { secrets: [googleClientId, googleClientSecret, googleDeveloperToken] },
  (request, response) => {
    corsHandler(request, response, async () => {
      if (request.method !== 'GET') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const { startDate, endDate, brandId, customerId, loginCustomerId } =
        request.query as {
          startDate?: string
          endDate?: string
          brandId?: string
          customerId?: string
          loginCustomerId?: string
        }
      if (!startDate || !endDate) {
        sendError(response, 400, 'startDate, endDate 필요')
        return
      }
      try {
        const raw = await debugFetchGoogleCampaignRaw(
          startDate,
          endDate,
          brandId || GOOGLE_SYNC_BRAND_ID,
          googleClientId.value(),
          googleClientSecret.value(),
          googleDeveloperToken.value(),
          customerId || GOOGLE_SYNC_CUSTOMER_ID,
          loginCustomerId || GOOGLE_SYNC_LOGIN_CUSTOMER_ID,
        )
        response.status(200).send(raw)
      } catch (err) {
        sendError(response, 500, err instanceof Error ? err.message : '서버 오류')
      }
    })
  },
)

export const debugGoogleAdGroupInsightRaw = onRequest(
  { secrets: [googleClientId, googleClientSecret, googleDeveloperToken] },
  (request, response) => {
    corsHandler(request, response, async () => {
      if (request.method !== 'GET') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const { startDate, endDate, brandId, customerId, loginCustomerId } =
        request.query as {
          startDate?: string
          endDate?: string
          brandId?: string
          customerId?: string
          loginCustomerId?: string
        }
      if (!startDate || !endDate) {
        sendError(response, 400, 'startDate, endDate 필요')
        return
      }
      try {
        const raw = await debugFetchGoogleAdGroupRaw(
          startDate,
          endDate,
          brandId || GOOGLE_SYNC_BRAND_ID,
          googleClientId.value(),
          googleClientSecret.value(),
          googleDeveloperToken.value(),
          customerId || GOOGLE_SYNC_CUSTOMER_ID,
          loginCustomerId || GOOGLE_SYNC_LOGIN_CUSTOMER_ID,
        )
        response.status(200).send(raw)
      } catch (err) {
        sendError(response, 500, err instanceof Error ? err.message : '서버 오류')
      }
    })
  },
)

// ────────────────────────────────
// Google Ads 인사이트 — 동기화 + 조회. Meta/Cafe24와 같은 이유로(매일 계속
// 쌓이고 어트리뷰션이 갱신되는 데이터) 삭제 없이 upsert만 한다
// (channel/google/firestore.ts 참고).
// ────────────────────────────────

// 롤링 재동기화 기본 범위 — meta의 META_SYNC_WINDOW_DAYS와 동일한 이유로
// LIVE_WINDOW_DAYS(7일)보다 여유 있게 잡는다.
const GOOGLE_SYNC_WINDOW_DAYS = 14

/**
 * Google Ads 인사이트(캠페인+adGroup)를 지정한 기간만큼 라이브로 가져와
 * Firestore에 upsert한다. body를 생략하면 기본으로 "최근 14일 × 유일한
 * 연동 계정(GOOGLE_SYNC_*)"을 동기화한다 — 과거 데이터를 넓게 백필하고
 * 싶을 때만 명시적으로 범위를 넘기면 된다.
 */
export const syncGoogleInsights = onRequest(
  {
    secrets: [googleClientId, googleClientSecret, googleDeveloperToken],
    timeoutSeconds: 300,
  },
  (request, response) => {
    corsHandler(request, response, async () => {
      if (request.method !== 'POST') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const {
        startDate,
        endDate,
        brandId,
        customerId,
        loginCustomerId,
      } = (request.body ?? {}) as {
        startDate?: string
        endDate?: string
        brandId?: string
        customerId?: string
        loginCustomerId?: string
      }
      const dateEnd = endDate || todayISO()
      const dateStart = startDate || addDays(dateEnd, -GOOGLE_SYNC_WINDOW_DAYS)
      const syncBrandId = brandId || GOOGLE_SYNC_BRAND_ID
      const syncCustomerId = customerId || GOOGLE_SYNC_CUSTOMER_ID
      const syncLoginCustomerId = loginCustomerId || GOOGLE_SYNC_LOGIN_CUSTOMER_ID

      try {
        const [campaignResult, adGroupResult] = await Promise.all([
          syncGoogleCampaignInsightRows(
            dateStart,
            dateEnd,
            syncBrandId,
            googleClientId.value(),
            googleClientSecret.value(),
            googleDeveloperToken.value(),
            syncCustomerId,
            syncLoginCustomerId,
          ),
          syncGoogleAdGroupInsightRows(
            dateStart,
            dateEnd,
            syncBrandId,
            googleClientId.value(),
            googleClientSecret.value(),
            googleDeveloperToken.value(),
            syncCustomerId,
            syncLoginCustomerId,
          ),
        ])
        response.status(200).send({
          campaignUpserted: campaignResult.upserted,
          adGroupUpserted: adGroupResult.upserted,
        })
      } catch (err) {
        sendError(
          response,
          500,
          err instanceof Error ? err.message : 'Google Ads 인사이트 동기화 실패',
        )
      }
    })
  },
)

/**
 * Google Ads 인사이트를 매일 자정(KST) 최근 14일 롤링 재동기화한다 —
 * syncCafe24OrdersScheduled/syncMetaInsightsScheduled와 같은 패턴.
 */
export const syncGoogleInsightsScheduled = onSchedule(
  {
    schedule: '0 0 * * *',
    timeZone: 'Asia/Seoul',
    secrets: [googleClientId, googleClientSecret, googleDeveloperToken],
    timeoutSeconds: 300,
  },
  async () => {
    const dateEnd = todayISO()
    const dateStart = addDays(dateEnd, -GOOGLE_SYNC_WINDOW_DAYS)
    try {
      const [campaignResult, adGroupResult] = await Promise.all([
        syncGoogleCampaignInsightRows(
          dateStart,
          dateEnd,
          GOOGLE_SYNC_BRAND_ID,
          googleClientId.value(),
          googleClientSecret.value(),
          googleDeveloperToken.value(),
          GOOGLE_SYNC_CUSTOMER_ID,
          GOOGLE_SYNC_LOGIN_CUSTOMER_ID,
        ),
        syncGoogleAdGroupInsightRows(
          dateStart,
          dateEnd,
          GOOGLE_SYNC_BRAND_ID,
          googleClientId.value(),
          googleClientSecret.value(),
          googleDeveloperToken.value(),
          GOOGLE_SYNC_CUSTOMER_ID,
          GOOGLE_SYNC_LOGIN_CUSTOMER_ID,
        ),
      ])
      logger.info('Google Ads 인사이트 자동 동기화 성공:', {
        campaignUpserted: campaignResult.upserted,
        adGroupUpserted: adGroupResult.upserted,
      })
    } catch (err) {
      logger.error(
        'Google Ads 인사이트 자동 동기화 실패:',
        err instanceof Error ? err.message : err,
      )
    }
  },
)

/**
 * Naver 검색광고 인사이트 조회 엔드포인트 — Meta(getAllInsights)와 같은 모양
 * (total/byDate/byDayOfWeek/byGroupedWeek/byCampaign)을 그대로 반환한다.
 * CUSTOMER ID는 민감정보가 아니라 상수로 고정돼 있어(channel/naver/constants),
 * Meta처럼 dateStart/dateEnd만 받으면 된다.
 */
export const getNaverInsight = onRequest(
  { secrets: [naverAccessLicense, naverSecretKey] },
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
        // getNaverInsight(라이브 전체 조회) 대신
        // getNaverInsightWithHistory를 쓴다 — 최근 7일은 라이브 API, 8일
        // 이상 전은 Firestore(naverInsightDaily) 배치 동기화 값을 읽어서
        // 합친다. 네이버는 /stats가 "하루 = 요청 한 번"이라 조회 기간이
        // 길수록 라이브 호출이 느린데, 이 전환으로 그 비용을 크게 줄인다.
        // 반환 모양은 그대로라 프론트는 손댈 게 없다(channel/naver/index.ts
        // 참고).
        const naverRes = await getNaverInsightWithHistory(dateStart, dateEnd, {
          apiKey: naverAccessLicense.value(),
          secretKey: naverSecretKey.value(),
          customerId: NAVER_CUSTOMER_ID,
        })
        res.status(200).send(naverRes)
      } catch (err) {
        sendError(
          res,
          500,
          err instanceof Error ? err.message : 'Naver 인사이트 조회 실패',
        )
      }
    })
  },
)

/**
 * 디버그 전용 — getNaverInsight가 빈 데이터를 반환할 때, /ncc/campaigns,
 * /ncc/adgroups, /stats 세 응답의 원본을 그대로 보여준다. 문제 확인되면 이
 * 엔드포인트와 channel/naver/index.ts의 debugFetchNaverRaw는 지워도 된다.
 */
export const debugNaverRaw = onRequest(
  { secrets: [naverAccessLicense, naverSecretKey] },
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
        const raw = await debugFetchNaverRaw(dateStart, dateEnd, {
          apiKey: naverAccessLicense.value(),
          secretKey: naverSecretKey.value(),
          customerId: NAVER_CUSTOMER_ID,
        })
        res.status(200).send(raw)
      } catch (err) {
        sendError(res, 500, err instanceof Error ? err.message : '서버 오류')
      }
    })
  },
)

/**
 * 디버그 전용 — client.ts가 가공까지 마친(집계는 안 된) 인사이트 행 배열을
 * 그대로 반환한다(meta의 debugMetaInsightRaw와 같은 목적 — DB 백필 후 같은
 * 기간 결과를 직접 합산해 대조하는 용도). 위 debugNaverRaw는 필드명/스키마
 * 확인용이고, 이건 합계 검증용으로 역할이 다르다.
 */
export const debugNaverInsightRowsRaw = onRequest(
  { secrets: [naverAccessLicense, naverSecretKey] },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== 'GET') {
        sendError(res, 405, 'Method Not Allowed')
        return
      }

      const validationRes = validateGetInsightBody(req.query)
      if (!validationRes.ok) {
        sendError(res, 400, validationRes.error)
        return
      }
      const { dateStart, dateEnd } = validationRes.data

      try {
        const raw = await debugFetchNaverInsightRows(dateStart, dateEnd, {
          apiKey: naverAccessLicense.value(),
          secretKey: naverSecretKey.value(),
          customerId: NAVER_CUSTOMER_ID,
        })
        res.status(200).send(raw)
      } catch (err) {
        sendError(res, 500, err instanceof Error ? err.message : '서버 오류')
      }
    })
  },
)

// ────────────────────────────────
// Naver 인사이트 — 동기화 + 조회. Meta/Google과 같은 이유로(매일 계속 쌓이고
// 값이 갱신되는 데이터) 삭제 없이 upsert만 한다(channel/naver/firestore.ts
// 참고).
// ────────────────────────────────

// 롤링 재동기화 기본 범위 — Meta/Google의 SYNC_WINDOW_DAYS와 동일한 이유로
// LIVE_WINDOW_DAYS(7일)보다 여유 있게 잡는다.
const NAVER_SYNC_WINDOW_DAYS = 14

/**
 * 네이버 인사이트를 지정한 기간만큼 라이브로 가져와
 * Firestore(naverInsightDaily)에 upsert한다. body에 startDate/endDate를 안
 * 주면 기본으로 "최근 14일"을 동기화한다.
 */
export const syncNaverInsights = onRequest(
  { secrets: [naverAccessLicense, naverSecretKey], timeoutSeconds: 300 },
  (request, response) => {
    corsHandler(request, response, async () => {
      if (request.method !== 'POST') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const { startDate, endDate } = (request.body ?? {}) as {
        startDate?: string
        endDate?: string
      }
      const dateEnd = endDate || todayISO()
      const dateStart = startDate || addDays(dateEnd, -NAVER_SYNC_WINDOW_DAYS)

      try {
        const result = await syncNaverInsightRows(dateStart, dateEnd, {
          apiKey: naverAccessLicense.value(),
          secretKey: naverSecretKey.value(),
          customerId: NAVER_CUSTOMER_ID,
        })
        response.status(200).send(result)
      } catch (err) {
        sendError(
          response,
          500,
          err instanceof Error ? err.message : 'Naver 인사이트 동기화 실패',
        )
      }
    })
  },
)

/**
 * 네이버 인사이트를 매일 자정(KST) 최근 14일 롤링 재동기화한다 —
 * syncMetaInsightsScheduled/syncGoogleInsightsScheduled와 같은 패턴.
 */
export const syncNaverInsightsScheduled = onSchedule(
  {
    schedule: '0 0 * * *',
    timeZone: 'Asia/Seoul',
    secrets: [naverAccessLicense, naverSecretKey],
    timeoutSeconds: 300,
  },
  async () => {
    const dateEnd = todayISO()
    const dateStart = addDays(dateEnd, -NAVER_SYNC_WINDOW_DAYS)
    try {
      const result = await syncNaverInsightRows(dateStart, dateEnd, {
        apiKey: naverAccessLicense.value(),
        secretKey: naverSecretKey.value(),
        customerId: NAVER_CUSTOMER_ID,
      })
      logger.info('Naver 인사이트 자동 동기화 성공:', result)
    } catch (err) {
      logger.error(
        'Naver 인사이트 자동 동기화 실패:',
        err instanceof Error ? err.message : err,
      )
    }
  },
)

/**
 * Monday CRM(오프라인 매출 보드)을 지금 상태로 Firestore(offlineSales
 * 컬렉션)에 재동기화한다 — 기존 문서를 전부 지우고 새로 받아온 값으로
 * 다시 채운다. 아래 syncOfflineSalesScheduled가 영업시간 중 주기적으로 이
 * 로직을 그대로 재사용해 자동 호출하고, 이 엔드포인트는 그 사이 급하게
 * 최신화가 필요할 때 수동으로 바로 트리거하는 용도로 남겨둔다.
 */
export const syncOfflineSales = onRequest(
  { secrets: [mondayApiKey] },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== 'POST') {
        res.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      try {
        const result = await syncOfflineSalesFromMonday(mondayApiKey.value())
        res.status(200).send(result)
      } catch (err) {
        sendError(
          res,
          500,
          err instanceof Error
            ? err.message
            : 'Monday 오프라인 매출 동기화 실패',
        )
      }
    })
  },
)

/**
 * 디버그 전용 — "분할납부" item(통째로 건너뜀)과 "계약금/분할납부" board
 * relation이 걸린 subitem이 있는 item(그 subitem만 매출에서 빼고
 * deferredBalance로 집계)을 원본 그대로 돌려준다. 정식 집계
 * (syncOfflineSales/getOfflineRevenue)와 별개로, 실 데이터에서 이 계산이
 * 맞는지 눈으로 대조해보기 위한 것 — cafe24의 debugCafe24OrdersRaw와 같은
 * 자리.
 */
export const debugOfflineSalesRaw = onRequest(
  { secrets: [mondayApiKey] },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== 'GET') {
        res.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      try {
        const result = await debugFetchOfflineSalesRaw(mondayApiKey.value())
        res.status(200).send(result)
      } catch (err) {
        sendError(
          res,
          500,
          err instanceof Error ? err.message : 'Monday 디버그 조회 실패',
        )
      }
    })
  },
)

/**
 * 오프라인 매출 조회 — Meta/Naver 인사이트(getMetaInsight/getNaverInsight)와
 * 같은 GET + dateStart/dateEnd 쿼리 방식. Monday를 실시간으로 부르지 않고
 * syncOfflineSales로 미리 동기화해둔 Firestore에서 읽으므로 시크릿이 필요 없다.
 */
export const getOfflineRevenue = onRequest((req, res) => {
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
      const result = await fetchOfflineRevenue(dateStart, dateEnd)
      res.status(200).send(result)
    } catch (err) {
      sendError(
        res,
        500,
        err instanceof Error ? err.message : '오프라인 매출 조회 실패',
      )
    }
  })
})

/**
 * Monday CRM 오프라인 매출을 영업시간 중 3시간 간격(10/13/16/19시, KST)으로
 * 자동 재동기화한다 — 이 저장소의 첫 onSchedule 함수. 24시간 내내가 아니라
 * 영업시간대만 도는 이유: CRM이 영업시간에만 쓰이니 그 시간에만 최신이면
 * 충분하고, Monday API 호출 횟수도 그만큼 줄어든다. 요일 구분 없이 매일
 * 돈다 — 매장이 주말에도 열려 있으면 그날도 최신화돼야 하니 평일로 좁히지
 * 않았다. HTTP 응답이 없는 트리거라 onRequest 버전(sendError)과 달리 성공/
 * 실패를 로그로만 남긴다 — Firebase 콘솔 로그에서 확인한다.
 */
export const syncOfflineSalesScheduled = onSchedule(
  {
    schedule: '0 10,13,16,19 * * *',
    timeZone: 'Asia/Seoul',
    secrets: [mondayApiKey],
  },
  async () => {
    try {
      const result = await syncOfflineSalesFromMonday(mondayApiKey.value())
      logger.info('오프라인 매출 자동 동기화 성공:', result)
    } catch (err) {
      logger.error(
        '오프라인 매출 자동 동기화 실패:',
        err instanceof Error ? err.message : err,
      )
    }
  },
)

// ────────────────────────────────
// Cafe24 OAuth — 온라인 스토어 매출(주문) 연동의 인증 부분. 주문 데이터 조회
// 엔드포인트는 이 인증이 끝난 뒤 이어서 추가한다.
// ────────────────────────────────

/**
 * Cafe24 로그인/동의 화면 URL 발급 — 프론트가 이 URL을 새 탭으로 연다.
 * state는 CSRF 방지용 — 브랜드 구분이 필요 없는 단일 몰 연동이라 고정값을
 * 쓴다(cafe24OauthCallback에서 그대로 되돌아오는지만 확인).
 */
export const getCafe24AuthUrl = onRequest(
  { secrets: [cafe24ClientId] },
  (request, response) => {
    corsHandler(request, response, async () => {
      if (request.method !== 'GET') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      try {
        const url = buildCafe24AuthUrl(
          cafe24MainId,
          cafe24ClientId.value(),
          CAFE24_OAUTH_REDIRECT_URI,
          'cafe24',
        )
        response.status(200).send({ url })
      } catch (err) {
        sendError(response, 500, err instanceof Error ? err.message : '서버 오류')
      }
    })
  },
)

/**
 * Cafe24 OAuth 2.0 콜백 엔드포인트
 * - Cafe24 개발자센터 앱 설정의 Redirect URI에 입력할 URL:
 *   https://asia-northeast3-xtool-63b29.cloudfunctions.net/cafe24OauthCallback
 */
export const cafe24OauthCallback = onRequest(
  { secrets: [cafe24ClientId, cafe24SecretKey] },
  (request, response) => {
    corsHandler(request, response, async () => {
      if (request.method !== 'GET') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }

      const { code, state, error, error_description: errorDescription } =
        request.query as {
          code?: string
          state?: string
          error?: string
          error_description?: string
        }

      if (error) {
        sendError(response, 400, `Cafe24 OAuth Error: ${errorDescription || error}`)
        return
      }
      if (!code) {
        sendError(response, 400, 'Authorization code(code)가 누락되었습니다.')
        return
      }
      if (state !== 'cafe24') {
        sendError(response, 400, 'state 값이 올바르지 않습니다.')
        return
      }

      try {
        await exchangeAndSaveCafe24Tokens(
          code,
          cafe24MainId,
          CAFE24_OAUTH_REDIRECT_URI,
          cafe24ClientId.value(),
          cafe24SecretKey.value(),
        )
        response.status(200).send({
          success: true,
          message: 'Cafe24 연동 및 토큰 저장이 완료되었습니다.',
        })
      } catch (err) {
        sendError(
          response,
          500,
          err instanceof Error ? err.message : 'Cafe24 OAuth 인증 실패',
        )
      }
    })
  },
)

/**
 * 이 몰에 Cafe24 refreshToken이 저장돼 있는지 확인 — "연동 시작"과 "조회"
 * 중 뭘 먼저 눌러야 하는지 UI가 판단하는 용도(Google Ads의
 * getGoogleAuthStatus와 같은 역할).
 */
export const getCafe24AuthStatus = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    if (request.method !== 'GET') {
      sendError(response, 405, 'Method Not Allowed')
      return
    }
    try {
      const result = await checkCafe24AuthStatus()
      response.status(200).send(result)
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : '서버 오류')
    }
  })
})

/**
 * 디버그 전용 — 주문 목록 API의 실제 응답(필드명이 정확히 뭔지)을 눈으로
 * 확인하거나, 카페24 관리자 매출 리포트와 우리 집계(getCafe24Revenue)가
 * 다르게 나올 때 원본 주문을 직접 훑어보는 용도(debugNaverRaw와 같은 패턴).
 * dateType(선택, 기본 order_date)으로 cancel_date 등 다른 기준을 넣어
 * "이 기간에 취소/환불된 주문"처럼 다르게 조회해볼 수 있다(카페24가 실제로
 * 지원하는 값인지는 호출해서 확인 — 지원 안 하면 API가 에러를 돌려준다).
 * 사용 예: ?startDate=2026-08-01&endDate=2026-08-31&dateType=cancel_date
 */
export const debugCafe24OrdersRaw = onRequest(
  { secrets: [cafe24ClientId, cafe24SecretKey] },
  (request, response) => {
    corsHandler(request, response, async () => {
      if (request.method !== 'GET') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const { startDate, endDate, dateType } = request.query as {
        startDate?: string
        endDate?: string
        dateType?: string
      }
      if (!startDate || !endDate) {
        sendError(response, 400, 'startDate, endDate 필요')
        return
      }
      try {
        const raw = await debugFetchCafe24OrdersRaw(
          cafe24MainId,
          cafe24ClientId.value(),
          cafe24SecretKey.value(),
          startDate,
          endDate,
          dateType,
        )
        response.status(200).send(raw)
      } catch (err) {
        sendError(response, 500, err instanceof Error ? err.message : '서버 오류')
      }
    })
  },
)

/**
 * 디버그 전용 — 카페24 Admin API의 별도 "환불(refunds)" 리소스
 * (GET /admin/refunds)를 그대로 호출해본다. 공식 문서가 JS 렌더링 SPA라
 * 정확한 쿼리 파라미터를 못 읽어서, 쿼리스트링을 그대로 다 넘겨 실제
 * 응답으로 파라미터/필드 이름을 확인하는 용도(shop_no는 자동으로 붙는다).
 * 8/31 매출 조사에서 발견한 건(반품 접수일과 실제 카드 부분취소/환불일이
 * 달랐던 주문)처럼, 주문의 cancel_date만으로는 admin "환불합계"를 못 맞추는
 * 케이스가 있어서 이 리소스가 필요한지 확인하려는 것 — debugCafe24OrdersRaw
 * 주석 참고. 사용 예: ?start_date=2026-08-01&end_date=2026-08-31 또는
 * ?order_id=20260812-0000013 등, 실제로 뭐가 먹히는지 이것저것 넣어보면서
 * 확인한다.
 */
export const debugCafe24RefundsRaw = onRequest(
  { secrets: [cafe24ClientId, cafe24SecretKey] },
  (request, response) => {
    corsHandler(request, response, async () => {
      if (request.method !== 'GET') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const query: Record<string, string> = {}
      for (const [key, value] of Object.entries(request.query)) {
        if (typeof value === 'string') query[key] = value
      }
      try {
        const raw = await debugFetchCafe24RefundsRaw(
          cafe24MainId,
          cafe24ClientId.value(),
          cafe24SecretKey.value(),
          query,
        )
        response.status(200).send(raw)
      } catch (err) {
        sendError(response, 500, err instanceof Error ? err.message : '서버 오류')
      }
    })
  },
)

// ────────────────────────────────
// Cafe24 주문(매출) 데이터 — 동기화 + 조회. Monday CRM과 달리 매일 계속
// 쌓이는 데이터라 보드 전체를 매번 다 지우고 다시 받는 방식이 아니라, 요청
// 범위(백필은 넓게, 롤링 재동기화는 최근 N일만 좁게)만큼만 가져와 upsert한다
// (cafe24/firestore.ts 참고 — 주문은 사라지지 않고 상태만 바뀌어서 삭제가
// 필요 없다).
// ────────────────────────────────

// 롤링 재동기화 기본 범위 — 취소/환불은 보통 최근 주문에서 일어나므로 이
// 정도면 상태 변경을 놓치지 않으면서도 매번 다시 받는 양이 과하지 않다.
const CAFE24_SYNC_WINDOW_DAYS = 30

/**
 * Cafe24 주문을 지정한 기간만큼 가져와 Firestore(cafe24Orders)에 upsert한다.
 * body에 startDate/endDate를 안 주면 기본으로 "최근 30일"을 동기화한다 —
 * 과거 데이터를 한 번에 넓게 백필하고 싶을 때만 명시적으로 범위를 넘기면
 * 된다(3개월 넘는 범위도 cafe24/utils.ts가 알아서 나눠 호출한다).
 */
export const syncCafe24Orders = onRequest(
  { secrets: [cafe24ClientId, cafe24SecretKey], timeoutSeconds: 300 },
  (request, response) => {
    corsHandler(request, response, async () => {
      if (request.method !== 'POST') {
        sendError(response, 405, 'Method Not Allowed')
        return
      }
      const { startDate, endDate } = (request.body ?? {}) as {
        startDate?: string
        endDate?: string
      }
      const dateEnd = endDate || todayISO()
      const dateStart = startDate || addDays(dateEnd, -CAFE24_SYNC_WINDOW_DAYS)

      try {
        const result = await syncCafe24OrdersFromApi(
          cafe24MainId,
          cafe24ClientId.value(),
          cafe24SecretKey.value(),
          dateStart,
          dateEnd,
        )
        response.status(200).send(result)
      } catch (err) {
        sendError(
          response,
          500,
          err instanceof Error ? err.message : 'Cafe24 주문 동기화 실패',
        )
      }
    })
  },
)

/**
 * Cafe24 주문을 매일 자정(KST) 최근 30일 롤링 재동기화한다 — 온라인 스토어
 * 주문은 영업시간 개념이 없어(24시간 발생) Monday처럼 영업시간대만 도는
 * 대신, 하루 한 번이면 취소/환불 등 상태 변경을 반영하기에 충분하다고 보고
 * 하루 주기로 잡았다. 더 자주 반영해야 하면 이 schedule만 바꾸면 된다.
 */
export const syncCafe24OrdersScheduled = onSchedule(
  {
    schedule: '0 0 * * *',
    timeZone: 'Asia/Seoul',
    secrets: [cafe24ClientId, cafe24SecretKey],
    timeoutSeconds: 300,
  },
  async () => {
    const dateEnd = todayISO()
    const dateStart = addDays(dateEnd, -CAFE24_SYNC_WINDOW_DAYS)
    try {
      const result = await syncCafe24OrdersFromApi(
        cafe24MainId,
        cafe24ClientId.value(),
        cafe24SecretKey.value(),
        dateStart,
        dateEnd,
      )
      logger.info('Cafe24 주문 자동 동기화 성공:', result)
    } catch (err) {
      logger.error(
        'Cafe24 주문 자동 동기화 실패:',
        err instanceof Error ? err.message : err,
      )
    }
  },
)

/**
 * Cafe24 매출 조회 — Monday CRM의 getOfflineRevenue와 같은 GET +
 * dateStart/dateEnd 쿼리 방식. Cafe24를 실시간으로 부르지 않고
 * syncCafe24Orders로 미리 동기화해둔 Firestore에서 읽으므로 시크릿이
 * 필요 없다.
 */
export const getCafe24Revenue = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    if (request.method !== 'GET') {
      sendError(response, 405, 'Method Not Allowed')
      return
    }

    const validationRes = validateGetInsightBody(request.query)
    if (!validationRes.ok) {
      sendError(response, 400, validationRes.error)
      return
    }
    const { dateStart, dateEnd } = validationRes.data

    try {
      const result = await fetchCafe24Revenue(dateStart, dateEnd)
      response.status(200).send(result)
    } catch (err) {
      sendError(
        response,
        500,
        err instanceof Error ? err.message : 'Cafe24 매출 조회 실패',
      )
    }
  })
})

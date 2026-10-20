// Meta(Facebook) Graph API 인사이트 호출 — 라이브 조회(getMetaInsight)와
// Firestore 배치 동기화(sync/index.ts) 둘 다 이 파일의 fetchAllMetaInsightRows
// 하나를 공유한다(cafe24/client.ts의 fetchAllPages와 같은 이유 — 페이지네이션
// 로직을 한 곳에서만 관리해서 라이브/배치가 서로 다른 결과를 내는 일이 없게).
import * as logger from 'firebase-functions/logger'
import { DataSetInsight } from './types'
import { getFetchUrl } from './utils'

interface MetaInsightApiResponse {
  data?: DataSetInsight[]
  paging?: {
    cursors?: { before?: string; after?: string }
    next?: string
  }
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
    /** Meta가 "잠시 뒤 다시 하면 될 수 있다"고 표시한 오류. */
    is_transient?: boolean
    fbtrace_id?: string
  }
}

// Meta가 서버 쪽 일시 오류로 주는 코드 — 1은 "An unknown error occurred",
// 2는 "Service temporarily unavailable". 같은 요청을 조금 뒤 다시 보내면 대개
// 성공해서, 이 경우(또는 is_transient)만 몇 번 다시 시도한다. 권한·파라미터
// 오류는 다시 해도 같으므로 바로 실패시킨다.
const TRANSIENT_ERROR_CODES = new Set([1, 2])
// 다시 시도하기 전 기다리는 시간 — 횟수만큼 시도한다(첫 시도 포함 3번).
const RETRY_DELAYS_MS = [1000, 3000]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 한 페이지를 받아 온다 — 일시 오류면 RETRY_DELAYS_MS만큼 기다렸다가 다시
 * 보낸다. 끝내 실패하면 Meta의 오류 코드를 로그에 남기고 던진다(화면에는
 * 메시지만 가서, 코드·fbtrace_id가 없으면 원인을 되짚을 수 없다). */
async function fetchInsightPage(
  url: string,
  adsId: string,
): Promise<MetaInsightApiResponse> {
  for (let attempt = 0; ; attempt++) {
    const res: Response = await fetch(url)
    const data = (await res.json()) as MetaInsightApiResponse
    if (res.ok && !data.error) return data

    const error = data.error
    const transient =
      error?.is_transient === true ||
      (error?.code !== undefined && TRANSIENT_ERROR_CODES.has(error.code))
    const detail = {
      adsId,
      status: res.status,
      code: error?.code,
      subcode: error?.error_subcode,
      type: error?.type,
      transient,
      fbtraceId: error?.fbtrace_id,
      attempt: attempt + 1,
    }
    if (transient && attempt < RETRY_DELAYS_MS.length) {
      logger.warn(`Meta 인사이트 일시 오류, 다시 시도: ${error?.message}`, detail)
      await sleep(RETRY_DELAYS_MS[attempt])
      continue
    }
    logger.error(`Meta 인사이트 조회 실패: ${error?.message}`, detail)
    throw new Error(
      `Meta 인사이트 조회 실패: ${error?.message || res.statusText} (adsId=${adsId})`,
    )
  }
}

/** [dateStart, dateEnd] 하나의 광고계정에 대해 인사이트 행을 전부 모은다.
 * 예전엔 limit=5000 하나로 끝난다고 가정하고 paging.next를 아예 안 봤는데
 * (getFetchUrl 주석 참고), 배치 백필처럼 조회 기간이 넓어지면(adset 수 ×
 * 일수) 5000건을 넘길 수 있어서 cafe24/client.ts의 fetchAllPages와 같은
 * 패턴(응답이 주는 다음 페이지 URL을 그대로 다시 호출)을 추가했다. 라이브
 * 조회(최근 7일)도 이 함수를 그대로 쓰므로, 그동안 조용히 잘렸을 수 있는
 * 위험이 라이브 쪽에서도 같이 없어진다. */
export async function fetchAllMetaInsightRows(
  dateStart: string,
  dateEnd: string,
  adsId: string,
  accessToken: string,
): Promise<DataSetInsight[]> {
  const rows: DataSetInsight[] = []
  let url: string | null = getFetchUrl(dateStart, dateEnd, adsId, accessToken)

  while (url) {
    const data = await fetchInsightPage(url, adsId)
    rows.push(...(data.data ?? []))
    url = data.paging?.next ?? null
  }

  return rows
}

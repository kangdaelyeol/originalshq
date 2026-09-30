// Meta(Facebook) Graph API 인사이트 호출 — 라이브 조회(getMetaInsight)와
// Firestore 배치 동기화(sync/index.ts) 둘 다 이 파일의 fetchAllMetaInsightRows
// 하나를 공유한다(cafe24/client.ts의 fetchAllPages와 같은 이유 — 페이지네이션
// 로직을 한 곳에서만 관리해서 라이브/배치가 서로 다른 결과를 내는 일이 없게).
import { DataSetInsight } from './types'
import { getFetchUrl } from './utils'

interface MetaInsightApiResponse {
  data?: DataSetInsight[]
  paging?: {
    cursors?: { before?: string; after?: string }
    next?: string
  }
  error?: { message?: string; type?: string; code?: number }
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
    const res: Response = await fetch(url)
    const data = (await res.json()) as MetaInsightApiResponse
    if (!res.ok || data.error) {
      throw new Error(
        `Meta 인사이트 조회 실패: ${data.error?.message || res.statusText} (adsId=${adsId})`,
      )
    }
    rows.push(...(data.data ?? []))
    url = data.paging?.next ?? null
  }

  return rows
}

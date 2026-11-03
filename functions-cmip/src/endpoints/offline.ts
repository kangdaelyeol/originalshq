// 오프라인 매출 엔드포인트 — functions-xtool이 Monday 결제 보드에서 만든
// offlineSales를 읽기만 한다.
import '../config'
import { getOfflineRevenue as fetchOfflineRevenue } from '../monday-crm'
import { endpoint, insightQuery } from '../http'
import { onRequest } from '../trace/functions'

/**
 * 오프라인 매출 조회 — Meta/Naver 인사이트(getMetaInsight/getNaverInsight)와
 * 같은 GET + dateStart/dateEnd 쿼리 방식. offlineSales 컬렉션은 functions-
 * xtool이 Monday 결제 보드를 동기화할 때마다 채운다(결제 보드 해석은 그쪽
 * 한 곳에서만 한다). 여기서는 읽기만 하므로 시크릿이 필요 없다.
 */
export const getOfflineRevenue = onRequest(
  endpoint(
    {
      method: 'GET',
      validate: insightQuery,
      fallback: '오프라인 매출 조회 실패',
    },
    ({ data }) => fetchOfflineRevenue(data.dateStart, data.dateEnd),
  ),
)

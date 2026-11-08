// "광고 성과" 탭 — Google·네이버·OpenAI·당근의 광고그룹 단위 광고비와 소재 이름 대응(Meta는 meta.ts의
// getMetaAdInsights가 광고 단위로 준다).
import { readAdGroupInsights } from '../channel/ad-groups'
import { adPerformanceQuery, endpoint } from '../http'
import { onRequest } from '../trace/functions'

/** [dateStart, dateEnd]의 광고그룹 하루치(네 매체)와 광고 이름 → 광고그룹. 저장된 값만 읽는다(예약 동기화가
 * 최근 14일을 하루 6번 다시 받는다). */
export const getAdGroupInsights = onRequest(
  { memory: '512MiB' },
  endpoint({ method: 'GET', validate: adPerformanceQuery }, ({ data }) =>
    readAdGroupInsights(data.dateStart, data.dateEnd),
  ),
)

// 광고 소재 엔드포인트 — 집행 중인 광고의 소재(이미지·영상)를 매체에서 가져와
// 원본과 분석용 프레임을 Storage에 모은다(creatives/). 지금은 Meta만.
import { metaAdsId } from '../config'
import { recordBatchRun } from '../batch-log'
import { syncMetaCreatives as syncMetaCreativesFromApi } from '../creatives'
import { db } from '../data'
import { endpoint } from '../http'
import { scheduledSync } from '../scheduled-sync'
import { onRequest } from '../trace/functions'

// 영상을 내려받아 ffmpeg로 프레임을 뽑아서 메모리·시간을 넉넉히 준다. 제한
// 시간 90초 전에 처리를 멈추고 남은 소재는 다음 실행에 넘긴다.
const TIMEOUT_SECONDS = 540
const MEMORY = '2GiB'
const deadline = () => Date.now() + (TIMEOUT_SECONDS - 90) * 1000

/** 수동 실행(POST) — 결과는 /log에도 남는다. */
export const syncMetaCreatives = onRequest(
  { secrets: [metaAdsId], timeoutSeconds: TIMEOUT_SECONDS, memory: MEMORY },
  endpoint({ method: 'POST', fallback: 'Meta 소재 동기화 실패' }, () =>
    recordBatchRun(
      db,
      { job: 'meta-creatives', codebase: 'cmip', trigger: 'manual' },
      () => syncMetaCreativesFromApi(metaAdsId.value(), deadline()),
    ),
  ),
)

export const syncMetaCreativesScheduled = scheduledSync({
  secrets: [metaAdsId],
  windowDays: 0,
  timeoutSeconds: TIMEOUT_SECONDS,
  memory: MEMORY,
  jobs: [
    {
      job: 'meta-creatives',
      label: 'Meta 소재',
      run: () => syncMetaCreativesFromApi(metaAdsId.value(), deadline()),
    },
  ],
})

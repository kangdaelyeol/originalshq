// 광고 소재 엔드포인트 — 집행 중인 광고의 소재(이미지·영상)를 매체에서 가져와
// 원본과 분석용 프레임을 Storage에 모은다(creatives/). 매체에서 가져오는 것은
// Meta·당근이고, 나머지는 광고 설정 화면에서 직접 올린다.
import { anthropicApiKey, daangnAdsApiKey, metaAdsId } from '../config'
import { recordBatchRun } from '../batch-log'
import {
  analyzeCreative as analyzeCreativeWithClaude,
  deleteUploadedCreative,
  finishCreativeUpload as finishCreativeUploadFromStorage,
  listAdCreatives as listAdCreativesFromDb,
  startCreativeUpload as openCreativeUploadSession,
  syncDaangnCreatives as syncDaangnCreativesFromApi,
  syncMetaCreatives as syncMetaCreativesFromApi,
  UPLOAD_ID,
  validateStartUpload,
} from '../creatives'
import { ENTITY_KEY } from '../ad-settings'
import { db } from '../data'
import { endpoint, HttpError } from '../http'
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

/** 당근 소재 수동 실행(POST) — 결과는 /log에도 남는다. */
export const syncDaangnCreatives = onRequest(
  {
    secrets: [daangnAdsApiKey],
    timeoutSeconds: TIMEOUT_SECONDS,
    memory: MEMORY,
  },
  endpoint({ method: 'POST', fallback: '당근 소재 동기화 실패' }, () =>
    recordBatchRun(
      db,
      { job: 'daangn-creatives', codebase: 'cmip', trigger: 'manual' },
      () =>
        syncDaangnCreativesFromApi(
          { apiKey: daangnAdsApiKey.value() },
          deadline(),
        ),
    ),
  ),
)

export const syncDaangnCreativesScheduled = scheduledSync({
  secrets: [daangnAdsApiKey],
  windowDays: 0,
  timeoutSeconds: TIMEOUT_SECONDS,
  memory: MEMORY,
  jobs: [
    {
      job: 'daangn-creatives',
      label: '당근 소재',
      run: () =>
        syncDaangnCreativesFromApi(
          { apiKey: daangnAdsApiKey.value() },
          deadline(),
        ),
    },
  ],
})

/** 캠페인·광고셋 하나의 저장 소재(GET ?entityKey=채널:단위:ID) — 광고 설정
 * 편집기의 소재 칸. 썸네일 주소가 없는 예전 소재는 처음 열 때 채운다. */
export const listAdCreatives = onRequest(
  endpoint(
    { method: 'GET', fallback: '소재 목록 조회 실패' },
    async ({ request }) => {
      const entityKey = String(request.query.entityKey ?? '')
      if (!ENTITY_KEY.test(entityKey)) {
        throw new HttpError(400, 'entityKey는 "채널:단위:ID" 모양이어야 합니다')
      }
      return { entityKey, creatives: await listAdCreativesFromDb(entityKey) }
    },
  ),
)

/** 소재 하나 분석(POST { creativeId }) — 퍼셉트론 게시본 프롬프트 + Claude.
 * 프레임 최대 30장을 보내 한 번에 수십 초 걸리고, 비용이 들어 화면이 누를 때만
 * 돈다. 결과는 소재 문서에 남는다. */
export const analyzeCreative = onRequest(
  { secrets: [anthropicApiKey], timeoutSeconds: 300, memory: '512MiB' },
  endpoint(
    { method: 'POST', fallback: '소재 분석 실패' },
    async ({ request }) => {
      const { creativeId } = (request.body ?? {}) as { creativeId?: unknown }
      if (
        typeof creativeId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,120}$/.test(creativeId)
      ) {
        throw new HttpError(400, 'creativeId가 필요합니다')
      }
      return analyzeCreativeWithClaude(creativeId, anthropicApiKey.value())
    },
  ),
)

const uploadIdOf = (body: unknown) => {
  const { creativeId } = (body ?? {}) as { creativeId?: unknown }
  if (typeof creativeId !== 'string' || !UPLOAD_ID.test(creativeId)) {
    throw new HttpError(400, '직접 올린 소재의 creativeId가 필요합니다')
  }
  return creativeId
}

/** 직접 올리기 1단계(POST { entityKey, fileName, contentType, size }) — Storage
 * 업로드 세션 주소를 준다. 화면은 그 주소로 파일을 PUT하고 2단계를 부른다. */
export const startCreativeUpload = onRequest(
  endpoint(
    {
      method: 'POST',
      validate: (request) => validateStartUpload(request.body),
      fallback: '올리기를 시작하지 못했습니다',
    },
    ({ request, data, adminEmail }) => {
      // 세션 주소는 이 Origin에서만 CORS가 열린다(브라우저가 직접 올린다).
      const origin = request.get('origin') ?? ''
      if (!/^https?:\/\/[^/]+$/.test(origin)) {
        throw new HttpError(400, '브라우저 화면에서만 올릴 수 있습니다')
      }
      return openCreativeUploadSession(data, adminEmail ?? '', origin)
    },
  ),
)

/** 직접 올리기 2단계(POST { creativeId }) — 올라온 파일에서 프레임을 뽑고 소재
 * 문서를 만들어 돌려준다. 영상이면 수십 초 걸린다. */
export const finishCreativeUpload = onRequest(
  { timeoutSeconds: 300, memory: MEMORY },
  endpoint(
    { method: 'POST', fallback: '올린 소재를 처리하지 못했습니다' },
    ({ request }) => finishCreativeUploadFromStorage(uploadIdOf(request.body)),
  ),
)

/** 직접 올린 소재 지우기(POST { creativeId }) — 저장한 장에 들어 있으면 409. */
export const deleteCreativeUpload = onRequest(
  endpoint(
    { method: 'POST', fallback: '소재를 지우지 못했습니다' },
    ({ request }) => deleteUploadedCreative(uploadIdOf(request.body)),
  ),
)

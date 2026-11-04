// 매체 설정 엔드포인트 — 집행 중인 캠페인·광고셋의 예산·입찰·목표·타기팅을
// 매체 다섯 곳에서 읽어 바뀐 날을 쌓는다(platform-settings/). 예약은 하루 여섯
// 번(다른 동기화와 같은 시각), 매체마다 /log에 따로 남는다.
import {
  daangnAdsApiKey,
  googleClientId,
  googleClientSecret,
  googleDeveloperToken,
  metaAdsId,
  naverAccessLicense,
  naverSecretKey,
  openaiAdsApiKey,
} from '../config'
import { recordBatchRun } from '../batch-log'
import {
  GOOGLE_SYNC_BRAND_ID,
  GOOGLE_SYNC_CUSTOMER_ID,
  GOOGLE_SYNC_LOGIN_CUSTOMER_ID,
} from '../channel/google'
import { CUSTOMER_ID as NAVER_CUSTOMER_ID } from '../channel/naver/constants'
import { db } from '../data'
import { endpoint } from '../http'
import {
  syncDaangnPlatformSettings,
  syncGooglePlatformSettings,
  syncMetaPlatformSettings,
  syncNaverPlatformSettings,
  syncOpenaiPlatformSettings,
} from '../platform-settings'
import { scheduledSync } from '../scheduled-sync'
import { onRequest } from '../trace/functions'

const SECRETS = [
  metaAdsId,
  googleClientId,
  googleClientSecret,
  googleDeveloperToken,
  naverAccessLicense,
  naverSecretKey,
  openaiAdsApiKey,
  daangnAdsApiKey,
]
// Google 키워드 조건이 수천 줄이라 기본(256MiB)보다 조금 넉넉히.
const MEMORY = '512MiB'

/** 매체마다 하나 — 차례로 돌고, 하나가 실패해도 다음 매체는 돈다. */
const JOBS = [
  {
    job: 'meta-settings',
    label: 'Meta 설정',
    run: () => syncMetaPlatformSettings(metaAdsId.value()),
  },
  {
    job: 'google-settings',
    label: 'Google 설정',
    run: () =>
      syncGooglePlatformSettings(GOOGLE_SYNC_BRAND_ID, {
        clientId: googleClientId.value(),
        clientSecret: googleClientSecret.value(),
        developerToken: googleDeveloperToken.value(),
        customerId: GOOGLE_SYNC_CUSTOMER_ID,
        loginCustomerId: GOOGLE_SYNC_LOGIN_CUSTOMER_ID,
      }),
  },
  {
    job: 'naver-settings',
    label: '네이버 설정',
    run: () =>
      syncNaverPlatformSettings({
        apiKey: naverAccessLicense.value(),
        secretKey: naverSecretKey.value(),
        customerId: NAVER_CUSTOMER_ID,
      }),
  },
  {
    job: 'openai-settings',
    label: 'OpenAI 설정',
    run: () => syncOpenaiPlatformSettings({ apiKey: openaiAdsApiKey.value() }),
  },
  {
    job: 'daangn-settings',
    label: '당근 설정',
    run: () => syncDaangnPlatformSettings({ apiKey: daangnAdsApiKey.value() }),
  },
]

/** 수동 실행(POST) — 다섯 매체를 차례로, 매체마다 /log에 남기고 결과(실패면
 * 오류 문구)를 매체별로 돌려준다. */
export const syncPlatformSettings = onRequest(
  { secrets: SECRETS, timeoutSeconds: 300, memory: MEMORY },
  endpoint({ method: 'POST', fallback: '매체 설정 동기화 실패' }, async () => {
    const out: Record<string, unknown> = {}
    for (const { job, run } of JOBS) {
      try {
        out[job] = await recordBatchRun(
          db,
          { job, codebase: 'cmip', trigger: 'manual' },
          run,
        )
      } catch (err) {
        out[job] = { error: err instanceof Error ? err.message : String(err) }
      }
    }
    return out
  }),
)

export const syncPlatformSettingsScheduled = scheduledSync({
  secrets: SECRETS,
  windowDays: 0,
  memory: MEMORY,
  jobs: JOBS,
})

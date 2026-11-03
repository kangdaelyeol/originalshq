// 광고 설정·캠페인/광고셋 일별 성과 엔드포인트.
import '../config'
import * as logger from 'firebase-functions/logger'
import {
  backfillAdEntities as backfillAdEntitiesFromDb,
  ENTITY_KEY,
  deleteCreativeSet,
  deleteTest,
  deleteVersion,
  getAdEntityDaily as readAdEntityDaily,
  getAdSettingsSnapshot,
  saveTest,
  saveCreativeSet,
  saveGoal,
  saveVersion,
  validateSaveAdSettings,
  type AdChannel,
  type AdLevel,
} from '../ad-settings'
import { endpoint, HttpError } from '../http'
import { onRequest } from '../trace/functions'

// ────────────────────────────────
// 광고 설정 — 캠페인·광고셋마다 전환 목표·소비 설정 비용·소재 셋 등을 손으로
// 등록한다(ad-settings/types.ts 주석 참고). 설정은 적용 시작일마다 한 장씩
// 쌓여 바꾸기 전/후를 나눠 볼 수 있고, 앞날로 넣으면 그 날부터 적용(예약)된다.
// ────────────────────────────────

/** 목록·전환 목표·소재 셋·설정 기록 전부(GET). */
export const getAdSettings = onRequest(
  endpoint({ method: 'GET', fallback: '광고 설정 조회 실패' }, () =>
    getAdSettingsSnapshot(),
  ),
)

/** 저장·삭제(POST) — { action: saveVersion | deleteVersion | saveGoal |
 * saveCreativeSet | deleteCreativeSet, ... }. 저장할 수 없는 요청은
 * AdSettingsError(HttpError)의 상태 코드로 응답한다. */
export const saveAdSettings = onRequest(
  endpoint(
    {
      method: 'POST',
      validate: (request) => validateSaveAdSettings(request.body),
      fallback: '광고 설정 저장 실패',
    },
    async ({ data: req }) => {
      switch (req.action) {
        case 'saveVersion': {
          const version = await saveVersion(req.version)
          logger.info('광고 설정 저장:', version.id)
          return { version }
        }
        case 'deleteVersion': {
          if (!(await deleteVersion(req.id))) {
            throw new HttpError(404, '설정 기록을 찾을 수 없습니다')
          }
          logger.info('광고 설정 삭제:', req.id)
          return { id: req.id, deleted: true }
        }
        case 'saveGoal': {
          const goal = await saveGoal(req.key, req.goal)
          logger.info('전환 목표 저장:', goal.key)
          return { goal }
        }
        case 'saveCreativeSet': {
          const set = await saveCreativeSet(req.id, req.set)
          logger.info('소재 셋 저장:', set.id)
          return { set }
        }
        case 'saveTest': {
          const test = await saveTest(req.test)
          logger.info('매체별 테스트 저장:', test.id)
          return { test }
        }
        case 'deleteTest': {
          if (!(await deleteTest(req.entityKey))) {
            throw new HttpError(404, '테스트를 찾을 수 없습니다')
          }
          logger.info('매체별 테스트 삭제:', req.entityKey)
          return { entityKey: req.entityKey, deleted: true }
        }
        case 'deleteCreativeSet': {
          if (!(await deleteCreativeSet(req.id))) {
            throw new HttpError(404, '소재 셋을 찾을 수 없습니다')
          }
          logger.info('소재 셋 삭제:', req.id)
          return { id: req.id, deleted: true }
        }
      }
    },
  ),
)

/** 캠페인·광고셋 하나의 일별 성과(GET ?entityKey=채널:단위:ID) — 매체별
 * 테스트가 구간마다 지표를 나눠 본다. 데이터가 있는 날 전부(날짜 순). */
export const getAdEntityDaily = onRequest(
  endpoint(
    { method: 'GET', fallback: '일별 성과 조회 실패' },
    async ({ request }) => {
      const entityKey = String(request.query.entityKey ?? '')
      const match = ENTITY_KEY.exec(entityKey)
      if (!match) {
        throw new HttpError(400, 'entityKey는 "채널:단위:ID" 모양이어야 합니다')
      }
      const byDate = await readAdEntityDaily(
        match[1] as AdChannel,
        match[2] as AdLevel,
        match[3],
      )
      return { entityKey, byDate }
    },
  ),
)

/** 이미 쌓인 일별 행 전부로 캠페인·광고셋 목록을 다시 만든다(POST) — 배포
 * 직후 한 번(이 기능 전에 동기화된 기간), 그리고 목록이 어긋났을 때. */
export const backfillAdEntities = onRequest(
  { timeoutSeconds: 540, memory: '1GiB' },
  endpoint({ method: 'POST', fallback: '목록 다시 만들기 실패' }, async () => {
    const result = await backfillAdEntitiesFromDb()
    logger.info('adEntities 다시 만들기:', result)
    return result
  }),
)

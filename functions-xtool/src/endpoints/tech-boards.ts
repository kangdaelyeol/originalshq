import * as logger from 'firebase-functions/logger'
import { onRequest } from 'firebase-functions/https'
import { onSchedule } from 'firebase-functions/scheduler'
import { recordBatchRun } from '../batch-log'
import { listTechBoards, syncTechBoards } from '../tech-boards'
import { db, mondayApiKey } from '../app'
import { endpoint } from '../http'

// 기술지원팀 전용 보드(자료정리·AS 신청서·부품·대여품·SN) — 고객 통합
// (syncMondayBoards)과 따로 돈다. tech 페이지(/xtool-tech)만 읽는다.

// 보드 다섯 개, 합쳐 수백 건 — 보통 수십 초 안에 끝난다.
const TECH_SYNC_TIMEOUT_SECONDS = 300

// ────────────────────────────────
// getTechBoards — 저장된 보드 다섯 개의 기록과 마지막 동기화 결과
//   GET → { boards: { records, asRequests, parts, rentals, serials } }
// ────────────────────────────────
export const getTechBoards = onRequest(
  endpoint({ name: 'getTechBoards', method: 'GET' }, async ({ response }) => {
    const docs = await listTechBoards(db)
    response
      .status(200)
      .send({ boards: Object.fromEntries(docs.map((doc) => [doc.key, doc])) })
  }),
)

// ────────────────────────────────
// syncTechBoardsNow — 지금 바로 다시 읽기(수동, POST)
// ────────────────────────────────
export const syncTechBoardsNow = onRequest(
  { secrets: [mondayApiKey], timeoutSeconds: TECH_SYNC_TIMEOUT_SECONDS },
  endpoint(
    { name: 'syncTechBoardsNow', method: 'POST' },
    async ({ response }) => {
      const summary = await recordBatchRun(
        db,
        { job: 'tech-boards', codebase: 'xtool', trigger: 'manual' },
        () => syncTechBoards(db, mondayApiKey.value()),
        (result) => ({
          partial: result.failedCount > 0,
          note:
            result.failedCount > 0
              ? `보드 ${result.failedCount}개 동기화 실패`
              : undefined,
        }),
      )
      response.status(200).send(summary)
    },
  ),
)

// ────────────────────────────────
// syncTechBoardsScheduled — Monday 동기화와 같은 시각(09·11·13·15·17·22시 KST)
// ────────────────────────────────
export const syncTechBoardsScheduled = onSchedule(
  {
    schedule: '0 9,11,13,15,17,22 * * *',
    timeZone: 'Asia/Seoul',
    secrets: [mondayApiKey],
    timeoutSeconds: TECH_SYNC_TIMEOUT_SECONDS,
  },
  async (event) => {
    try {
      const summary = await recordBatchRun(
        db,
        {
          job: 'tech-boards',
          codebase: 'xtool',
          trigger: 'scheduled',
          scheduledAt: event.scheduleTime,
        },
        () => syncTechBoards(db, mondayApiKey.value()),
        (result) => ({
          partial: result.failedCount > 0,
          note:
            result.failedCount > 0
              ? `보드 ${result.failedCount}개 동기화 실패`
              : undefined,
        }),
      )
      logger.info(
        `기술 보드 자동 동기화 완료: 성공 ${summary.okCount}개, ` +
          `실패 ${summary.failedCount}개`,
      )
    } catch (error) {
      logger.error('기술 보드 자동 동기화 실패:', error)
    }
  },
)

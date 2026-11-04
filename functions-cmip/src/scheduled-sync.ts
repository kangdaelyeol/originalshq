// 광고·주문 동기화의 공통 부분 — 예약 실행은 하루 6번(KST) "최근 N일"을 다시
// 받아 upsert하고, 작업마다 /log 기록(batch-log.ts)과 성공·실패 로그를 남긴다.
// 수동 실행(sync* HTTP 함수)은 body로 기간을 받고, 없으면 같은 "최근 N일".
import * as logger from 'firebase-functions/logger'
import type { SecretParam } from 'firebase-functions/params'
import type { MemoryOption } from 'firebase-functions/v2/options'
import type { Request } from 'firebase-functions/v2/https'
import { recordBatchRun } from './batch-log'
import { addDays, todayISO } from './channel/utils'
import { db } from './data'
import { onSchedule } from './trace/functions'

/** 예약 시각 — /log 화면의 SCHEDULE_HOURS(src/screens/log/constants.ts)와
 * 같아야 한다(다르면 화면이 "누락"으로 본다). */
const SYNC_SCHEDULE = '0 9,11,13,15,17,22 * * *'

export interface SyncRange {
  dateStart: string
  dateEnd: string
}

/** 오늘까지 최근 windowDays일. */
const recentRange = (windowDays: number): SyncRange => {
  const dateEnd = todayISO()
  return { dateStart: addDays(dateEnd, -windowDays), dateEnd }
}

/** 수동 동기화의 기간 — body의 startDate/endDate, 비어 있으면 endDate(기본
 * 오늘)까지 최근 windowDays일. 과거를 넓게 백필할 때만 범위를 넘긴다. */
export const requestedRange = (
  request: Request,
  windowDays: number,
): SyncRange => {
  const { startDate, endDate } = (request.body ?? {}) as {
    startDate?: string
    endDate?: string
  }
  const dateEnd = endDate || todayISO()
  return { dateStart: startDate || addDays(dateEnd, -windowDays), dateEnd }
}

interface ScheduledJob {
  /** /log의 작업 id(src/screens/log/constants.ts BATCH_JOBS). */
  job: string
  /** 로그 문구 — "<label> 자동 동기화 성공:". */
  label: string
  run: (range: SyncRange) => Promise<unknown>
}

/**
 * 예약 동기화 함수를 만든다. jobs는 차례로 돌고, 하나가 실패해도 다음 작업은
 * 돈다(/log에도 따로 남는다).
 */
export const scheduledSync = (options: {
  secrets: SecretParam[]
  /** 다시 받을 최근 일수 — 기간을 쓰지 않는 작업(소재 동기화 등)이면 0. */
  windowDays: number
  jobs: ScheduledJob[]
  /** 기본 300초 · 256MiB · CPU 1개(전역 기본값). */
  timeoutSeconds?: number
  memory?: MemoryOption
  cpu?: number
}) =>
  onSchedule(
    {
      schedule: SYNC_SCHEDULE,
      timeZone: 'Asia/Seoul',
      secrets: options.secrets,
      timeoutSeconds: options.timeoutSeconds ?? 300,
      ...(options.memory ? { memory: options.memory } : {}),
      ...(options.cpu ? { cpu: options.cpu } : {}),
    },
    async (event) => {
      const range = recentRange(options.windowDays)
      for (const { job, label, run } of options.jobs) {
        try {
          const result = await recordBatchRun(
            db,
            {
              job,
              codebase: 'cmip',
              trigger: 'scheduled',
              scheduledAt: event.scheduleTime,
              params: { ...range },
            },
            () => run(range),
          )
          logger.info(`${label} 자동 동기화 성공:`, result)
        } catch (err) {
          logger.error(
            `${label} 자동 동기화 실패:`,
            err instanceof Error ? err.message : err,
          )
        }
      }
    },
  )

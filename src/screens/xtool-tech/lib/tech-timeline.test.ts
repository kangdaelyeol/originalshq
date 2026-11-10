import { describe, expect, it } from 'vitest'
import type { TechColumn } from '@xtool-core/tech-boards'
import type { TechBoardKey } from '@xtool-core/tech-boards'
import { orderColumns } from '@xtool-core/column-order'
import {
  isTimelineColumn,
  missingTimelineTitles,
  TIMELINE_ID,
  timelineColumns,
  timelineSteps,
} from '@xtool-core/tech-timeline'

// 타임라인 칸 묶기(xtool-core/tech-timeline) — 나머지 칸은 Monday 순서, 타임라인은 맨 오른쪽에 단계 순서.

// 직원이 바꾼 순서 없이 — 타임라인 묶기만 본다(순서는 column-order.test.ts)
const arrange = (boardKey: TechBoardKey, columns: TechColumn[], open: boolean) =>
  orderColumns(boardKey, columns, { open })

const col = (id: string, title: string, type = 'date'): TechColumn => ({ id, title, type, writable: true })

const FIELD = [
  col('status', '상태', 'status'),
  col('received', '접수일'),
  col('done', '완료일'),
  col('visit', '방문일정'),
  col('first', '1차 안내'),
  col('hold', '보류 시작일'),
  col('memo', '비고', 'text'),
  col('start', '일정 조율 시작일'),
]

describe('타임라인 칸', () => {
  it('목록의 날짜 칸만 단계 순서로 고른다(접수일·방문일정은 빼고, 띄어쓰기는 무시)', () => {
    const columns = [...FIELD, col('fixed', '일정확정일')]
    expect(timelineColumns('fieldService', columns).map((c) => c.id)).toEqual([
      'start',
      'first',
      'fixed',
      'done',
      'hold',
    ])
  })

  it('같은 제목이어도 날짜 칸이 아니면 넣지 않는다', () => {
    expect(timelineColumns('fieldService', [col('first', '1차 안내', 'text')])).toEqual([])
  })

  it('제목이 같은 칸이 없으면 제목을 포함하는 날짜 칸 하나를 쓴다', () => {
    const columns = [
      col('first', '1차 안내일'),
      col('latest', '최신 연락 일자(일정 조율)'),
      col('a', '보류 시작일 (1)'),
      col('b', '보류 시작일 (2)'),
    ]
    // 보류 시작일은 포함하는 칸이 둘이라 고르지 않는다.
    expect(timelineColumns('fieldService', columns).map((c) => c.id)).toEqual(['first', 'latest'])
  })

  it('접으면 맨 오른쪽 "타임라인" 칸 하나로 묶고 나머지 칸 순서는 그대로 둔다', () => {
    const bundled = arrange('fieldService', FIELD, false)
    expect(bundled.map((c) => c.id)).toEqual(['status', 'received', 'visit', 'memo', TIMELINE_ID])
    const timeline = bundled[bundled.length - 1]
    expect(isTimelineColumn(timeline) && timeline.parts.map((c) => c.id)).toEqual(['start', 'first', 'done', 'hold'])
  })

  it('펼치면 맨 오른쪽에 단계 순서대로 칸마다 둔다', () => {
    expect(arrange('fieldService', FIELD, true).map((c) => c.id)).toEqual([
      'status',
      'received',
      'visit',
      'memo',
      'start',
      'first',
      'done',
      'hold',
    ])
  })

  it('AS는 수리 단계 날짜를 단계 순서로 묶는다(상태 칸은 이름이 같아도 날짜 칸이 아니라 빼고)', () => {
    const columns = [
      col('status', '수리 진행 상태', 'status'),
      col('received', '접수일'),
      col('done', '완료일'),
      col('checkLabel', '수령 후 1차 체크', 'status'),
      col('check', '수령 후 1차 체크'),
      col('repairing', '수리 중'),
      col('quote', '완료 후 견적 안내'),
      col('shipped', '발송 완료'),
      col('holdStart', '보류 시작일'),
      col('holdEnd', '보류 종료일'),
    ]
    const bundled = arrange('repair', columns, false)
    expect(bundled.map((c) => c.id)).toEqual(['status', 'received', 'checkLabel', TIMELINE_ID])
    const timeline = bundled[bundled.length - 1]
    expect(isTimelineColumn(timeline) && timeline.parts.map((c) => c.id)).toEqual([
      'check',
      'repairing',
      'quote',
      'shipped',
      'done',
      'holdStart',
      'holdEnd',
    ])
  })

  it('아톡문의는 시간추적(타이머)과 상담 단계 날짜 — 칸 이름이 목록보다 짧아도("완료") 찾는다', () => {
    const columns = [
      col('status', '상담 상태', 'status'),
      col('received', '접수일자'),
      col('timer', '시간 추적', 'time_tracking'),
      col('first', '1차 안내'),
      col('done', '완료'),
    ]
    expect(timelineColumns('techInquiry', columns).map((c) => c.id)).toEqual(['timer', 'first', 'done'])
  })

  it('목록이 없는 보드나 타임라인 칸이 없으면 그대로', () => {
    expect(arrange('techTask', FIELD, false).map((c) => c.id)).toEqual(FIELD.map((c) => c.id))
    expect(arrange('fieldService', [col('memo', '비고', 'text')], false).map((c) => c.id)).toEqual(['memo'])
  })

  it('칸 이름 점검 — 목록에서 못 찾은 타임라인 제목', () => {
    expect(missingTimelineTitles('fieldService', FIELD)).toEqual([
      '최신 연락 일자 (일정 조율)',
      '일정 확정일',
      '보류 종료일',
    ])
    expect(missingTimelineTitles('techTask', FIELD)).toEqual([])
  })

  it('상세 화면 단계 — 단계 순서로, 날짜는 글자·시간 추적은 쌓인 시간이 있으면 값이 있다', () => {
    const columns = [col('timer', '시간추적', 'time_tracking'), col('first', '1차 안내일'), col('done', '완료일')]
    const item = {
      values: {
        timer: { text: '', value: JSON.stringify({ running: 'true', startDate: 1, duration: 0 }) },
        first: { text: '2026-11-10', value: null },
      },
    }
    expect(timelineSteps('techInquiry', columns, item).map((s) => [s.column.id, s.filled])).toEqual([
      ['timer', true],
      ['first', true],
      ['done', false],
    ])
  })
})

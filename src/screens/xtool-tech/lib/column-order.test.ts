import { describe, expect, it } from 'vitest'
import type { TechColumn } from '@xtool-core/tech-boards'
import { columnUnits, missingDefaultMoves, moveUnit, orderColumns } from '@xtool-core/column-order'
import { isTimelineColumn, TIMELINE_ID } from '@xtool-core/tech-timeline'

// 칸 순서(xtool-core/column-order) — 기본 순서(보드별 옮기기·타임라인 맨 오른쪽)와 직원이 바꾼 순서.

const col = (id: string, title: string, type = 'text'): TechColumn => ({ id, title, type, writable: true })

// AS 2026 — Monday 순서. 화면 이름이라 전화 칸은 "연락처"
const REPAIR = [
  col('status', '수리 진행 상태', 'status'),
  col('received', '접수일', 'date'),
  col('device', '기기'),
  col('phone', '연락처', 'phone'),
  col('memo', '비고'),
  col('check', '수령 후 1차 체크', 'date'),
  col('done', '완료일', 'date'),
]

const ids = (columns: TechColumn[]) => columns.map((c) => c.id)

describe('칸 순서', () => {
  it('AS 기본 순서 — 접수일은 연락처 오른쪽, 타임라인은 맨 오른쪽 한 칸', () => {
    expect(ids(orderColumns('repair', REPAIR, { open: false }))).toEqual([
      'status',
      'device',
      'phone',
      'received',
      'memo',
      TIMELINE_ID,
    ])
  })

  it('바꾼 순서가 있으면 그 순서로, 순서에 없는 새 칸은 끝에 붙는다', () => {
    const order = ['memo', TIMELINE_ID, 'phone', 'status', 'received']
    expect(ids(orderColumns('repair', REPAIR, { open: false, order }))).toEqual([
      'memo',
      TIMELINE_ID,
      'phone',
      'status',
      'received',
      'device',
    ])
  })

  it('타임라인을 펼치면 그 자리에 단계 순서대로', () => {
    const order = ['memo', TIMELINE_ID, 'phone', 'status', 'received', 'device']
    expect(ids(orderColumns('repair', REPAIR, { open: true, order }))).toEqual([
      'memo',
      'check',
      'done',
      'phone',
      'status',
      'received',
      'device',
    ])
  })

  it('숨긴 칸은 빼되 순서는 숨긴 칸까지 셈한다 — 타임라인 칸이 다 숨겨지면 타임라인도 없다', () => {
    const shown = orderColumns('repair', REPAIR, { open: false, hidden: ['memo', 'check'] })
    expect(ids(shown)).toEqual(['status', 'device', 'phone', 'received', TIMELINE_ID])
    const timeline = shown[shown.length - 1]
    expect(isTimelineColumn(timeline) && ids(timeline.parts)).toEqual(['done'])
    expect(ids(orderColumns('repair', REPAIR, { open: false, hidden: ['check', 'done'] }))).not.toContain(TIMELINE_ID)
  })

  it('지워진 칸이나 겹친 id는 순서에서 빠진다', () => {
    expect(columnUnits('repair', REPAIR, ['gone', 'memo', 'memo'])).toEqual([
      'memo',
      'status',
      'device',
      'phone',
      'received',
      TIMELINE_ID,
    ])
  })

  it('칸 단위를 앞으로·맨 끝으로 옮긴다', () => {
    const units = ['a', 'b', 'c', 'd']
    expect(moveUnit(units, 'd', 'b')).toEqual(['a', 'd', 'b', 'c'])
    expect(moveUnit(units, 'a', null)).toEqual(['b', 'c', 'd', 'a'])
    expect(moveUnit(units, 'b', 'c')).toEqual(units)
  })

  it('칸 이름 점검 — 기본 자리 옮기기에 쓰는 칸이 없으면 알린다', () => {
    expect(missingDefaultMoves('repair', REPAIR)).toEqual([])
    const renamed = REPAIR.map((c) => (c.id === 'received' ? { ...c, title: '접수 날짜' } : c))
    expect(missingDefaultMoves('repair', renamed)).toEqual([{ title: '접수일', after: '연락처', missing: ['접수일'] }])
  })
})

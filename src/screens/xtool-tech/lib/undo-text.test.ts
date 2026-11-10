import { describe, expect, it } from 'vitest'
import { describeChange, josa, revertText, undoText } from '@xtool-core/undo-text'

// 되돌리기 알림 글(xtool-core/undo-text) — 받침에 맞는 조사와 바꾼 것 설명.

describe('조사', () => {
  it('받침에 따라 을/를·(으)로를 고른다(ㄹ 받침은 "로")', () => {
    expect(josa('상태', '을/를')).toBe('를')
    expect(josa('담당자', '을/를')).toBe('를')
    expect(josa('방문일정', '을/를')).toBe('을')
    expect(josa('수리 중', '(으)로')).toBe('으로')
    expect(josa('완료', '(으)로')).toBe('로')
    expect(josa('서울', '(으)로')).toBe('로')
  })

  it('숫자는 읽는 소리로 — 1(일)·3(삼)은 받침, 2(이)는 없다', () => {
    expect(josa('3', '(으)로')).toBe('으로')
    expect(josa('1', '(으)로')).toBe('로')
    expect(josa('2', '을/를')).toBe('를')
  })
})

describe('알림 글', () => {
  it('칸 하나 — 바꾼 값·비운 값·값을 모를 때', () => {
    expect(describeChange({ kind: 'column', title: '상태', to: '수리 중' })).toBe("상태를 '수리 중'으로 수정했어요")
    expect(describeChange({ kind: 'column', title: '방문일정', to: '' })).toBe('방문일정을 비웠어요')
    expect(describeChange({ kind: 'column', title: '주소', to: null })).toBe('주소를 수정했어요')
  })

  it('긴 값은 줄여 보인다', () => {
    const long = '가'.repeat(40)
    expect(describeChange({ kind: 'column', title: '비고', to: long })).toBe(
      `비고를 '${'가'.repeat(30)}…'로 수정했어요`,
    )
  })

  it('여러 칸이면 "첫 칸 외 N개", 여러 항목을 옮기면 그룹 이름으로', () => {
    expect(
      undoText([
        {
          itemName: '고객',
          changes: [
            { kind: 'column', title: '상태', to: '완료' },
            { kind: 'column', title: '비고', to: 'x' },
            { kind: 'name', to: '새 이름' },
          ],
        },
      ]),
    ).toEqual({ title: '고객', message: '상태 외 2개를 수정했어요' })
    expect(
      undoText([
        { itemName: 'A', changes: [{ kind: 'group', to: '완료' }] },
        { itemName: 'B', changes: [{ kind: 'group', to: '완료' }] },
      ]),
    ).toEqual({ title: '2개 항목', message: "'완료' 그룹으로 옮겼어요" })
  })

  it('되돌린 뒤 글', () => {
    expect(revertText([{ itemName: '고객', changes: [{ kind: 'column', title: '상태', to: '완료' }] }])).toBe(
      '고객 · 상태를 되돌렸어요',
    )
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TechBoardMeta, TechEditInput, TechItemDoc } from '@xtool-core/tech-boards'

// 되돌리기(xtool-core/tech-outbox) — 고치면 "…을 …로 수정했어요 · 되돌리기" 토스트, 누르면 고치기 전 값을 같은
// 대기열로 보낸다. 서버 호출·토스트는 가짜로 바꿔 받아 둔다(tech-outbox.test.ts와 같은 방법).

interface Call {
  input: TechEditInput
  resolve: (data: { itemId: string | null; conflicts?: unknown[]; createdSubitems?: string[] }) => void
}

interface FakeToast {
  title: string
  message?: string
  action?: { label: string; run: () => void }
}

const calls: Call[] = []
const toasts: FakeToast[] = []
const deleted: string[][] = []

const call = (input: TechEditInput) =>
  new Promise<{ data: unknown }>((resolve) => {
    calls.push({ input, resolve: (data) => resolve({ data }) })
  })

vi.mock('@xtool-core/tech-boards', () => ({
  MAX_DELETE: 25,
  updateTechItem: (input: TechEditInput) => call(input),
  createTechItem: (input: TechEditInput) => call(input),
  deleteTechItems: async (_board: string, ids: string[]) => {
    deleted.push(ids)
    return { deleted: ids, failed: [] }
  },
}))

vi.mock('@xtool-core/tech-save-queue', () => ({
  pushToast: (toast: FakeToast) => {
    toasts.push(toast)
    return toasts.length
  },
  // 떠 있는 되돌리기 토스트를 바꾸면 그 자리 토스트를 바꾼다(번호 = 순서 + 1)
  setToast: (id: number, toast: FakeToast) => {
    toasts[id - 1] = toast
  },
  dismissToast: () => undefined,
  hasToast: (id: number) => id > 0 && id <= toasts.length,
  markSaving: () => undefined,
}))

const BOARD = 'fieldService'
const ITEM = '100'

const META = {
  key: BOARD,
  boardId: '1',
  name: '출장업무',
  columns: [
    { id: 'status', title: '상태', type: 'status', writable: true },
    { id: 'memo', title: '비고', type: 'long_text', writable: true },
  ],
  groups: [
    { id: 'g1', title: '신규 출장 건' },
    { id: 'g2', title: '완료' },
  ],
  subitems: { boardId: '2', columns: [{ id: 'qty', title: '수량', type: 'numbers', writable: true }] },
} as unknown as TechBoardMeta

const rawItem = (id = ITEM, name = '고객'): TechItemDoc =>
  ({
    itemId: id,
    boardKey: BOARD,
    boardId: '1',
    name,
    groupId: 'g1',
    record: {},
    values: { status: { text: '신규 출장', value: '{"index":1}' }, memo: { text: '처음 메모', value: null } },
    subitems: [{ id: '900', name: '에어컨', values: { qty: { text: '2', value: '"2"' } } }],
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
    syncedAt: 0,
  }) as unknown as TechItemDoc

const settleAll = () => new Promise((resolve) => setTimeout(resolve, 0))
const undoToasts = () => toasts.filter((t) => t.action?.label === '되돌리기')
const lastUndo = () => undoToasts().at(-1)

let outbox: typeof import('@xtool-core/tech-outbox')

beforeEach(async () => {
  calls.length = 0
  toasts.length = 0
  deleted.length = 0
  vi.resetModules()
  outbox = await import('@xtool-core/tech-outbox')
  outbox.observeMeta(BOARD, META)
  outbox.observeRaw(BOARD, [rawItem(), rawItem('101', '두 번째')])
})

const setStatus = (label: string) =>
  outbox.editItem(BOARD, ITEM, { columns: { status: { value: label, preview: { text: label, value: null } } } }, '상태')

describe('되돌리기', () => {
  it('칸을 고치면 무엇을 무엇으로 바꿨는지 알리고, 되돌리면 고치기 전 값을 보낸다', async () => {
    setStatus('완료')
    expect(lastUndo()).toMatchObject({ title: '고객', message: "상태를 '완료'로 수정했어요" })

    calls[0].resolve({ itemId: ITEM, conflicts: [] })
    await settleAll()
    lastUndo()?.action?.run()
    expect(calls).toHaveLength(2)
    expect(calls[1].input.columns).toEqual({ status: '신규 출장' })
    // 되돌린 것은 되돌리기 토스트를 다시 띄우지 않는다.
    expect(undoToasts()).toHaveLength(1)
    expect(toasts.at(-1)?.title).toBe('되돌렸어요')
  })

  it('저장 중에 되돌려도 순서대로 — 앞 요청이 끝난 뒤 되돌린 값을 보낸다', async () => {
    setStatus('완료')
    lastUndo()?.action?.run()
    // 화면은 바로 처음 값
    expect(outbox.applyPending(BOARD, [rawItem()])[0].values.status?.text).toBe('신규 출장')
    expect(calls).toHaveLength(1)
    calls[0].resolve({ itemId: ITEM, conflicts: [] })
    await settleAll()
    expect(calls[1].input.columns).toEqual({ status: '신규 출장' })
  })

  it('새로 고치면 토스트가 그것으로 바뀐다(마지막 것만 되돌린다)', () => {
    setStatus('완료')
    outbox.editItem(BOARD, ITEM, { columns: { memo: { value: '', preview: { text: '', value: null } } } }, '비고')
    expect(undoToasts()).toHaveLength(1)
    expect(lastUndo()?.message).toBe('비고를 비웠어요')
  })

  it('하위 줄 수량을 고치면 그 줄 이름과 함께 알리고 되돌린다', async () => {
    outbox.editItem(
      BOARD,
      ITEM,
      {
        subitems: { update: [{ id: '900', columns: { qty: '5' } }] },
        subitemPreviews: { '900': { qty: { text: '5', value: null } } },
      },
      '수량',
    )
    expect(lastUndo()?.message).toBe("'에어컨' 수량을 '5'로 수정했어요")
    calls[0].resolve({ itemId: ITEM, conflicts: [] })
    await settleAll()
    lastUndo()?.action?.run()
    expect(calls[1].input.subitems?.update).toEqual([{ id: '900', columns: { qty: '2' } }])
  })

  it('하위 줄을 더하면 되돌릴 때 그 줄을 지운다(만들어진 뒤면 Monday id로)', async () => {
    outbox.editItem(BOARD, ITEM, { subitems: { create: [{ name: '세탁기' }] } }, '세탁기')
    expect(lastUndo()?.message).toBe("하위 아이템 '세탁기'를 추가했어요")
    calls[0].resolve({ itemId: ITEM, conflicts: [], createdSubitems: ['901'] })
    await settleAll()
    lastUndo()?.action?.run()
    expect(calls[1].input.subitems?.remove).toEqual(['901'])
  })

  it('하위 줄 지우기는 되돌릴 수 없어 되돌리기 토스트를 띄우지 않는다', () => {
    outbox.editItem(BOARD, ITEM, { subitems: { remove: ['900'] } }, '삭제')
    expect(undoToasts()).toHaveLength(0)
  })

  it('여러 항목을 옮기면 토스트 하나로 알리고 한 번에 되돌린다', async () => {
    outbox.moveItems(BOARD, [ITEM, '101'], 'g2')
    expect(undoToasts()).toHaveLength(1)
    expect(lastUndo()).toMatchObject({ title: '2개 항목', message: "'완료' 그룹으로 옮겼어요" })
    for (const c of calls) c.resolve({ itemId: c.input.itemId ?? null, conflicts: [] })
    await settleAll()
    lastUndo()?.action?.run()
    expect(calls.slice(2).map((c) => [c.input.itemId, c.input.groupId])).toEqual([
      [ITEM, 'g1'],
      ['101', 'g1'],
    ])
  })

  it('새 항목은 되돌리면 지운다', async () => {
    const key = outbox.createItem(BOARD, { name: '새 고객', groupId: 'g1' })
    expect(lastUndo()).toMatchObject({ title: '새 고객', message: '새 항목을 추가했어요' })
    calls[0].resolve({ itemId: '555', conflicts: [] })
    await settleAll()
    lastUndo()?.action?.run()
    await settleAll()
    expect(deleted).toEqual([['555']])
    expect(key.startsWith('temp-')).toBe(true)
  })

  it('칸 정보를 모르는 칸이 섞이면 되돌리기를 띄우지 않는다', () => {
    outbox.editItem(BOARD, ITEM, { columns: { unknown: { value: 'x', preview: { text: 'x', value: null } } } }, '?')
    expect(undoToasts()).toHaveLength(0)
  })
})

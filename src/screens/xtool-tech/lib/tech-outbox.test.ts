import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TechEditInput, TechItemDoc } from '@xtool-core/tech-boards'

// 저장 대기열(xtool-core/tech-outbox) — "만드는 중" 하위 줄을 바로 고치고 지우는 흐름. 서버 호출은 가짜로 바꿔
// 요청을 하나씩 받아 두고, 테스트가 응답(성공·실패)을 정한다.

interface Call {
  input: TechEditInput
  resolve: (data: { itemId: string | null; conflicts?: unknown[]; createdSubitems?: string[] }) => void
  reject: (error: Error) => void
}

const calls: Call[] = []
const toasts: { title: string; message?: string; action?: { label: string; run: () => void } }[] = []

const call = (input: TechEditInput) =>
  new Promise<{ data: unknown }>((resolve, reject) => {
    calls.push({ input, resolve: (data) => resolve({ data }), reject })
  })

vi.mock('@xtool-core/tech-boards', () => ({
  MAX_DELETE: 25,
  updateTechItem: (input: TechEditInput) => call(input),
  createTechItem: (input: TechEditInput) => call(input),
  deleteTechItems: async () => ({ deleted: [], failed: [] }),
}))

vi.mock('@xtool-core/tech-save-queue', () => ({
  pushToast: (toast: { title: string; message?: string; action?: { label: string; run: () => void } }) => {
    toasts.push(toast)
    return toasts.length
  },
  setToast: () => undefined,
  dismissToast: () => undefined,
  hasToast: () => false,
  markSaving: () => undefined,
}))

const BOARD = 'fieldService'
const ITEM = '100'

const rawItem = (): TechItemDoc =>
  ({
    itemId: ITEM,
    boardKey: BOARD,
    boardId: '1',
    name: '고객',
    groupId: 'g1',
    record: {},
    values: {},
    subitems: [],
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
    syncedAt: 0,
  }) as unknown as TechItemDoc

// 응답을 받은 뒤 then·settle·다음 요청까지 돌게 둔다.
const settleAll = () => new Promise((resolve) => setTimeout(resolve, 0))

let outbox: typeof import('@xtool-core/tech-outbox')

beforeEach(async () => {
  calls.length = 0
  toasts.length = 0
  // 번호(s:<번호>)·상태가 테스트마다 처음부터 시작하게 모듈을 새로 읽는다.
  vi.resetModules()
  outbox = await import('@xtool-core/tech-outbox')
  outbox.observeRaw(BOARD, [rawItem()])
})

const shown = () => outbox.applyPending(BOARD, [rawItem()])[0].subitems ?? []
const add = (name: string) => outbox.editItem(BOARD, ITEM, { subitems: { create: [{ name }] } }, name)
const setQty = (id: string, qty: string) =>
  outbox.editItem(
    BOARD,
    ITEM,
    {
      subitems: { update: [{ id, columns: { qty } }] },
      subitemPreviews: { [id]: { qty: { text: qty, value: null } } },
    },
    '수량',
  )
const remove = (id: string) => outbox.editItem(BOARD, ITEM, { subitems: { remove: [id] } }, '삭제')

describe('만드는 중인 하위 줄', () => {
  it('보내는 중에 고친 것은 만들어진 뒤 Monday id로 보낸다', async () => {
    add('품목 A')
    expect(calls).toHaveLength(1)
    const draft = shown()[0]
    expect(draft.id).toBe(`${ITEM}:s:1`)

    setQty(draft.id, '3')
    // 만들기가 끝날 때까지 기다린다 — 화면에는 바로 보인다.
    expect(calls).toHaveLength(1)
    expect(shown()[0].values.qty?.text).toBe('3')

    calls[0].resolve({ itemId: ITEM, conflicts: [], createdSubitems: ['901'] })
    await settleAll()
    expect(calls).toHaveLength(2)
    expect(calls[1].input.subitems?.update).toEqual([{ id: '901', columns: { qty: '3' } }])
    // Monday id를 받은 뒤로는 그 id로 보인다(캐시에 오기 전까지).
    expect(shown()[0].id).toBe('901')
  })

  it('아직 보내지 않은 만들기에는 고친 것을 싣는다(따로 보내지 않는다)', async () => {
    outbox.editItem(BOARD, ITEM, { name: '새 이름' }, '이름')
    add('품목 A')
    const draft = shown()[0]
    setQty(draft.id, '2')
    outbox.editItem(BOARD, ITEM, { subitems: { update: [{ id: draft.id, name: '품목 B' }] } }, '이름')
    expect(shown()[0].name).toBe('품목 B')
    expect(calls).toHaveLength(1)

    calls[0].resolve({ itemId: ITEM, conflicts: [] })
    await settleAll()
    expect(calls).toHaveLength(2)
    expect(calls[1].input.subitems?.create).toEqual([{ name: '품목 B', columns: { qty: '2' } }])
    expect(calls[1].input.subitems?.update ?? []).toEqual([])
  })

  it('보내는 중에 지운 줄은 바로 빠지고, 만들어진 뒤 지운다', async () => {
    add('품목 A')
    remove(shown()[0].id)
    expect(shown()).toHaveLength(0)

    calls[0].resolve({ itemId: ITEM, conflicts: [], createdSubitems: ['901'] })
    await settleAll()
    expect(calls[1].input.subitems?.remove).toEqual(['901'])
  })

  it('아직 보내지 않은 만들기를 지우면 만들기째 빠지고 빈 요청은 보내지 않는다', async () => {
    outbox.editItem(BOARD, ITEM, { name: '새 이름' }, '이름')
    add('품목 A')
    remove(shown()[0].id)
    expect(shown()).toHaveLength(0)

    calls[0].resolve({ itemId: ITEM, conflicts: [] })
    await settleAll()
    expect(calls).toHaveLength(1)
  })

  it('만들지 못하면 그 사이 고친 것까지 "다시 시도"의 만들기에 싣는다', async () => {
    add('품목 A')
    setQty(shown()[0].id, '5')
    calls[0].reject(new Error('Monday 오류'))
    await settleAll()
    // 고친 것은 따로 보내지 않는다(보낼 줄이 없다).
    expect(calls).toHaveLength(1)
    expect(shown()).toHaveLength(0)

    const retry = toasts.find((t) => t.action?.label === '다시 시도')?.action
    expect(retry).toBeDefined()
    retry?.run()
    expect(calls).toHaveLength(2)
    expect(calls[1].input.subitems?.create).toEqual([{ name: '품목 A', columns: { qty: '5' } }])
  })

  it('서버가 만든 줄 id를 주지 않으면 고친 것은 떼고 알린다', async () => {
    add('품목 A')
    setQty(shown()[0].id, '4')
    calls[0].resolve({ itemId: ITEM, conflicts: [] })
    await settleAll()
    expect(calls).toHaveLength(1)
    expect(toasts.some((t) => t.title === '새 줄에 고친 내용을 보내지 못했어요')).toBe(true)
  })

  it('캐시에 실제 줄이 오면 만드는 중 줄은 겹쳐 보이지 않는다', async () => {
    add('품목 A')
    calls[0].resolve({ itemId: ITEM, conflicts: [], createdSubitems: ['901'] })
    await settleAll()
    const withReal = { ...rawItem(), subitems: [{ id: '901', name: '품목 A', values: {} }] }
    outbox.observeRaw(BOARD, [withReal])
    const subs = outbox.applyPending(BOARD, [withReal])[0].subitems ?? []
    expect(subs.map((sub) => sub.id)).toEqual(['901'])
  })
})

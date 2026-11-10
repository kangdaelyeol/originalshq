import * as logger from 'firebase-functions/logger'
import { squash } from '../monday/fields'
import { TechBoardSource } from './boards'
import { toTechColumns } from './columns'
import { TechEditError } from './errors'
import { toItemDocs } from './items'
import { changeColumnValues, fetchTechBoard } from './monday-api'
import { resolveSubitemRule, subitemLabels } from './rules'

// 출장업무 설치 품목 점검(관리자) — 설치 품목은 하위 줄 "품명"을 비추는 미러 칸이라, 품명이
// "{이름} {수량}개"와 다른 하위 줄을 찾아 고치면 설치 품목도 맞춰진다(rules.ts 하위 줄 규칙과 같은
// 계산). 품명은 다 맞는데 미러 글자가 맞는 값과 다른 건(미러 설정이 다르거나 Monday가 아직 안 바꿈)은
// 따로 알린다 — 미러 칸은 우리가 쓸 수 없다. Monday에서 보드를 새로 읽어 본다(캐시가 아니라).

const ROLLUP_TITLE = '설치 품목'
// 한 번에 같이 보내는 쓰기 수 — Monday 분당 한도 안에서 너무 오래 걸리지 않게(assignees.ts와 같다).
const WRITE_CONCURRENCY = 4
// 한 번 부를 때 쓰는 시간 — 함수 제한 시간 안에 끝내고, 남은 줄은 다시 불러 이어서 고친다.
const WRITE_BUDGET_MS = 180_000

export interface InstallItemsRow {
  itemId: string
  name: string
  /** 지금 설치 품목(미러 글자) — 미러 칸이 없으면 null */
  current: string | null
  /** 품명이 맞을 때 설치 품목에 보여야 할 글자 */
  expected: string
  /** 품명을 고칠 하위 줄 */
  fixes: Array<{
    subId: string
    subName: string
    from: string | null
    to: string
  }>
}

export interface InstallItemsResult {
  /** 출장 건 수 */
  total: number
  /** 하위 줄이 있는 건 수 */
  withSubitems: number
  /** 품명이 다른 하위 줄이 있는 건 */
  mismatches: InstallItemsRow[]
  /** 품명은 다 맞는데 설치 품목 글자가 다른 건 */
  mirrorOnly: InstallItemsRow[]
  /** 고칠 하위 줄 수 */
  fixCount: number
  written: number
  /** 시간이 모자라 이번에 못 고친 줄 — 다시 부르면 이어서 고친다 */
  remaining: number
  errors: Array<{ itemId: string; name: string; error: string }>
  mirror: { id: string | null; title: string }
}

// 글자 비교 — 띄어쓰기 차이는 같은 것으로 본다.
const tidy = (text: string) => text.replace(/\s+/g, ' ').trim()

/** 점검(dryRun) 또는 점검 뒤 품명이 다른 하위 줄을 고친다. */
export async function checkInstallItems(
  apiKey: string,
  source: TechBoardSource,
  dryRun: boolean,
): Promise<InstallItemsResult> {
  const raw = await fetchTechBoard(apiKey, source.boardId, true, false)
  const columns = toTechColumns(raw.columns)
  const resolved = resolveSubitemRule(source.key, {
    columns,
    groups: raw.groups,
    subitems: raw.subitemBoard ?
      {
        boardId: raw.subitemBoard.id,
        columns: toTechColumns(raw.subitemBoard.columns),
      } :
      undefined,
  })
  if (!resolved) {
    throw new TechEditError('출장 하위 줄의 품명·수량 칸을 찾지 못했어요')
  }
  const mirror = columns.find(
    (c) => c.type === 'mirror' && squash(c.title) === squash(ROLLUP_TITLE),
  )
  const docs = toItemDocs(source, raw, raw.items, Date.now())

  const result: InstallItemsResult = {
    total: docs.length,
    withSubitems: 0,
    mismatches: [],
    mirrorOnly: [],
    fixCount: 0,
    written: 0,
    remaining: 0,
    errors: [],
    mirror: { id: mirror?.id ?? null, title: mirror?.title ?? ROLLUP_TITLE },
  }
  type Fix = { row: InstallItemsRow; subId: string; label: string }
  const queue: Fix[] = []
  for (const doc of docs) {
    if ((doc.subitems ?? []).length > 0) result.withSubitems += 1
    const { fixes, joined } = subitemLabels(doc, resolved)
    const current = mirror ? doc.values[mirror.id]?.text ?? '' : null
    const row: InstallItemsRow = {
      itemId: doc.itemId,
      name: doc.name,
      current,
      expected: joined,
      fixes: fixes.map((fix) => ({
        subId: fix.sub.id,
        subName: fix.sub.name,
        from: fix.sub.values[resolved.label.id]?.text || null,
        to: fix.label,
      })),
    }
    if (fixes.length > 0) {
      result.mismatches.push(row)
      result.fixCount += fixes.length
      for (const fix of fixes) {
        queue.push({ row, subId: fix.sub.id, label: fix.label })
      }
    } else if (current !== null && tidy(current) !== tidy(joined)) {
      result.mirrorOnly.push(row)
    }
  }
  if (dryRun || queue.length === 0) return result

  const deadline = Date.now() + WRITE_BUDGET_MS
  const work = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      if (Date.now() > deadline) {
        queue.unshift(next)
        return
      }
      try {
        await changeColumnValues(apiKey, resolved.subBoardId, next.subId, {
          [resolved.label.id]: next.label,
        })
        result.written += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.warn(`설치 품목 품명 고치기 실패(${next.subId}):`, message)
        result.errors.push({
          itemId: next.row.itemId,
          name: next.row.name,
          error: message,
        })
      }
    }
  }
  await Promise.all(Array.from({ length: WRITE_CONCURRENCY }, work))
  result.remaining = queue.length
  return result
}

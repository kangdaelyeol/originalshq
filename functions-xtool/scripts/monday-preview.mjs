// Monday 보드 하나를 실제 API로 읽어, DB에 저장될 모양 그대로 미리 본다.
// DB에는 아무것도 쓰지 않는다 — 배포 전에 보드별로 raw 데이터를 확인하는 용도.
//
//   npm run build
//   MONDAY_API_KEY=... node scripts/monday-preview.mjs <boardId> [phoneColumnId] [표시할 건수=3]
//
// sync.ts의 syncBoard와 같은 함수(fetchBoard → detectPhoneColumnId →
// buildMondayItems)를 그대로 쓰므로, 여기서 보이는 값이 곧 저장될 값이다.
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { fetchBoard } = require('../lib/monday/client.js')
const { buildMondayItems, detectPhoneColumnId } = require(
  '../lib/monday/helper.js',
)

const [, , boardId, phoneColumnArg, sampleArg] = process.argv
const apiKey = process.env.MONDAY_API_KEY
if (!apiKey || !boardId) {
  console.error(
    '사용법: MONDAY_API_KEY=... node scripts/monday-preview.mjs <boardId> [phoneColumnId] [건수]',
  )
  process.exit(1)
}
const sampleSize = Number(sampleArg ?? 3)

const startedAt = Date.now()
const board = await fetchBoard(apiKey, boardId)
const phoneColumnId = phoneColumnArg || detectPhoneColumnId(board.columns)
const items = buildMondayItems(board, phoneColumnId, Date.now())

console.log(`\n■ 보드: ${board.name} (${board.id})`)
console.log(
  `  item ${items.length}건 · 컬럼 ${board.columns.length}개 · ${Date.now() - startedAt}ms`,
)

// 컬럼별로 값이 채워진 건수 — 컬럼 id가 맞는지, 비어 오는 타입은 없는지 본다.
console.log('\n■ 컬럼 (id · 타입 · 제목 · 값이 있는 건수)')
for (const column of board.columns) {
  const filled = items.filter((item) => item.columns[column.id]?.text).length
  const mark = column.id === phoneColumnId ? '  ← 휴대폰 컬럼' : ''
  console.log(
    `  ${column.id.padEnd(28)} ${column.type.padEnd(14)} ${column.title.padEnd(20)} ${String(filled).padStart(4)}/${items.length}${mark}`,
  )
}

// 휴대폰번호 — 중복 판단 기준이라 따로 요약한다.
const missing = items.filter((item) => !item.phone)
const byPhone = new Map()
for (const item of items) {
  if (!item.phone) continue
  byPhone.set(item.phone, [...(byPhone.get(item.phone) ?? []), item])
}
const duplicated = [...byPhone.values()].filter((group) => group.length > 1)
console.log('\n■ 휴대폰번호')
console.log(`  컬럼: ${phoneColumnId ?? '찾지 못함'}`)
console.log(`  번호 있음 ${items.length - missing.length}건 · 없음 ${missing.length}건`)
console.log(
  `  보드 안에서 같은 번호가 2건 이상: ${duplicated.length}개 번호 (${duplicated.reduce((sum, group) => sum + group.length, 0)}건)`,
)
if (missing.length) {
  console.log('  번호 없는 고객(최대 10건, 원래 값):')
  for (const item of missing.slice(0, 10)) {
    console.log(`    - ${item.name} · "${item.phoneRaw ?? ''}" · ${item.url}`)
  }
}

console.log(`\n■ 저장될 문서 예시 (${Math.min(sampleSize, items.length)}건)`)
for (const item of items.slice(0, sampleSize)) {
  console.log(JSON.stringify(item, null, 2))
}

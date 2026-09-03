/**
 * 구분자/헤더 감지 및 컬럼 인덱스 매핑 — Python `_detect_delimiter`, `_find_header_idx`,
 * `_repair_header`, `_index_map` 이관.
 */
import { ALIASES, HEADER_KEYWORDS, type FieldName } from './aliases.js'
import { count } from './primitives.js'

export type CsvRow = string[]

/** 헤더 → 표준 필드명 인덱스. -1 = 매칭 안 됨. */
export type IndexMap = Record<FieldName, number>

/** 네이버 리포트의 '총비용(VAT포함,원)'처럼 필드 안 콤마로 쪼개진 헤더를 다시 붙인다. */
export const repairHeader = (cells: readonly string[]): string[] => {
  const out: string[] = []
  let i = 0
  while (i < cells.length) {
    let c = String(cells[i]).trim()
    while (count(c, '(') > count(c, ')') && i + 1 < cells.length) {
      i += 1
      c = c + ',' + String(cells[i]).trim()
    }
    out.push(c)
    i += 1
  }
  return out
}

export const detectDelimiter = (txt: string): string => {
  const lines = txt
    .split('\n')
    .filter((ln) => ln.trim())
    .slice(0, 15)
  let best = ','
  let bestScore = -1
  for (const d of ['\t', ',', ';', '|']) {
    const score = lines.reduce((acc, ln) => acc + count(ln, d), 0)
    if (score > bestScore) {
      best = d
      bestScore = score
    }
  }
  return best
}

export const findHeaderIdx = (rows: readonly CsvRow[]): number => {
  for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
    const joined = rows[i].map((c) => String(c).toLowerCase()).join(' ')
    const hits = HEADER_KEYWORDS.filter((k) => joined.includes(k)).length
    if (hits >= 3) return i
  }
  return 0
}

/** 헤더 → 표준 필드명 인덱스. '정확 일치 우선, 없으면 부분 포함'. */
export const indexMap = (header: readonly string[]): IndexMap => {
  const norm = header.map((h) => String(h).trim().toLowerCase())
  // NOTE: 루프가 끝나야 모든 FieldName 키가 채워진다 — 완성 전까지는 타입상의 "약속"일 뿐이다.
  const idx = {} as IndexMap
  for (const [fieldName, names] of Object.entries(ALIASES) as Array<
    [FieldName, readonly string[]]
  >) {
    let found = -1
    for (const alias of names) {
      const a = alias.toLowerCase()
      const i = norm.indexOf(a)
      if (i >= 0) {
        found = i
        break
      }
    }
    if (found < 0) {
      for (const alias of names) {
        const a = alias.toLowerCase()
        const i = norm.findIndex((h) => h.includes(a))
        if (i >= 0) {
          found = i
          break
        }
      }
    }
    idx[fieldName] = found
  }
  return idx
}

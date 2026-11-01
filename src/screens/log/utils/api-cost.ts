import type { ApiCostByDay, ApiCostByFn } from '../client/api-cost-client'

// API 비용 어림 — 호출별 자원(읽기·쓰기·삭제·실행 시간·호출 수)에 단가를 곱한다.
//
// 가정 단가(USD) — Google 공개 요금표의 기본(US 리전) 값이다. xtool DB(서울
// 리전)·함수(us-central1)의 실제 단가와 조금 다를 수 있고, 무료 사용량도 빼지
// 않는다. 그래서 금액은 "어느 함수가 얼마만큼의 비중인지"를 보는 용도이고,
// 실제 청구액은 청구 데이터 내보내기(BigQuery billing_export)로 맞춘다.
//   · Firestore: 읽기 $0.03 / 쓰기 $0.09 / 삭제 $0.01 — 10만 건당
//   · 함수(Cloud Run 2세대, Tier 1): vCPU $0.000024/초, 메모리 $0.0000025/GiB·초,
//     호출 $0.40/100만 건. vCPU는 함수마다 1개로 가정(따로 정하지 않은 기본값).
//     동시에 여러 요청을 처리한 시간은 겹쳐 세므로 실행 비용은 넉넉히 나온다.
export const PRICE = {
  read: 0.03 / 100_000,
  write: 0.09 / 100_000,
  delete: 0.01 / 100_000,
  vcpuSecond: 0.000024,
  gibSecond: 0.0000025,
  request: 0.4 / 1_000_000,
} as const

/** 비용 항목 — 화면의 비용 구성 막대 순서. */
export type CostPart = 'read' | 'write' | 'delete' | 'compute' | 'request'

export const COST_PART_LABEL: Record<CostPart, string> = {
  read: 'Firestore 읽기',
  write: 'Firestore 쓰기',
  delete: 'Firestore 삭제',
  compute: '실행(CPU·메모리)',
  request: '호출',
}

type Usage = Pick<
  ApiCostByFn,
  'calls' | 'reads' | 'writes' | 'deletes' | 'seconds' | 'gibSeconds'
>

/** 항목별 어림 금액(USD). */
export const costParts = (usage: Usage): Record<CostPart, number> => ({
  read: usage.reads * PRICE.read,
  write: usage.writes * PRICE.write,
  delete: usage.deletes * PRICE.delete,
  compute:
    usage.seconds * PRICE.vcpuSecond + usage.gibSeconds * PRICE.gibSecond,
  request: usage.calls * PRICE.request,
})

export const totalCost = (usage: Usage): number =>
  Object.values(costParts(usage)).reduce((sum, value) => sum + value, 0)

/** 함수 하나와 그 어림 금액. */
export interface FnCost extends ApiCostByFn {
  cost: number
  parts: Record<CostPart, number>
  /** 기간 전체 금액 중 비중(0~1). */
  share: number
}

/** 함수별 금액 — 비싼 순. */
export const withCosts = (byFn: ApiCostByFn[]): FnCost[] => {
  const rows = byFn.map((each) => {
    const parts = costParts(each)
    return {
      ...each,
      parts,
      cost: Object.values(parts).reduce((sum, value) => sum + value, 0),
      share: 0,
    }
  })
  const total = rows.reduce((sum, row) => sum + row.cost, 0)
  return rows
    .map((row) => ({ ...row, share: total ? row.cost / total : 0 }))
    .sort((a, b) => b.cost - a.cost)
}

/** 날짜별 합계(모든 함수 또는 한 함수) — 오래된 날부터. */
export const costByDate = (byDay: ApiCostByDay[], fn?: string) => {
  const map = new Map<string, Usage & { date: string }>()
  for (const row of byDay) {
    if (fn && row.fn !== fn) continue
    const day = map.get(row.date) ?? {
      date: row.date,
      calls: 0,
      reads: 0,
      writes: 0,
      deletes: 0,
      seconds: 0,
      gibSeconds: 0,
    }
    day.calls += row.calls
    day.reads += row.reads
    day.writes += row.writes
    day.deletes += row.deletes
    day.seconds += row.seconds
    day.gibSeconds += row.gibSeconds
    map.set(row.date, day)
  }
  return [...map.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({ ...day, cost: totalCost(day) }))
}

/** 금액 표기 — 작은 금액도 보이게 자릿수를 늘린다. */
export const formatUsd = (value: number): string => {
  if (value === 0) return '$0'
  if (value < 0.01) return `$${value.toFixed(4)}`
  if (value < 1) return `$${value.toFixed(3)}`
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

/** 큰 수를 짧게 — 12,345 → 1.2만. */
export const formatCount = (value: number): string =>
  value >= 10_000
    ? `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1)}만`
    : value.toLocaleString('ko-KR')

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)}KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)}MB`
  return `${(bytes / 1024 ** 3).toFixed(2)}GB`
}

export const formatMs = (ms: number): string =>
  ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}초`

/** 비용 그림의 자원 노드 — 함수가 돈을 쓰는 곳. */
export const COST_RESOURCES: { id: CostPart; label: string }[] = [
  { id: 'read', label: 'Firestore 읽기' },
  { id: 'write', label: 'Firestore 쓰기' },
  { id: 'delete', label: 'Firestore 삭제' },
  { id: 'compute', label: '실행 CPU·메모리' },
  { id: 'request', label: '호출' },
]

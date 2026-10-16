import type { MondayFollowUp } from '../entity'

// ── 현재 파이프라인 ─────────────────────────────────────────────────────
// 지금 진행 중인 상담이 어느 단계에 몇 건 있는지 — 보드별로. 기간과 무관한
// 오늘 기준 현황이고, 방치 현황과 같은 "진행 중" 기록(followUps의 콜백)을
// 쓴다: 결제·미전환·오기입 상태와 완료 그룹("완료", "완료된 영업")은 빠져 있다.

export const PIPELINE_STAGES = [
  '신규 상담 유입',
  '콜백1단계',
  '콜백2단계',
  '콜백3단계',
  '콜백4단계',
  '보류(고민중)',
] as const

/** 단계를 알 수 없는 기록(상태가 비었거나 목록에 없는 상태)의 칸. */
export const PIPELINE_OTHER = '상태 없음·기타'

export type PipelineStage =
  (typeof PIPELINE_STAGES)[number] | typeof PIPELINE_OTHER

/** 기록 하나의 단계 — 보류(보류 상태이거나 "보류" 그룹)가 먼저다. */
const stageOf = (followUp: MondayFollowUp): PipelineStage => {
  if (followUp.onHold) return '보류(고민중)'
  const status = followUp.status ?? ''
  if (/신규/.test(status)) return '신규 상담 유입'
  const step = status.match(/콜백\s*([1-4])/)?.[1]
  if (step) return `콜백${step}단계` as PipelineStage
  return PIPELINE_OTHER
}

export interface PipelineRow {
  board: string
  counts: Record<PipelineStage, number>
  total: number
}

const emptyCounts = (): Record<PipelineStage, number> =>
  Object.fromEntries(
    [...PIPELINE_STAGES, PIPELINE_OTHER].map((stage) => [stage, 0]),
  ) as Record<PipelineStage, number>

/** 보드별 단계 건수와 전체 합. 칸은 단계 순서대로이고, "상태 없음·기타"는
 * 한 건이라도 있을 때만 칸으로 나온다. */
export const buildPipeline = (
  followUps: MondayFollowUp[],
): { stages: PipelineStage[]; rows: PipelineRow[]; sum: PipelineRow } => {
  const byBoard = new Map<string, PipelineRow>()
  const sum: PipelineRow = { board: '합계', counts: emptyCounts(), total: 0 }

  for (const followUp of followUps) {
    if (followUp.kind !== 'callback') continue
    const stage = stageOf(followUp)
    const row = byBoard.get(followUp.boardName) ?? {
      board: followUp.boardName,
      counts: emptyCounts(),
      total: 0,
    }
    row.counts[stage] += 1
    row.total += 1
    sum.counts[stage] += 1
    sum.total += 1
    byBoard.set(followUp.boardName, row)
  }

  return {
    stages: [
      ...PIPELINE_STAGES,
      ...(sum.counts[PIPELINE_OTHER] > 0
        ? [PIPELINE_OTHER as PipelineStage]
        : []),
    ],
    rows: [...byBoard.values()].sort((a, b) => b.total - a.total),
    sum,
  }
}

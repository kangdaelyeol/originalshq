import {
  LoadingNotice,
  SkeletonBars,
  SkeletonCard,
  SkeletonRows,
  SkeletonTiles,
  type SkeletonCell,
} from '@/screens/xtool-lead-manager/components/skeleton'

// 단계·고객 수·전환율(막대) 칸 — RateTable 모양.
const RATE_CELLS: SkeletonCell[] = [
  { width: 90 },
  { width: 50 },
  { width: 120 },
  { width: 120 },
]

const RateTableSkeleton = ({ rows }: { rows: number }) => (
  <table className="stats_table">
    <tbody>
      <SkeletonRows cells={RATE_CELLS} rows={rows} />
    </tbody>
  </table>
)

/** 퍼널 통계 탭이 데이터를 받는 동안 — 퍼널 막대, 경로별 전환 타일, 소요
 * 일수, 콜백·유입 경로 표를 실제 배치 그대로 회색으로 그린다. */
export const StatsSkeleton = () => (
  <>
    <LoadingNotice label="퍼널 통계를 불러오는 중" />
    <SkeletonCard titleWidth={60}>
      <SkeletonBars count={5} />
    </SkeletonCard>
    <div className="stats_row">
      <SkeletonCard titleWidth={180}>
        <SkeletonTiles count={2} />
        <SkeletonTiles count={2} />
      </SkeletonCard>
      <SkeletonCard titleWidth={160}>
        <SkeletonTiles count={2} />
        <SkeletonBars count={4} />
      </SkeletonCard>
    </div>
    <SkeletonCard titleWidth={120}>
      <RateTableSkeleton rows={5} />
    </SkeletonCard>
    <SkeletonCard titleWidth={110}>
      <RateTableSkeleton rows={5} />
    </SkeletonCard>
  </>
)

import type { ReactNode } from 'react'
import {
  Bone,
  LoadingNotice,
  SkeletonCard,
  SkeletonRows,
  SkeletonTiles,
  type SkeletonCell,
} from '@/screens/xtool-lead-manager/components/skeleton'

const cells = (widths: number[]): SkeletonCell[] =>
  widths.map((width) => ({ width }))

const TableSkeleton = ({
  widths,
  rows,
}: {
  widths: number[]
  rows: number
}) => (
  <div className="trend_table_scroll">
    <table className="stats_table">
      <tbody>
        <SkeletonRows cells={cells(widths)} rows={rows} />
      </tbody>
    </table>
  </div>
)

/** 숫자 타일 + 막대 그래프 자리 — 인입·판매 통계의 첫 카드 모양. */
const ChartCard = () => (
  <SkeletonCard titleWidth={120}>
    <SkeletonTiles count={4} />
    <Bone width="100%" height={220} />
  </SkeletonCard>
)

/**
 * 통계 탭이 데이터를 받는 동안 — 지금 보고 있는 소주제의 배치를 회색으로
 * 그린다. 인입: 타일+그래프+기간 표(옆에 실시간)·파이프라인 표 / 판매: 타일+그래프·기간
 * 표 / 개인 KPI: 담당자 칩·KPI 표.
 */
export const TrendSkeleton = ({
  section,
  inflowAside,
}: {
  section: 'inflow' | 'sales' | 'kpi'
  /** 인입통계 맨 위 줄 오른쪽(실시간 웹 문의) — 로딩 중에도 실제 내용을 둔다. */
  inflowAside?: ReactNode
}) => (
  <>
    <LoadingNotice label="통계를 불러오는 중" />
    {section === 'kpi' ? (
      <>
        <div className="xtool_skeleton_tiles" style={{ display: 'flex' }}>
          {[56, 64, 48, 72, 60, 52].map((width, index) => (
            <Bone key={index} width={width} height={30} />
          ))}
        </div>
        <SkeletonCard titleWidth={100}>
          <TableSkeleton widths={[70, 40, 40, 40, 50, 50, 50, 60]} rows={8} />
        </SkeletonCard>
      </>
    ) : (
      <>
        {section === 'inflow' ? (
          <>
            <div className="inflow_top_row">
              {/* 왼쪽 카드: 타일+그래프 아래에 기간 표까지 */}
              <SkeletonCard titleWidth={120}>
                <SkeletonTiles count={4} />
                <Bone width="100%" height={220} />
                <TableSkeleton widths={[80, 40, 40, 40, 40, 40]} rows={8} />
              </SkeletonCard>
              {inflowAside}
            </div>
            <SkeletonCard titleWidth={140}>
              <TableSkeleton widths={[90, 40, 40, 40, 40, 40, 40]} rows={6} />
            </SkeletonCard>
          </>
        ) : (
          <>
            <ChartCard />
            <SkeletonCard titleWidth={90}>
              <TableSkeleton widths={[80, 40, 40, 40, 40, 40]} rows={8} />
            </SkeletonCard>
          </>
        )}
      </>
    )}
  </>
)

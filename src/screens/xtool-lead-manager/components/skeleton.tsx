import '@/screens/xtool-lead-manager/styles/skeleton.scss'
import type { CSSProperties } from 'react'

/** 회색 막대 하나 — 글자·숫자가 들어갈 자리. */
export const Bone = ({
  width = '100%',
  height = 12,
}: {
  width?: CSSProperties['width']
  height?: CSSProperties['height']
}) => <span className="xtool_bone" style={{ width, height }} aria-hidden />

/** 표 칸 하나의 모양 — 막대 폭, 그리고 두 줄(위: 값, 아래: 작은 날짜)인지. */
export type SkeletonCell = { width: CSSProperties['width']; twoLine?: boolean }

/**
 * 표 몸통 자리의 스켈레톤 줄 — 실제 표의 thead는 그대로 두고 tbody만 이걸로
 * 채운다(칸 폭이 실제 표와 같게 잡혀 데이터가 들어와도 덜컥거리지 않는다).
 * 줄마다 막대 폭을 조금씩 바꿔 실제 글자처럼 보이게 한다.
 */
export const SkeletonRows = ({
  cells,
  rows = 10,
}: {
  cells: SkeletonCell[]
  rows?: number
}) => (
  <>
    {Array.from({ length: rows }, (_, row) => (
      <tr key={row} aria-hidden>
        {cells.map((cell, index) => {
          // 같은 칸이라도 줄마다 폭을 70~100%로 흔든다.
          const scale = 0.7 + ((row * 7 + index * 3) % 4) * 0.1
          const width =
            typeof cell.width === 'number'
              ? Math.round(cell.width * scale)
              : cell.width
          return (
            <td key={index}>
              {cell.twoLine ? (
                <span className="xtool_skeleton_stack">
                  <Bone width={width} />
                  <Bone width="60%" height={9} />
                </span>
              ) : (
                <Bone width={width} />
              )}
            </td>
          )
        })}
      </tr>
    ))}
  </>
)

/** 통계 카드(stats_card) 모양의 스켈레톤 — 제목·설명 줄 아래에 내용을 넣는다. */
export const SkeletonCard = ({
  children,
  titleWidth = 140,
}: {
  children?: React.ReactNode
  titleWidth?: number
}) => (
  <section className="stats_card" aria-hidden>
    <div className="xtool_skeleton_card">
      <Bone width={titleWidth} height={15} />
      <Bone width="55%" height={10} />
      {children}
    </div>
  </section>
)

/** 숫자 타일 여러 개(stats_tile 모양). */
export const SkeletonTiles = ({ count = 4 }: { count?: number }) => (
  <div
    className="xtool_skeleton_tiles"
    style={{ '--tiles': count } as CSSProperties}
  >
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="xtool_skeleton_tile">
        <Bone width="50%" height={10} />
        <Bone width="70%" height={20} />
      </div>
    ))}
  </div>
)

/** 가로 막대 줄 여러 개(퍼널·분포 막대 모양). */
export const SkeletonBars = ({ count = 5 }: { count?: number }) => (
  <div className="xtool_skeleton_bars">
    {Array.from({ length: count }, (_, index) => (
      <Bone key={index} width={`${92 - index * 14}%`} height={18} />
    ))}
  </div>
)

/** 스크린리더용 "불러오는 중" 안내 — 스켈레톤 자체는 aria-hidden이다. */
export const LoadingNotice = ({
  label = '불러오는 중',
}: {
  label?: string
}) => (
  <span className="xtool_sr_only" role="status">
    {label}
  </span>
)

// 탭별 로딩 스켈레톤 — 재조회 중에 그 탭의 실제 배치(카드·표·그래프 자리)를
// 회색 막대로 미리 그려, 데이터가 들어와도 화면이 덜컥거리지 않게 한다. 섹션
// 제목처럼 데이터와 무관한 글자는 그대로 보여 준다. 막대 모양은 전체 요약
// 탭의 스켈레톤(channel-insight__skeleton-bar)과 같다.
import type { CSSProperties, ReactNode } from 'react'

const Bar = ({
  width,
  height,
}: {
  width?: CSSProperties['width']
  height?: number
}) => (
  <span
    className="channel-insight__skeleton-bar channel-insight__skeleton-bar--cell"
    style={{ width, height }}
  />
)

/** 표 자리 — 머리 줄과 몸통 줄 모두 막대. 첫 칸은 이름이라 넓게, 나머지는
 * 숫자라 짧게 그리고, 줄마다 폭을 조금씩 흔든다. */
const TableBones = ({
  columns,
  rows,
  firstWidth = 160,
}: {
  columns: number
  rows: number
  firstWidth?: number
}) => (
  <div className="channel-insight__table-wrap">
    <table className="channel-insight__table channel-insight__table--roas tab-skeleton__table">
      <thead>
        <tr>
          {Array.from({ length: columns }, (_, i) => (
            <th key={i}>
              <Bar width={i === 0 ? 70 : 40} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, row) => (
          <tr key={row}>
            {Array.from({ length: columns }, (_, i) => {
              const scale = 0.7 + ((row * 7 + i * 3) % 4) * 0.1
              return (
                <td key={i}>
                  <Bar
                    width={Math.round((i === 0 ? firstWidth : 48) * scale)}
                  />
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

/** 숫자 카드 줄(KPI) 자리. */
const KpiBones = ({ count }: { count: number }) => (
  <div className="channel-insight__summary-grid">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="channel-insight__kpi">
        <span className="channel-insight__skeleton-bar channel-insight__skeleton-bar--label" />
        <span className="channel-insight__skeleton-bar channel-insight__skeleton-bar--value" />
      </div>
    ))}
  </div>
)

/** 칩·토글 버튼 줄 자리. */
const ChipBones = ({ widths }: { widths: number[] }) => (
  <div className="tab-skeleton__chips">
    {widths.map((width, i) => (
      <Bar key={i} width={width} height={26} />
    ))}
  </div>
)

/** 그래프 자리. */
const ChartBones = ({ height = 220 }: { height?: number }) => (
  <Bar width="100%" height={height} />
)

const Section = ({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) => (
  <section className="channel-insight__section">
    <h3 className="channel-insight__section-title">{title}</h3>
    {children}
  </section>
)

/** 스크린리더용 안내 — 막대들은 aria-hidden이다. */
const Notice = ({ label }: { label: string }) => (
  <span className="tab-skeleton__sr-only" role="status">
    {label}
  </span>
)

/** 캠페인·광고셋 탭 — 요약(지표 네 묶음 × 카드 두 장), 목록 표, 비교 표. */
export function CampaignAdsetSkeleton({ dayCount }: { dayCount: number }) {
  return (
    <>
      <Notice label="캠페인·광고셋 데이터를 불러오는 중" />
      <div className="tab-skeleton" aria-hidden>
        <Section title="요약">
          <div className="campaign-highlights__groups">
            {Array.from({ length: 4 }, (_, group) => (
              <div key={group} className="campaign-highlights__group">
                <div className="campaign-highlights__group-head">
                  <Bar width={70} height={12} />
                  <Bar width={160} />
                </div>
                <div className="campaign-highlights__cards">
                  {Array.from({ length: 2 }, (_, card) => (
                    <div key={card} className="campaign-highlights__card">
                      <div className="tab-skeleton__lines">
                        {Array.from({ length: 5 }, (_, line) => (
                          <div key={line} className="tab-skeleton__line">
                            <Bar width={`${55 + ((line * 13) % 30)}%`} />
                            <Bar width={56} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
        <Section title="캠페인 · 광고셋">
          <ChipBones widths={[44, 52, 60, 54]} />
          <ChipBones widths={[52, 80, 44, 44, 52, 44, 44, 86, 50, 76]} />
          <TableBones columns={12} rows={12} firstWidth={240} />
        </Section>
        <Section title="선택한 캠페인·광고셋 비교">
          <TableBones columns={3} rows={Math.min(dayCount + 2, 16)} />
        </Section>
      </div>
    </>
  )
}

/** 매체별 테스트 탭 — 비교 대상·구간 선택과 구간별 성과 표. */
export function PeriodTestSkeleton() {
  return (
    <>
      <Notice label="매체별 테스트 데이터를 불러오는 중" />
      <div className="tab-skeleton" aria-hidden>
        <Section title="비교 대상">
          <ChipBones widths={[64, 64, 64]} />
          <ChipBones widths={[180]} />
        </Section>
        <Section title="구간">
          <ChipBones widths={[220, 220]} />
        </Section>
        <Section title="구간별 성과">
          <TableBones columns={11} rows={4} firstWidth={120} />
        </Section>
      </div>
    </>
  )
}

/** ROAS 탭 — 요약 카드, 광고 기여(범위 카드 + 채널 표), 보기 단위, 기간별
 * 추이(그래프 + 표). */
export function RoasSkeleton({ dayCount }: { dayCount: number }) {
  return (
    <>
      <Notice label="ROAS 데이터를 불러오는 중" />
      <div className="tab-skeleton" aria-hidden>
        <section className="channel-insight__summary">
          <KpiBones count={6} />
        </section>
        <Section title="ROAS 범위 (광고 기여)">
          <KpiBones count={3} />
          <TableBones columns={6} rows={5} firstWidth={80} />
        </Section>
        <Section title="전체 보기 단위">
          <ChipBones widths={[52, 52, 52]} />
        </Section>
        <Section title="기간별 추이">
          <ChartBones />
          <TableBones columns={8} rows={Math.min(dayCount, 14)} />
        </Section>
      </div>
    </>
  )
}

/** 광고 성과 탭 — 요약 카드와 캠페인 → 광고셋 → 광고 표. */
export function AdPerformanceSkeleton() {
  return (
    <>
      <Notice label="광고 성과 데이터를 불러오는 중" />
      <div className="tab-skeleton" aria-hidden>
        <Section title="Meta 광고 성과">
          <KpiBones count={5} />
          <TableBones columns={8} rows={10} firstWidth={260} />
        </Section>
        <Section title="광고를 찾지 못한 utm_campaign">
          <Bar width="70%" />
        </Section>
      </div>
    </>
  )
}

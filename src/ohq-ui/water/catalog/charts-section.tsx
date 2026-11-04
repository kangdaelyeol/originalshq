import { useState, type ReactNode } from 'react'
import { WATER_CATEGORICAL, WATER_SERIES_COMPARE, WATER_SERIES_PRIMARY, waterShareItems } from '../charts/palette'
import { WaterAreaChart } from '../charts/water-area-chart'
import { WaterBar } from '../charts/water-bar'
import { WaterBarList } from '../charts/water-bar-list'
import { WaterLatencyBars } from '../charts/water-latency-bars'
import { WaterShareBar } from '../charts/water-share-bar'
import { WaterCard } from '../surfaces/water-card'
import { WaterSkeleton } from '../surfaces/water-skeleton'
import { WaterSection, WaterSpec } from './spec'

/** 견본 단추 — 값 바꾸기(카탈로그 안에서만) */
function DemoButton({ onClick, demo, children }: { onClick: () => void; demo: string; children: ReactNode }) {
  return (
    <button type="button" className="water-surf-demo" data-demo={demo} onClick={onClick}>
      {children}
    </button>
  )
}

const LABELS = ['10/27', '10/28', '10/29', '10/30', '10/31', '11/1', '11/2']
const NOW = [
  [4, 6, 5, 8, 7, 9, 11],
  [6, 5, 9, 7, 10, 8, 6],
]
const PREV = [
  [3, 4, 6, 5, 6, 7, 6],
  [5, 6, 4, 6, 5, 7, 8],
]

// 다섯 계열 — 6색 순서대로(계열 넷 이상이면 선 끝 이름표)
const DEVICE_SERIES = [
  { key: 'f2', label: 'F2', values: [6, 8, 7, 9, 11, 10, 12] },
  { key: 'p2s', label: 'P2S', values: [5, 6, 7, 6, 8, 9, 9] },
  { key: 'm1', label: 'M1 Ultra', values: [3, 4, 4, 5, 4, 6, 7] },
  { key: 'dtf', label: 'DTF', values: [2, 3, 2, 4, 3, 3, 4] },
  { key: 's1', label: 'S1', values: [1, 1, 2, 2, 3, 2, 3] },
].map((s, i) => ({ ...s, color: WATER_CATEGORICAL[i] }))

// 30일 — 한 계열(칸이 많아 점은 마지막과 고른 칸만)
const DAYS = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 6 + i))
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
})
const DAILY = DAYS.map((_, i) => Math.round(18 + 9 * Math.sin(i / 3.2) + 6 * Math.sin(i / 1.3) + (i % 7 === 0 ? 8 : 0)))

const REGIONS = [
  [
    { key: 'a', label: '수도권', value: 9 },
    { key: 'b', label: '경상권', value: 6 },
    { key: 'c', label: '호남권', value: 3 },
  ],
  [
    { key: 'a', label: '수도권', value: 5 },
    { key: 'b', label: '경상권', value: 11 },
    { key: 'c', label: '호남권', value: 7 },
  ],
]

const DEVICES = [
  { key: 'f2', label: 'F2', value: 31 },
  { key: 'p2s', label: 'P2S', value: 24 },
  { key: 'm1', label: 'M1 Ultra', value: 17 },
  { key: 'dtf', label: 'DTF 프린터', value: 12 },
  { key: 's1', label: 'S1', value: 8 },
  { key: 'd1', label: 'D1 Pro', value: 5 },
  { key: 'f1', label: 'F1', value: 3 },
  { key: 'etc', label: '레이저 모듈', value: 2 },
]

// 범주가 여덟 — 넘겨준 순서대로 6색, 일곱째부터 "기타"(waterShareItems)
const CAUSES_MANY = waterShareItems([
  { key: 'power', label: '전원 불량', value: 21 },
  { key: 'usage', label: '사용 방법', value: 17 },
  { key: 'setting', label: '설정 값', value: 13 },
  { key: 'laser', label: '레이저 출력', value: 11 },
  { key: 'fan', label: '팬·소음', value: 8 },
  { key: 'soft', label: '프로그램', value: 6 },
  { key: 'ship', label: '배송 파손', value: 3 },
  { key: 'etc', label: '그 밖', value: 2 },
])

const CAUSES = [
  [
    { key: 'a', label: '기기 오작동', value: 18, color: WATER_CATEGORICAL[0] },
    { key: 'b', label: '사용 방법', value: 12, color: WATER_CATEGORICAL[1] },
    { key: 'c', label: '설정 값', value: 6, color: WATER_CATEGORICAL[2] },
  ],
  [
    { key: 'a', label: '기기 오작동', value: 9, color: WATER_CATEGORICAL[0] },
    { key: 'b', label: '사용 방법', value: 16, color: WATER_CATEGORICAL[1] },
    { key: 'c', label: '설정 값', value: 11, color: WATER_CATEGORICAL[2] },
  ],
]

const LATENCY = [
  [
    { key: 'a', label: '출장', value: 3.2 },
    { key: 'b', label: 'AS', value: 6.4 },
    { key: 'c', label: '아톡', value: 1.1 },
  ],
  [
    { key: 'a', label: '출장', value: 5.6 },
    { key: 'b', label: 'AS', value: 4.1 },
    { key: 'c', label: '아톡', value: 2.3 },
  ],
]

/** 기본 부품 — 차트 */
export function ChartsSection() {
  // 견본마다 따로 — 값 바꾸기(step)·다시 나타나기(mount: key를 바꿔 새로 붙여 처음 나타날 때 움직임을 다시 본다)
  const [steps, setSteps] = useState<Record<string, number>>({})
  const [mounts, setMounts] = useState<Record<string, number>>({})
  const k = (id: string) => (steps[id] ?? 0) % 2
  const mount = (id: string) => mounts[id] ?? 0
  const buttons = (id: string) => (
    <span className="water-surf-demo-buttons">
      <DemoButton demo="next" onClick={() => setSteps((s) => ({ ...s, [id]: (s[id] ?? 0) + 1 }))}>
        값 바꾸기
      </DemoButton>
      <DemoButton demo="again" onClick={() => setMounts((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }))}>
        다시 나타나기
      </DemoButton>
    </span>
  )

  return (
    <WaterSection
      title="차트"
      note="막대 = 홈 안의 알약 채움 · extend 스프링(16% 넘침)으로 위에서부터 21ms 간격 · 값이 바뀌어도 같은 움직임"
    >
      <WaterSpec name="<WaterBarList>" note="항목별 개수 — 한 계열이라 어두운 알약 하나" spec="bar-list">
        <WaterCard title="지역별 출장" subtitle="이번 달" className="water-surf-demo-fill">
          <WaterBarList key={mount('bars')} items={REGIONS[k('bars')]} ariaLabel="지역별 출장 건수" />
        </WaterCard>
        {buttons('bars')}
      </WaterSpec>

      <WaterSpec name="<WaterBarList limit>" note="많은 값 — 여섯째부터 기타(무채 회색) · 빈 목록" spec="bar-list-many">
        <WaterCard title="기기별 AS" subtitle="최근 90일" className="water-surf-demo-fill">
          <WaterBarList items={DEVICES} ariaLabel="기기별 AS 건수" />
        </WaterCard>
        <WaterCard title="기기별 반품" className="water-surf-demo-fill">
          <WaterBarList items={[]} ariaLabel="기기별 반품 건수" empty="이 기간에 반품이 없어요." />
        </WaterCard>
      </WaterSpec>

      <WaterSpec name="<WaterShareBar>" note="비중 막대 + 범례 — 조각·범례에 올리면 작은 유리 판" spec="share">
        <WaterCard title="문의 원인" subtitle="아톡 · 이번 주" className="water-surf-demo-fill">
          <WaterShareBar key={mount('share')} items={CAUSES[k('share')]} ariaLabel="문의 원인 비중" />
        </WaterCard>
        {buttons('share')}
      </WaterSpec>
      <WaterSpec
        name="<WaterShareBar> 많은 범주"
        note="waterShareItems — 6색(이웃 쌍 검사 통과)까지, 일곱째부터 기타(무채 회색) · 빗금은 대비 높이기·인쇄일 때만"
        spec="share-many"
      >
        <WaterCard title="문의 원인" subtitle="여덟 갈래 · 이번 달" className="water-surf-demo-fill">
          <WaterShareBar items={CAUSES_MANY} ariaLabel="문의 원인 비중(여덟 갈래)" />
        </WaterCard>
      </WaterSpec>

      <WaterSpec name="<WaterLatencyBars>" note="목표선이 있는 막대 — 넘으면 주의 색 + 목표 초과" spec="latency">
        <WaterCard title="평균 처리 기간" subtitle="목표 5일" className="water-surf-demo-fill">
          <WaterLatencyBars key={mount('latency')} rows={LATENCY[k('latency')]} target={5} scale={8} unit="일" />
        </WaterCard>
        {buttons('latency')}
      </WaterSpec>

      <WaterSpec
        name="<WaterAreaChart>"
        note="처음엔 물 높이가 차오르고, 값이 바뀌면 왼쪽부터 출렁이며 새 높이로 · ←/→로 고르기"
        wide
        spec="area"
      >
        <div className="water-surf-demo-pair">
          <WaterCard title="일별 접수" subtitle="이번 주 · 지난주" className="water-surf-demo-fill">
            <WaterAreaChart
              key={mount('area')}
              labels={LABELS}
              series={[
                { key: 'now', label: '이번 주', color: WATER_SERIES_PRIMARY, values: NOW[k('area')] },
                { key: 'prev', label: '지난주', color: WATER_SERIES_COMPARE, values: PREV[k('area')] },
              ]}
              height={200}
              integer
              ariaLabel="일별 접수 추이"
            />
          </WaterCard>
          <WaterCard
            title="30일 처리"
            subtitle="한 계열 · 칸이 많으면 점은 마지막과 고른 칸만"
            className="water-surf-demo-fill"
          >
            <WaterAreaChart
              key={mount('area')}
              labels={DAYS}
              series={[
                {
                  key: 'done',
                  label: '처리',
                  color: WATER_SERIES_PRIMARY,
                  values: k('area') ? [...DAILY].reverse() : DAILY,
                },
              ]}
              height={200}
              integer
              ariaLabel="30일 처리 추이"
            />
          </WaterCard>
        </div>
        {buttons('area')}
      </WaterSpec>

      <WaterSpec
        name="<WaterAreaChart> 계열 다섯"
        note="6색 순서대로 · 넷부터 선 끝 이름표(가까우면 끌어 잇는 선) · 범례·표 그대로"
        wide
        spec="area-many"
      >
        <WaterCard title="기기별 접수" subtitle="이번 주 · 다섯 기기" className="water-surf-demo-fill">
          <WaterAreaChart
            labels={LABELS}
            series={DEVICE_SERIES}
            height={220}
            integer
            ariaLabel="기기별 일별 접수 추이"
          />
        </WaterCard>
      </WaterSpec>

      <WaterSpec name="<WaterBar>" note="막대 하나 — md 12px · sm 10px · 색 채움" spec="bar">
        <div key={mount('bar')} className="water-surf-demo-bars">
          <WaterBar value={k('bar') ? 0.35 : 0.72} index={0} />
          <WaterBar value={k('bar') ? 0.8 : 0.48} index={1} size="sm" />
          <WaterBar value={k('bar') ? 0.6 : 0.3} index={2} color={WATER_CATEGORICAL[0]} />
          <WaterBar value={1} index={3} size="sm" />
        </div>
        {buttons('bar')}
      </WaterSpec>

      <WaterSpec name="<WaterSkeleton variant=bars>" note="차트를 불러오는 중" spec="chart-loading">
        <WaterSkeleton variant="bars" rows={4} title="기기별 AS" className="water-surf-demo-fill" />
      </WaterSpec>
    </WaterSection>
  )
}

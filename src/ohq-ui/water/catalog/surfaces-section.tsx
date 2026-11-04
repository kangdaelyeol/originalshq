import { CircleCheck, Inbox, PackageOpen, Wrench } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { StatCardData } from '../../types'
import { WaterCard } from '../surfaces/water-card'
import { WaterEmpty } from '../surfaces/water-empty'
import { WaterFlag } from '../surfaces/water-flag'
import { WaterNumber } from '../surfaces/water-number'
import { WaterSkeleton } from '../surfaces/water-skeleton'
import { WaterStatCard } from '../surfaces/water-stat-card'
import { WaterSection, WaterSpec } from './spec'

/** 견본 단추 — 값 바꾸기 등(카탈로그 안에서만, D7 효과 칩 모양) */
function DemoButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="water-surf-demo" onClick={onClick}>
      {children}
    </button>
  )
}

interface StatSample extends Omit<StatCardData, 'key' | 'value'> {
  key: string
  /** 값 바꾸기를 누를 때마다 다음 값 */
  values: string[]
}

const STATS: StatSample[] = [
  {
    key: 'new',
    title: '새 접수',
    values: ['12건', '15건', '9건', '128건'],
    icon: Inbox,
    tint: 'blue',
    caption: '최근 3일',
  },
  {
    key: 'repair',
    title: '수리 중',
    values: ['3건', '4건', '2건', '12건'],
    icon: Wrench,
    tint: 'amber',
    caption: '어제보다 1건 늘었어요',
  },
  {
    key: 'stock',
    title: '재고',
    values: ['9대', '8대', '19대', '1,284대'],
    icon: PackageOpen,
    tint: 'green',
    tag: { label: '넉넉함', tone: 'good' },
  },
  {
    key: 'days',
    title: '평균 처리 기간',
    values: ['1.4일', '1.2일', '2.0일', '0.9일'],
    icon: CircleCheck,
    tint: 'violet',
    delta: { value: '12%', direction: 'down', good: true },
  },
]

const NUMBERS = [128, 129, 138, 125, 1284, 7, 99, 100]

/** 기본 부품 — 카드·숫자·빈 상태·불러오는 중 */
export function SurfacesSection() {
  const [step, setStep] = useState(0)
  const [n, setN] = useState(0)

  return (
    <WaterSection title="카드 · 숫자" note="유리 판은 CSS 그림자(w-glass)로 한 번 칠하고, 움직이는 것은 transform만">
      <WaterSpec
        name="<WaterCard>"
        note="lift low(기본, 카드 사이 20px 틈 안에서 그림자가 사라짐) · raised · flat"
        wide
        spec="card"
      >
        <div className="water-surf-demo-grid">
          <WaterCard
            title="이번 주 접수"
            subtitle="lift low — 기본"
            actions={<WaterFlag tone="info">자동 갱신</WaterFlag>}
          >
            <p className="water-surf-demo-text">
              유리 몸은 바탕보다 2.6% 어둡고, 왼쪽 위 어두운 테두리·오른쪽 아래 흰 테두리·위쪽 안쪽 그림자로 선다.
            </p>
          </WaterCard>
          <WaterCard title="홀로 선 판" subtitle="lift raised" lift="raised" titleSize="lg">
            <p className="water-surf-demo-text">둘레가 넓게 빈 자리 — 그림자가 더 멀리 떨어진다.</p>
          </WaterCard>
          <WaterCard title="판 안의 판" subtitle="lift flat" lift="flat">
            <p className="water-surf-demo-text">그림자 없이 테두리만.</p>
          </WaterCard>
        </div>
      </WaterSpec>

      <WaterSpec
        name="<WaterStatCard>"
        note="값이 바뀌면 바뀐 숫자 칸만 굴러간다(표시 알약 스프링 · 왼쪽부터 21ms)"
        wide
        spec="stat"
      >
        <div className="water-surf-demo-kpi">
          {STATS.map(({ key, values, ...rest }) => (
            <WaterStatCard key={key} {...rest} value={values[step % values.length]} />
          ))}
        </div>
        <DemoButton onClick={() => setStep((s) => s + 1)}>값 바꾸기</DemoButton>
      </WaterSpec>

      <WaterSpec name="<WaterNumber>" note="숫자 굴림 — 커지면 위로, 작아지면 아래로" spec="number">
        <span className="water-surf-demo-big">
          <WaterNumber value={`${NUMBERS[n % NUMBERS.length].toLocaleString('ko-KR')}건`} />
        </span>
        <DemoButton onClick={() => setN((v) => v + 1)}>다음 값</DemoButton>
      </WaterSpec>

      <WaterSpec name="<WaterEmpty size=sm>" note="목록·차트가 비었을 때" spec="empty-sm">
        <WaterCard title="AS 접수" lift="low" className="water-surf-demo-fill">
          <WaterEmpty title="이 기간에 접수된 건이 없어요." />
        </WaterCard>
      </WaterSpec>

      <WaterSpec name="<WaterEmpty size=md>" note="판 하나를 채우는 빈 화면 — 아이콘 · 없으면 물방울" spec="empty-md">
        <WaterCard lift="low" className="water-surf-demo-fill">
          <WaterEmpty
            size="md"
            icon={Inbox}
            title="아직 받은 알림이 없어요"
            description="새 AS 신청이나 막힌 업무가 생기면 여기에 모여요."
          />
        </WaterCard>
        <WaterCard lift="low" className="water-surf-demo-fill">
          <WaterEmpty size="md" title="준비 중이에요" description="물방울만 하나 — 아이콘을 안 줬을 때." />
        </WaterCard>
      </WaterSpec>

      <WaterSpec
        name="<WaterSkeleton>"
        note="불러오는 중 — 빈 홈 + 유리 위를 지나가는 빛 한 줄(판마다 transform 하나)"
        wide
        spec="skeleton"
      >
        <div className="water-surf-demo-grid">
          <WaterSkeleton variant="list" title="다가오는 방문" />
          <WaterSkeleton variant="bars" rows={3} />
          <WaterSkeleton variant="stat" />
        </div>
      </WaterSpec>
    </WaterSection>
  )
}

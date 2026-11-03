import { CircleCheck, Inbox, PackageOpen, Plus, Save, Trash2, Wrench } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { AreaChart } from '../charts/area-chart'
import { BarList } from '../charts/bar-list'
import { LatencyBars } from '../charts/latency-bars'
import { CATEGORICAL, SERIES_COMPARE, SERIES_PRIMARY } from '../charts/palette'
import { ShareBar } from '../charts/share-bar'
import { Avatar } from '../components/avatar'
import { Button } from '../components/button'
import { ConfirmDialog } from '../components/confirm-dialog'
import { GlassCard } from '../components/glass-card'
import { RangeField } from '../components/range-field'
import { SegmentedControl } from '../components/segmented-control'
import { StatCard } from '../components/stat-card'
import { StatusPill } from '../components/status-pill'
import { TextField } from '../components/text-field'

/** 부품 하나 — 이름(코드에서 부르는 이름)과 실제 모습. 화면별 카탈로그(tech 부품 등)도 같이 쓴다. */
export function CatalogSpec({ name, note, children }: { name: string; note?: string; children: ReactNode }) {
  return (
    <div className="catalog__spec">
      <p className="catalog__name">
        <code>{name}</code>
        {note && <span>{note}</span>}
      </p>
      <div className="catalog__demo">{children}</div>
    </div>
  )
}

const LABELS = ['10/27', '10/28', '10/29', '10/30', '10/31', '11/1', '11/2']

/** 공용 부품 카탈로그 — ohq-ui의 기본 부품·차트를 실제로 띄워 본다(값은 화면 안에서만 쓰는 견본). */
export function UiCatalog() {
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a')
  const [range, setRange] = useState(22)
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <GlassCard title="색 · 상태" subtitle="강조색은 화면마다 바꿀 수 있어요(ThemeRoot accent)">
        <div className="catalog__grid">
          <CatalogSpec name="--accent" note="강조색 · 밝게 · 어둡게">
            <span className="catalog__swatch" style={{ background: 'var(--accent)' }} />
            <span className="catalog__swatch" style={{ background: 'var(--accent-hi)' }} />
            <span className="catalog__swatch" style={{ background: 'var(--accent-lo)' }} />
          </CatalogSpec>
          <CatalogSpec name="<StatusPill tone>" note="good · warn · crit · info · neutral">
            <StatusPill tone="good">정상</StatusPill>
            <StatusPill tone="warn">주의</StatusPill>
            <StatusPill tone="crit">위험</StatusPill>
            <StatusPill tone="info">안내</StatusPill>
            <StatusPill tone="neutral">기본</StatusPill>
          </CatalogSpec>
          <CatalogSpec name="<StatusPill dot>" note="점 · 깜빡이는 점">
            <StatusPill tone="good" dot>
              활성
            </StatusPill>
            <StatusPill tone="good" dot="pulse">
              실시간
            </StatusPill>
          </CatalogSpec>
          <CatalogSpec name="<Avatar>" note="xs · sm · md">
            <Avatar initials="재민" color="var(--accent)" ink="var(--accent-ink)" size="xs" />
            <Avatar initials="재민" color="var(--accent)" ink="var(--accent-ink)" />
            <Avatar initials="도윤" color="rgba(255, 255, 255, 0.14)" size="md" />
          </CatalogSpec>
        </div>
      </GlassCard>

      <GlassCard title="버튼">
        <div className="catalog__grid">
          <CatalogSpec name="<Button variant=primary>" note="md · sm · 아이콘 · 비활성">
            <Button icon={Save}>저장</Button>
            <Button size="sm" icon={Plus}>
              새로 만들기
            </Button>
            <Button disabled>비활성</Button>
          </CatalogSpec>
          <CatalogSpec name="<Button variant=ghost>">
            <Button variant="ghost">취소</Button>
            <Button variant="ghost" size="sm" icon={Trash2}>
              삭제
            </Button>
          </CatalogSpec>
          <CatalogSpec name="<ConfirmDialog>" note="지우기 등 되돌리기 어려운 일 — danger · primary">
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirming(true)}>
              확인 모달 열기
            </Button>
          </CatalogSpec>
        </div>
      </GlassCard>

      <GlassCard title="고르기 · 입력">
        <div className="catalog__grid">
          <CatalogSpec name="<SegmentedControl>" note="md(기본) · sm — 하나만 고름, 표시가 미끄러짐">
            <SegmentedControl
              ariaLabel="견본"
              options={[
                { value: 'a', label: '진행 중 7' },
                { value: 'b', label: '완료 43' },
                { value: 'c', label: '전체 50' },
              ]}
              value={seg}
              onChange={setSeg}
            />
            <SegmentedControl
              size="sm"
              ariaLabel="견본 작게"
              options={[
                { value: 'a', label: '배포' },
                { value: 'b', label: '커밋' },
                { value: 'c', label: 'PR' },
              ]}
              value={seg}
              onChange={setSeg}
            />
          </CatalogSpec>
          <CatalogSpec name="<TextField>">
            <div className="catalog__w">
              <TextField label="이메일" placeholder="name@xtool.co.kr" />
            </div>
          </CatalogSpec>
          <CatalogSpec name="<RangeField>" note="유리 효과 같은 슬라이더">
            <div className="catalog__w">
              <RangeField label="흐림" value={range} min={0} max={40} format={(v) => `${v}px`} onChange={setRange} />
            </div>
          </CatalogSpec>
        </div>
      </GlassCard>

      <div className="grid grid--kpi">
        <StatCard title="StatCard · blue" value="12건" icon={Inbox} tint="blue" caption="KPI 카드" />
        <StatCard title="amber" value="3건" icon={Wrench} tint="amber" caption="caption" />
        <StatCard title="green" value="9대" icon={PackageOpen} tint="green" tag={{ label: '태그', tone: 'good' }} />
        <StatCard
          title="violet + delta"
          value="1.4일"
          icon={CircleCheck}
          tint="violet"
          delta={{ value: '12%', direction: 'down', good: true }}
        />
      </div>

      <div className="grid grid--pair">
        <GlassCard title="<BarList>" subtitle="항목별 개수">
          <BarList
            items={[
              { key: 'a', label: '수도권', value: 9 },
              { key: 'b', label: '경상권', value: 6 },
              { key: 'c', label: '호남권', value: 3 },
            ]}
            ariaLabel="견본 막대"
          />
        </GlassCard>
        <GlassCard title="<ShareBar>" subtitle="비중 막대 + 범례">
          <ShareBar
            items={[
              { key: 'a', label: '기기 오작동', value: 18, color: CATEGORICAL[0] },
              { key: 'b', label: '사용 방법', value: 12, color: CATEGORICAL[1] },
              { key: 'c', label: '설정 값', value: 6, color: CATEGORICAL[2] },
            ]}
            ariaLabel="견본 비중"
          />
        </GlassCard>
        <GlassCard title="<AreaChart>" subtitle="추이 · 비교 계열">
          <AreaChart
            labels={LABELS}
            series={[
              { key: 'now', label: '이번 주', color: SERIES_PRIMARY, values: [4, 6, 5, 8, 7, 9, 11] },
              { key: 'prev', label: '지난주', color: SERIES_COMPARE, values: [3, 4, 6, 5, 6, 7, 6] },
            ]}
            height={200}
            integer
            ariaLabel="견본 추이"
          />
        </GlassCard>
        <GlassCard title="<LatencyBars>" subtitle="목표선이 있는 가로 막대">
          <LatencyBars
            rows={[
              { key: 'a', label: '출장', value: 3.2 },
              { key: 'b', label: 'AS', value: 6.4 },
              { key: 'c', label: '아톡', value: 1.1 },
            ]}
            target={5}
            scale={8}
            unit="일"
          />
        </GlassCard>
      </div>

      <GlassCard title="빈 화면">
        <div className="catalog__grid">
          <CatalogSpec name=".bar-list__empty" note="목록·차트가 비었을 때">
            <p className="bar-list__empty">이 기간에 접수된 건이 없어요.</p>
          </CatalogSpec>
        </div>
      </GlassCard>

      <ConfirmDialog
        open={confirming}
        title="견본을 지울까요?"
        message="실제로 지우지는 않아요 — 모양만 보는 견본이에요."
        confirmLabel="삭제"
        onCancel={() => setConfirming(false)}
        onConfirm={() => setConfirming(false)}
      />
    </>
  )
}

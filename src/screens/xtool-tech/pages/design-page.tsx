import { CircleCheck, Inbox, PackageOpen, Plus, Save, Search, Trash2, Upload, Wrench } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Assignees, StagePill } from '../components/board/cells'
import { ChipPicker, DateTimeInput, LocationInput, MultiSelect } from '../components/board/item-editor'
import { MiniList } from '../components/board/mini-list'
import { RecordDrawer } from '../components/board/record-drawer'
import { RecordTable, type RecordColumn } from '../components/board/record-table'
import { UpcomingList } from '../components/board/upcoming-list'
import { AreaChart } from '../components/charts/area-chart'
import { BarList } from '../components/charts/bar-list'
import { LatencyBars } from '../components/charts/latency-bars'
import { CATEGORICAL, SERIES_COMPARE, SERIES_PRIMARY } from '../components/charts/palette'
import { ShareBar } from '../components/charts/share-bar'
import { AttentionRow } from '../components/overview/attention-row'
import { KingCard } from '../components/overview/king-card'
import { TeamCard } from '../components/overview/team-card'
import { Avatar } from '../components/ui/avatar'
import { Button } from '../components/ui/button'
import { GlassCard } from '../components/ui/glass-card'
import { RangeField } from '../components/ui/range-field'
import { SegmentedControl } from '../components/ui/segmented-control'
import { StatCard } from '../components/ui/stat-card'
import { StatusPill } from '../components/ui/status-pill'
import { TextField } from '../components/ui/text-field'
import { useCurrentMember } from '../context/member-context'
import type { AttentionTile } from '../data/attention'
import { KINGS } from '../data/tech-kings'
import { pushToast } from '../data/tech-save-queue'
import type { LocationState } from '../data/tech-edit'
import { addDays, koreaToday, shortDate } from '../lib/dates'
import { XT_BASE } from '../paths'

/** 디자인 — 관리자만(메뉴에서도 숨긴다). 쓰는 부품을 실제로 띄워 보는 카탈로그. */
export function DesignPage() {
  const member = useCurrentMember()
  if (!member?.isAdmin) return <Navigate to={XT_BASE} replace />
  return <ComponentCatalog />
}

// ── 견본 데이터(화면 안에서만 쓰는 가짜 값) ──────────────────────────────────

const today = koreaToday()

interface SampleRecord {
  itemId: string
  name: string
  device: string
  stage: string
  status: string
  receivedAt: string
  assignees: string[]
}

const SAMPLE_RECORDS: SampleRecord[] = [
  { itemId: 's1', name: '김도현', device: 'F2', stage: '새로 인입된 건 <접수>', status: '입고 대기', receivedAt: addDays(today, -2), assignees: ['이재민'] },
  { itemId: 's2', name: '박서연', device: 'P2S', stage: '현재 진행중인 업무', status: '수리 중', receivedAt: addDays(today, -9), assignees: ['이재민', '손대환'] },
  { itemId: 's3', name: '주식회사 노바', device: 'DTF', stage: '막힘', status: '막힘', receivedAt: addDays(today, -21), assignees: ['지상헌'] },
  { itemId: 's4', name: '정유진', device: 'M1 Ultra', stage: '완료', status: '발송 완료', receivedAt: addDays(today, -30), assignees: ['원도윤'] },
]

const COLUMNS: RecordColumn<SampleRecord>[] = [
  {
    key: 'name',
    header: '고객',
    sortValue: (r) => r.name,
    cell: (r) => (
      <span className="cell-person">
        <strong>{r.name}</strong>
        <small>010-1234-5678</small>
      </span>
    ),
  },
  { key: 'device', header: '기기', sortValue: (r) => r.device, cell: (r) => r.device },
  { key: 'received', header: '접수일', sortValue: (r) => r.receivedAt, cell: (r) => shortDate(r.receivedAt), className: 'table__muted' },
  { key: 'assignee', header: '담당자', sortValue: (r) => r.assignees[0], cell: (r) => <Assignees names={r.assignees} /> },
  { key: 'stage', header: '단계', sortValue: (r) => r.stage, cell: (r) => <StagePill stage={r.stage} status={r.status} /> },
]

const ATTENTION: AttentionTile[] = [
  { id: 'overdueVisit', label: '지난 출장 일정', caption: '방문일이 지났는데 안 끝남', slug: 'field-service', count: 1, examples: ['조우진'], tone: 'crit' },
  { id: 'waitingInquiry', label: '응대 대기 아톡', caption: '신규 접수·1차 안내', slug: 'inquiry', count: 2, examples: [], tone: 'warn' },
  { id: 'newRequest', label: '새 AS 신청', caption: '최근 3일 접수', slug: 'as-requests', count: 3, examples: [], tone: 'info' },
  { id: 'blockedTask', label: '막힌 업무', caption: '기타업무 "막힘"', slug: 'tasks', count: 0, examples: [], tone: 'warn' },
]

const LABELS = ['10/27', '10/28', '10/29', '10/30', '10/31', '11/1', '11/2']

// ── 카탈로그 ────────────────────────────────────────────────────────────────

/** 부품 하나 — 이름(코드에서 부르는 이름)과 실제 모습 */
function Spec({ name, note, children }: { name: string; note?: string; children: ReactNode }) {
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

function ComponentCatalog() {
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a')
  const [chips, setChips] = useState<string[]>(['F2'])
  const [multi, setMulti] = useState<string[]>(['방문 설치'])
  const [date, setDate] = useState({ date: today, time: '14:00' })
  const [range, setRange] = useState(22)
  const [location, setLocation] = useState<LocationState>({ address: '', detail: '', lat: '', lng: '' })
  const [drawer, setDrawer] = useState<SampleRecord | null>(null)

  return (
    <>
      <GlassCard title="색 · 상태" subtitle="강조색은 설정 화면에서 바꿀 수 있어요">
        <div className="catalog__grid">
          <Spec name="--accent" note="강조색">
            <span className="catalog__swatch" style={{ background: 'var(--accent)' }} />
            <span className="catalog__swatch" style={{ background: 'var(--accent-hi)' }} />
            <span className="catalog__swatch" style={{ background: 'var(--accent-lo)' }} />
          </Spec>
          <Spec name="<StatusPill tone>" note="good · warn · crit · info · neutral">
            <StatusPill tone="good">정상</StatusPill>
            <StatusPill tone="warn">주의</StatusPill>
            <StatusPill tone="crit">위험</StatusPill>
            <StatusPill tone="info">안내</StatusPill>
            <StatusPill tone="neutral">기본</StatusPill>
          </Spec>
          <Spec name="<StatusPill dot>" note="점 · 깜빡이는 점">
            <StatusPill tone="good" dot>
              활성
            </StatusPill>
            <StatusPill tone="good" dot="pulse">
              실시간
            </StatusPill>
          </Spec>
          <Spec name="<StagePill>" note="Monday 그룹 이름으로 색이 정해짐">
            <StagePill stage="새로 인입된 건 <접수>" status={null} />
            <StagePill stage="현재 진행중인 업무" status={null} />
            <StagePill stage="막힘" status={null} />
            <StagePill stage="완료" status={null} />
          </Spec>
          <Spec name="<Avatar>" note="sm · md">
            <Avatar initials="재민" color="var(--accent)" ink="var(--accent-ink)" />
            <Avatar initials="도윤" color="rgba(255, 255, 255, 0.14)" size="md" />
          </Spec>
          <Spec name="<Assignees>" note="첫 사람 + 나머지 수">
            <Assignees names={['이재민', '손대환', '지상헌']} />
          </Spec>
        </div>
      </GlassCard>

      <GlassCard title="버튼">
        <div className="catalog__grid">
          <Spec name="<Button variant=primary>" note="md · sm · 아이콘 · 비활성">
            <Button icon={Save}>저장</Button>
            <Button size="sm" icon={Plus}>
              새로 만들기
            </Button>
            <Button disabled>비활성</Button>
          </Spec>
          <Spec name="<Button variant=ghost>">
            <Button variant="ghost">취소</Button>
            <Button variant="ghost" size="sm" icon={Trash2}>
              삭제
            </Button>
          </Spec>
          <Spec name=".text-link" note="글자 링크">
            <button type="button" className="text-link">
              비밀번호를 잊으셨나요?
            </button>
            <button type="button" className="text-link text-link--accent">
              회원가입
            </button>
          </Spec>
          <Spec name=".subitems__add" note="줄 더하기 · 파일 올리기">
            <button type="button" className="subitems__add">
              <Plus size={14} aria-hidden />
              품목 추가
            </button>
            <button type="button" className="subitems__add">
              <Upload size={14} aria-hidden />
              파일 올리기
            </button>
          </Spec>
          <Spec name=".icon-button">
            <button type="button" className="icon-button" aria-label="검색">
              <Search size={16} aria-hidden />
            </button>
          </Spec>
        </div>
      </GlassCard>

      <GlassCard title="토글 · 고르기">
        <div className="catalog__grid">
          <Spec name="<SegmentedControl>" note="md(기본) · sm — 하나만 고름, 표시가 미끄러짐">
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
          </Spec>
          <Spec name="<ChipPicker>" note="여러 개 켜고 끄기(담당자·기기)">
            <ChipPicker
              id="catalog-chips"
              options={['F2', 'P2S', 'DTF', 'M1 Ultra', 'S1'].map((v) => ({ value: v, label: v }))}
              selected={chips}
              onChange={setChips}
            />
          </Spec>
          <Spec name="<MultiSelect>" note="여러 개 고르는 드롭다운(출장 종류·지역)">
            <div className="catalog__w">
              <MultiSelect id="catalog-multi" options={['방문 설치', '재방문', '기타']} selected={multi} onChange={setMulti} />
            </div>
          </Spec>
          <Spec name=".check" note="체크 상자">
            <label className="check">
              <input type="checkbox" defaultChecked />
              확인함
            </label>
            <label className="check">
              <input type="checkbox" />
              확인 안 함
            </label>
          </Spec>
        </div>
      </GlassCard>

      <GlassCard title="입력">
        <div className="catalog__grid">
          <Spec name="<TextField>">
            <div className="catalog__w">
              <TextField label="이메일" placeholder="name@xtool.co.kr" />
            </div>
          </Spec>
          <Spec name="select.field__input" note="편집 패널 안에서">
            <div className="catalog__w editor">
              <select className="field__input" defaultValue="수리 중">
                <option>입고 대기</option>
                <option>수리 중</option>
                <option>발송 완료</option>
              </select>
            </div>
          </Spec>
          <Spec name="<DateTimeInput>" note="날짜·시각 한 칸 + 시각 없음">
            <div className="catalog__w">
              <DateTimeInput id="catalog-date" title="방문 일정" value={date} onChange={setDate} />
            </div>
          </Spec>
          <Spec name="<RangeField>" note="설정의 유리 효과">
            <div className="catalog__w">
              <RangeField label="흐림" value={range} min={0} max={40} format={(v) => `${v}px`} onChange={setRange} />
            </div>
          </Spec>
          <Spec name="<LocationInput>" note="카카오 주소 검색(실제로 검색해요)">
            <div className="catalog__w">
              <LocationInput id="catalog-location" value={location} onChange={setLocation} />
            </div>
          </Spec>
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
        <GlassCard title="<UpcomingList>" subtitle="due(다가오는 날) · since(며칠째)">
          <UpcomingList
            today={today}
            empty="일정 없음"
            items={[
              { key: '1', date: addDays(today, -1), title: '지난 일정', meta: '빨간 표시' },
              { key: '2', date: today, title: '오늘 방문', meta: '경상권 · 방문 설치' },
              { key: '3', date: addDays(today, 2), title: '모레 방문', meta: '수도권' },
            ]}
          />
        </GlassCard>
        <GlassCard title="<MiniList>" subtitle="이름 · 설명 · 오른쪽 값">
          <MiniList
            empty="없음"
            items={[
              { key: '1', title: '(P2S) 레이저 튜브', meta: 'P5010404 · P2S', value: '재고 -1', alert: true },
              { key: '2', title: '(D1) 마더보드', meta: 'D1', value: '재고 2' },
            ]}
          />
        </GlassCard>
      </div>

      <AttentionRow tiles={ATTENTION} loading={false} />

      <div className="grid king-grid">
        <KingCard
          def={KINGS[0]}
          spanLabel="이번 주"
          previousLabel="지난주"
          period={{ start: today, end: addDays(today, 6) }}
          result={{
            total: 7,
            unassigned: 1,
            rows: [
              { name: '지상헌', count: 4, facts: [{ itemId: 'f1', name: '조우진', date: today, assignees: ['지상헌'] }] },
              { name: '김다현', count: 2, facts: [] },
              { name: '이재민', count: 1, facts: [] },
            ],
          }}
          previousTop={{ name: '지상헌', count: 5, facts: [] }}
        />
        <KingCard
          def={KINGS[1]}
          spanLabel="이번 주"
          previousLabel="지난주"
          period={{ start: today, end: addDays(today, 6) }}
          result={{ total: 0, unassigned: 0, rows: [] }}
          previousTop={null}
        />
      </div>

      <TeamCard
        members={[
          { name: '이재민', open: { fieldService: 0, repair: 5, techInquiry: 1, techTask: 4, records: 1 }, openTotal: 11, visitsToday: 0, doneThisWeek: 3 },
          { name: '지상헌', open: { fieldService: 4, repair: 1, techInquiry: 1, techTask: 1, records: 0 }, openTotal: 7, visitsToday: 1, doneThisWeek: 2 },
        ]}
        me={new Set(['이재민'])}
        loading={false}
      />

      <RecordTable
        title="<RecordTable> — 줄을 누르면 <RecordDrawer>"
        records={SAMPLE_RECORDS}
        columns={COLUMNS}
        assigneesOf={(r) => r.assignees}
        searchOf={(r) => `${r.name} ${r.device}`}
        onSelect={setDrawer}
        selectedId={drawer?.itemId}
      />

      <GlassCard title="토스트 · 빈 화면">
        <div className="catalog__grid">
          <Spec name="pushToast()" note="오른쪽 아래">
            <Button variant="ghost" size="sm" onClick={() => pushToast({ tone: 'success', title: '저장했어요' })}>
              성공
            </Button>
            <Button variant="ghost" size="sm" onClick={() => pushToast({ tone: 'pending', title: '올리는 중… 45%' })}>
              진행 중
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                pushToast({ tone: 'error', title: '저장에 실패했어요', message: 'Monday에 저장하지 못했어요: 예시 오류' })
              }
            >
              실패
            </Button>
          </Spec>
          <Spec name=".bar-list__empty" note="비었을 때">
            <p className="bar-list__empty">이 기간에 접수된 건이 없어요.</p>
          </Spec>
        </div>
      </GlassCard>

      <RecordDrawer
        record={drawer ? { itemId: drawer.itemId, name: drawer.name, stage: drawer.stage, status: drawer.status } : null}
        eyebrow="견본 보드"
        onClose={() => setDrawer(null)}
        fields={drawer ? [{ label: '기기', value: drawer.device }, { label: '접수일', value: shortDate(drawer.receivedAt) }] : []}
        texts={drawer ? [{ label: '증상', text: '전원이 들어오지 않아요. (견본 글)' }] : []}
      />
    </>
  )
}

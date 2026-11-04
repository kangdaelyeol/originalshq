import { Plus, Search, Upload } from 'lucide-react'
import { lazy, Suspense, useState, type ComponentType } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/ohq-ui/components/button'
import { GlassCard } from '@/ohq-ui/components/glass-card'
import { SegmentedControl } from '@/ohq-ui/components/segmented-control'
import { CatalogSpec, SHOWCASES, UiCatalog, type ShowcaseKey } from '@/ohq-ui/lab'
import { Assignees, StagePill } from '../components/board/cells'
import { ChipPicker } from '../components/board/editors/chip-picker'
import { DateTimeInput } from '../components/board/editors/date-time-input'
import { LocationInput } from '../components/board/editors/location-input'
import { MultiSelect } from '../components/board/editors/multi-select'
import { MiniList } from '../components/board/mini-list'
import { RecordDrawer } from '../components/board/record-drawer'
import { RecordTable, type RecordColumn } from '../components/board/record-table'
import { UpcomingList } from '../components/board/upcoming-list'
import { AttentionRow } from '../components/overview/attention-row'
import { KingCard } from '../components/overview/king-card'
import { TeamCard } from '../components/overview/team-card'
import { useCurrentMember } from '../context/member-context'
import type { AttentionTile } from '../data/attention'
import { KINGS } from '../data/tech-kings'
import { pushToast } from '../data/tech-save-queue'
import type { LocationState } from '../data/tech-edit'
import { addDays, koreaToday, shortDate } from '../lib/dates'
import { XT_BASE } from '../paths'

/**
 * 디자인 — 관리자만(메뉴에서도 숨긴다). 공용 디자인 라이브러리(src/ohq-ui)의 랩을 띄운다: 공용 부품
 * 카탈로그(기본 부품)와 참고 영상을 옮긴 견본(D1~D10). tech 화면에서만 쓰는 부품은 "tech 부품"에서 본다.
 * "물 · 기본"·"물 · tech"는 D7 물 디자인으로 다시 만든 부품 묶음(ohq-ui/water, components/water).
 */
export function DesignPage() {
  const member = useCurrentMember()
  if (!member?.isAdmin) return <Navigate to={XT_BASE} replace />
  return <DesignBoard />
}

type DesignTab = 'catalog' | 'tech' | 'water' | 'water-tech' | ShowcaseKey

// 물 디자인(D7) 부품 — 견본처럼 그 탭을 열 때만 받는다(코드·스타일)
const WATER_TABS: { value: DesignTab; label: string; Component: ComponentType }[] = [
  {
    value: 'water',
    label: '물 · 기본',
    Component: lazy(() => import('@/ohq-ui/water/catalog').then((m) => ({ default: m.WaterCatalog }))),
  },
  {
    value: 'water-tech',
    label: '물 · tech',
    Component: lazy(() => import('../components/water/catalog').then((m) => ({ default: m.TechWaterCatalog }))),
  },
]

const DESIGN_TABS: { value: DesignTab; label: string }[] = [
  { value: 'catalog', label: '기본 부품' },
  { value: 'tech', label: 'tech 부품' },
  ...WATER_TABS.map(({ value, label }) => ({ value, label })),
  ...SHOWCASES.map(({ value, label }) => ({ value, label })),
]

/** 묶음 고르기 — 고른 묶음은 주소(?tab=)에 남겨 새로고침·공유해도 그대로 연다. */
function DesignBoard() {
  const [params, setParams] = useSearchParams()
  const tab = DESIGN_TABS.find((t) => t.value === params.get('tab'))?.value ?? 'catalog'
  const Showcase = [...WATER_TABS, ...SHOWCASES].find((s) => s.value === tab)?.Component
  return (
    <>
      <div className="design-tabs">
        <SegmentedControl
          ariaLabel="디자인 묶음"
          options={DESIGN_TABS}
          value={tab}
          onChange={(next) => setParams(next === 'catalog' ? {} : { tab: next }, { replace: true })}
        />
      </div>
      {tab === 'catalog' && <UiCatalog />}
      {tab === 'tech' && <TechCatalog />}
      {Showcase && (
        <Suspense fallback={<p className="showcase-stage__pending">불러오는 중이에요…</p>}>
          <Showcase />
        </Suspense>
      )}
    </>
  )
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

// ── tech 부품 카탈로그 ──────────────────────────────────────────────────────────
// 공용 부품(기본 부품 탭 — ohq-ui)이 아니라 tech 화면에서만 쓰는 부품: 보드 칸·편집 칸·개요 카드·기록 표.

function TechCatalog() {
  const [chips, setChips] = useState<string[]>(['F2'])
  const [multi, setMulti] = useState<string[]>(['방문 설치'])
  const [date, setDate] = useState({ date: today, time: '14:00' })
  const [location, setLocation] = useState<LocationState>({ address: '', detail: '', lat: '', lng: '' })
  const [drawer, setDrawer] = useState<SampleRecord | null>(null)

  return (
    <>
      <GlassCard title="보드 칸" subtitle="Monday 그룹·담당자를 그리는 칸">
        <div className="catalog__grid">
          <CatalogSpec name="<StagePill>" note="Monday 그룹 이름으로 색이 정해짐">
            <StagePill stage="새로 인입된 건 <접수>" status={null} />
            <StagePill stage="현재 진행중인 업무" status={null} />
            <StagePill stage="막힘" status={null} />
            <StagePill stage="완료" status={null} />
          </CatalogSpec>
          <CatalogSpec name="<Assignees>" note="첫 사람 + 나머지 수">
            <Assignees names={['이재민', '손대환', '지상헌']} />
          </CatalogSpec>
        </div>
      </GlassCard>

      <GlassCard title="버튼 · 고르기">
        <div className="catalog__grid">
          <CatalogSpec name=".text-link" note="글자 링크">
            <button type="button" className="text-link">
              비밀번호를 잊으셨나요?
            </button>
            <button type="button" className="text-link text-link--accent">
              회원가입
            </button>
          </CatalogSpec>
          <CatalogSpec name=".subitems__add" note="줄 더하기 · 파일 올리기">
            <button type="button" className="subitems__add">
              <Plus size={14} aria-hidden />
              품목 추가
            </button>
            <button type="button" className="subitems__add">
              <Upload size={14} aria-hidden />
              파일 올리기
            </button>
          </CatalogSpec>
          <CatalogSpec name=".icon-button">
            <button type="button" className="icon-button" aria-label="검색">
              <Search size={16} aria-hidden />
            </button>
          </CatalogSpec>
          <CatalogSpec name="<ChipPicker>" note="여러 개 켜고 끄기(담당자·기기)">
            <ChipPicker
              id="catalog-chips"
              options={['F2', 'P2S', 'DTF', 'M1 Ultra', 'S1'].map((v) => ({ value: v, label: v }))}
              selected={chips}
              onChange={setChips}
            />
          </CatalogSpec>
          <CatalogSpec name="<MultiSelect>" note="여러 개 고르는 드롭다운(출장 종류·지역)">
            <div className="catalog__w">
              <MultiSelect id="catalog-multi" options={['방문 설치', '재방문', '기타']} selected={multi} onChange={setMulti} />
            </div>
          </CatalogSpec>
          <CatalogSpec name=".check" note="체크 상자">
            <label className="check">
              <input type="checkbox" defaultChecked />
              확인함
            </label>
            <label className="check">
              <input type="checkbox" />
              확인 안 함
            </label>
          </CatalogSpec>
        </div>
      </GlassCard>

      <GlassCard title="편집 칸">
        <div className="catalog__grid">
          <CatalogSpec name="select.field__input" note="편집 패널 안에서">
            <div className="catalog__w editor">
              <select className="field__input" defaultValue="수리 중">
                <option>입고 대기</option>
                <option>수리 중</option>
                <option>발송 완료</option>
              </select>
            </div>
          </CatalogSpec>
          <CatalogSpec name="<DateTimeInput>" note="날짜·시각 한 칸 + 시각 없음">
            <div className="catalog__w">
              <DateTimeInput id="catalog-date" title="방문 일정" value={date} onChange={setDate} />
            </div>
          </CatalogSpec>
          <CatalogSpec name="<LocationInput>" note="카카오 주소 검색(실제로 검색해요)">
            <div className="catalog__w">
              <LocationInput id="catalog-location" value={location} onChange={setLocation} />
            </div>
          </CatalogSpec>
        </div>
      </GlassCard>

      <div className="grid grid--pair">
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

      <GlassCard title="토스트">
        <div className="catalog__grid">
          <CatalogSpec name="pushToast()" note="오른쪽 아래">
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
          </CatalogSpec>
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

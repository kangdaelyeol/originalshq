import { Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AddressResult, TechBoardMeta } from '../../../data/tech-boards'
import type { LocationState } from '../../../data/tech-edit'
import type { Toast } from '../../../data/tech-save-queue'
import { addDays, koreaToday, shortDate } from '../../../lib/dates'
import {
  BoardEditContext,
  type BoardEditState,
} from '../../board/board-edit-context'
import type { RecordColumn } from '../../board/record-table'
import { WaterSection, WaterSpec } from '@/ohq-ui/water/catalog/spec'
import {
  WaterButton,
  WaterChips,
  type WaterOption,
} from '@/ohq-ui/water/controls'
import type { WaterDropEffect } from '@/ohq-ui/water/fx'
import { WaterAssignees, WaterPhoneLink, WaterStagePill } from '../board/cells'
import { WaterChipPicker } from '../board/chip-picker'
import { WaterDateTimeInput } from '../board/date-time-input'
import { WaterAddButton, WaterTextLink } from '../board/links'
import { WaterLocationInput } from '../board/location-input'
import { WaterMultiSelect } from '../board/multi-select'
import { WaterRecordDrawer } from '../board/record-drawer'
import { WaterRecordTable } from '../board/record-table'
import { WaterToaster } from '../board/toaster'
import { FilesSample } from './files-sample'
import { useSampleFiles } from './sample-files'

// ── 견본 데이터(화면 안에서만 쓰는 가짜 값 — 기존 tech 부품 카탈로그와 같은 것) ─────────────

const today = koreaToday()

interface SampleRecord {
  itemId: string
  name: string
  phone: string
  device: string
  stage: string
  status: string
  receivedAt: string
  assignees: string[]
}

const SAMPLE_RECORDS: SampleRecord[] = [
  {
    itemId: 's1',
    name: '김도현',
    phone: '01012345678',
    device: 'F2',
    stage: '새로 인입된 건 <접수>',
    status: '입고 대기',
    receivedAt: addDays(today, -2),
    assignees: ['이재민'],
  },
  {
    itemId: 's2',
    name: '박서연',
    phone: '01023456789',
    device: 'P2S',
    stage: '현재 진행중인 업무',
    status: '수리 중',
    receivedAt: addDays(today, -9),
    assignees: ['이재민', '손대환'],
  },
  {
    itemId: 's3',
    name: '주식회사 노바',
    phone: '0212345678',
    device: 'DTF',
    stage: '막힘',
    status: '막힘',
    receivedAt: addDays(today, -21),
    assignees: ['지상헌'],
  },
  {
    itemId: 's4',
    name: '정유진',
    phone: '01034567890',
    device: 'M1 Ultra',
    stage: '완료',
    status: '발송 완료',
    receivedAt: addDays(today, -30),
    assignees: ['원도윤'],
  },
  {
    itemId: 's5',
    name: '한지민',
    phone: '01045678901',
    device: 'S1',
    stage: '현재 진행중인 업무',
    status: '부품 대기',
    receivedAt: addDays(today, -5),
    assignees: ['지상헌', '김다현', '이재민', '손대환'],
  },
  {
    itemId: 's6',
    name: '오세훈',
    phone: '',
    device: 'F1',
    stage: '새로 인입된 건 <접수>',
    status: '입고 대기',
    receivedAt: addDays(today, -1),
    assignees: [],
  },
]

const GROUPS = ['새로 인입된 건 <접수>', '현재 진행중인 업무', '막힘', '완료']

// 비용 재기용 300줄 — 늘 같은 값(시드 없이 차례로 돌린다)
const FAMILY = [
  '김',
  '이',
  '박',
  '최',
  '정',
  '강',
  '조',
  '윤',
  '장',
  '임',
  '한',
  '오',
]
const GIVEN = [
  '도현',
  '서연',
  '지호',
  '하은',
  '민준',
  '수아',
  '예준',
  '지우',
  '시우',
  '서윤',
  '주원',
  '하린',
]
const DEVICES = ['F2', 'P2S', 'DTF', 'M1 Ultra', 'S1', 'F1', 'D1 Pro']
const PEOPLE = ['이재민', '손대환', '지상헌', '원도윤', '김다현']
const STATUS = ['입고 대기', '수리 중', '막힘', '발송 완료']
const MANY: SampleRecord[] = Array.from({ length: 300 }, (_, i) => {
  const g = i % 7 === 0 ? 2 : i % 3 === 0 ? 3 : i % 2 === 0 ? 1 : 0
  return {
    itemId: `m${i + 1}`,
    name: `${FAMILY[i % FAMILY.length]}${GIVEN[(i * 5) % GIVEN.length]}`,
    phone: `010${String(10000000 + ((i * 7919) % 89999999)).padStart(8, '0')}`,
    device: DEVICES[(i * 3) % DEVICES.length],
    stage: GROUPS[g],
    status: STATUS[g],
    receivedAt: addDays(today, -((i * 13) % 90)),
    assignees: PEOPLE.slice(
      i % PEOPLE.length,
      (i % PEOPLE.length) + 1 + (i % 3),
    ),
  }
})

const COLUMNS: RecordColumn<SampleRecord>[] = [
  {
    key: 'name',
    header: '고객',
    sortValue: (r) => r.name,
    cell: (r) => (
      <span className="cell-person">
        <strong>{r.name}</strong>
        <small>
          {r.phone
            ? r.phone.replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, '$1-$2-$3')
            : '연락처 없음'}
        </small>
      </span>
    ),
  },
  {
    key: 'device',
    header: '기기',
    sortValue: (r) => r.device,
    cell: (r) => r.device,
  },
  {
    key: 'received',
    header: '접수일',
    sortValue: (r) => r.receivedAt,
    cell: (r) => shortDate(r.receivedAt),
    className: 'table__muted',
  },
  {
    key: 'assignee',
    header: '담당자',
    sortValue: (r) => r.assignees[0],
    cell: (r) => <WaterAssignees names={r.assignees} />,
  },
  {
    key: 'stage',
    header: '단계',
    sortValue: (r) => r.stage,
    cell: (r) => <WaterStagePill stage={r.stage} status={r.status} />,
  },
]

const assigneesOf = (r: SampleRecord) => r.assignees
const searchOf = (r: SampleRecord) => `${r.name} ${r.device} ${r.phone}`

// 견본 보드 — "새로 만들기"·"수정" 단추가 보이게(누르면 견본이라 토스트만)
const SAMPLE_META: TechBoardMeta = {
  key: 'sample',
  boardId: '0',
  name: '견본 보드',
  columns: [],
  groups: GROUPS.map((title, i) => ({ id: `g${i}`, title })),
  syncedAt: null,
  lastSync: null,
}

/** 성공 토스트가 떠 있는 시간 — 저장소(tech-save-queue SUCCESS_MS)와 같다 */
const SUCCESS_MS = 2600

/**
 * 견본만의 토스트 목록 — 앱의 기존 Toaster가 저장소(tech-save-queue)를 읽고 있어서, 견본이 pushToast를
 * 부르면 오른쪽 아래에 두 번(기존 + 물) 뜬다. 그래서 견본은 저장소와 같은 규칙(성공은 2.6초 뒤 저절로
 * 사라짐, 실패는 닫을 때까지)의 작은 목록을 따로 들고, WaterToaster를 inline으로 견본 상자 안에만 그린다.
 */
function useSampleToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Set<number>())

  useEffect(() => {
    const set = timers.current
    return () => set.forEach((h) => window.clearTimeout(h))
  }, [])

  const later = (ms: number, run: () => void) => {
    const h = window.setTimeout(() => {
      timers.current.delete(h)
      run()
    }, ms)
    timers.current.add(h)
  }
  const dismiss = (id: number) =>
    setToasts((ts) => ts.filter((t) => t.id !== id))
  const upsert = (toast: Toast) => {
    setToasts((ts) =>
      ts.some((t) => t.id === toast.id)
        ? ts.map((t) => (t.id === toast.id ? toast : t))
        : [...ts, toast],
    )
    if (toast.tone === 'success') later(SUCCESS_MS, () => dismiss(toast.id))
  }
  const push = (toast: Omit<Toast, 'id'>) => {
    const id = nextId.current++
    upsert({ ...toast, id })
    return id
  }
  return { toasts, push, upsert, dismiss, later }
}

const ROW_COUNTS: WaterOption<'few' | 'many'>[] = [
  { value: 'few', label: '견본 6줄' },
  { value: 'many', label: '300줄(비용 재기)' },
]

const EFFECTS: WaterOption<WaterDropEffect | 'none'>[] = [
  { value: 'none', label: '물방울 없음' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'splash', label: 'Splash' },
]

/**
 * tech 부품(물) — 보드 칸·편집 칸·기록 표·서랍·토스트. 기존 "tech 부품" 탭의 견본과 같은 구성. 견본마다
 * 상태를 따로 들어서(아래 *Sample) 하나를 만져도 그 견본만 다시 그린다.
 */
export function BoardSection() {
  return (
    <>
      <WaterSection title="보드 칸" note="Monday 그룹·담당자를 그리는 칸">
        <WaterSpec
          name="<WaterStagePill>"
          note="Monday 그룹 이름으로 점 색이 정해짐"
          spec="stage-pill"
        >
          <WaterStagePill stage="새로 인입된 건 <접수>" status={null} />
          <WaterStagePill stage="현재 진행중인 업무" status={null} />
          <WaterStagePill stage="막힘" status={null} />
          <WaterStagePill stage="완료" status={null} />
        </WaterSpec>
        <WaterSpec
          name="<WaterAssignees>"
          note="유리 동그라미 겹침 + 남은 수"
          spec="assignees"
        >
          <WaterAssignees names={['이재민']} />
          <WaterAssignees names={['이재민', '손대환', '지상헌']} />
          <WaterAssignees
            names={['이재민', '손대환', '지상헌', '원도윤', '김다현']}
          />
          <WaterAssignees names={[]} />
        </WaterSpec>
        <WaterSpec name="<WaterPhoneLink>" note="전화 걸기" spec="phone">
          <WaterPhoneLink phone="01012345678" />
          <WaterPhoneLink phone="0212345678" />
        </WaterSpec>
      </WaterSection>

      <WaterSection title="버튼 · 고르기">
        <WaterSpec name="<WaterTextLink>" note="글자 링크" spec="text-link">
          <WaterTextLink>비밀번호를 잊으셨나요?</WaterTextLink>
          <WaterTextLink accent>회원가입</WaterTextLink>
        </WaterSpec>
        <WaterSpec
          name="<WaterAddButton>"
          note="줄 더하기 · 파일 올리기 — 누르면 물결"
          spec="add-button"
        >
          <WaterAddButton>품목 추가</WaterAddButton>
          <WaterAddButton icon={Upload}>파일 올리기</WaterAddButton>
        </WaterSpec>
        <WaterSpec
          name="<WaterChipPicker>"
          note="여러 개 켜고 끄기 — 켤 때 물결"
          spec="chip-picker"
        >
          <ChipSample />
        </WaterSpec>
        <WaterSpec
          name="<WaterMultiSelect>"
          note="여러 개 고르는 드롭다운 — 유리가 칸에서 뻗어 나옴"
          spec="multi-select"
        >
          <MultiSample />
        </WaterSpec>
      </WaterSection>

      <WaterSection title="편집 칸">
        <WaterSpec
          name="select.water-board-select__input"
          note="편집 패널 안의 고르기 칸(기본 부품에 없어 로컬 — 입력 칸과 같은 유리 알약)"
          spec="select"
        >
          <div className="water-board-demo-w">
            <select
              className="water-board-select__input"
              defaultValue="수리 중"
              aria-label="수리 진행 상태"
            >
              <option>입고 대기</option>
              <option>수리 중</option>
              <option>발송 완료</option>
            </select>
          </div>
        </WaterSpec>
        <WaterSpec
          name="<WaterDateTimeInput>"
          note="날짜·시각 한 칸 + 시각 없음"
          spec="date-time"
        >
          <DateSample />
        </WaterSpec>
        <WaterSpec
          name="<WaterLocationInput>"
          note="견본은 가짜 검색(0.6초) — 역삼·긴 주소·없음·오류·끊김으로 찾아 보세요"
          spec="location"
        >
          <LocationSample />
        </WaterSpec>
      </WaterSection>

      <WaterSection
        title="기록 표 · 상세 서랍"
        note="줄을 누르면 오른쪽에서 <WaterRecordDrawer>가 들어와요"
      >
        <WaterSpec
          name="<WaterRecordTable>"
          note="고른 줄 뒤 표시 알약이 스프링으로 따라가요 · ↑↓로 줄 옮기기"
          wide
          spec="record-table"
        >
          <TableSample />
        </WaterSpec>
        <WaterSpec
          name="<WaterItemFiles>"
          note="서랍 속 파일 칸 — 끌어다 놓기·올리기(가짜: 빠르게·느리게·실패)·모두 지우기·크게 보기"
          wide
          spec="item-files"
        >
          <FilesSample />
        </WaterSpec>
      </WaterSection>

      <WaterSection title="토스트">
        <WaterSpec
          name="<WaterToaster>"
          note="견본 상자 안에만 그려요(앱의 기존 토스트와 두 번 뜨지 않게) — 성공하면 물결"
          wide
          spec="toaster"
        >
          <ToastSample />
        </WaterSpec>
      </WaterSection>
    </>
  )
}

function ChipSample() {
  const [chips, setChips] = useState<string[]>(['F2'])
  return (
    <WaterChipPicker
      id="water-catalog-chips"
      options={['F2', 'P2S', 'DTF', 'M1 Ultra', 'S1'].map((v) => ({
        value: v,
        label: v,
      }))}
      selected={chips}
      onChange={setChips}
    />
  )
}

function MultiSample() {
  const [multi, setMulti] = useState<string[]>(['방문 설치'])
  const [region, setRegion] = useState<string[]>([])
  return (
    <div className="water-board-demo-w water-board-demo-stack">
      <WaterMultiSelect
        id="water-catalog-multi"
        options={['방문 설치', '재방문', '기타']}
        selected={multi}
        onChange={setMulti}
      />
      <WaterMultiSelect
        id="water-catalog-region"
        options={[
          '수도권',
          '강원권',
          '충청권',
          '경상권',
          '전라권',
          '제주',
          '해외',
        ]}
        selected={region}
        onChange={setRegion}
        placeholder="지역 고르기"
      />
    </div>
  )
}

function DateSample() {
  const [date, setDate] = useState({ date: today, time: '14:00' })
  const [dateOnly, setDateOnly] = useState({
    date: addDays(today, 3),
    time: '',
  })
  return (
    <div className="water-board-demo-w water-board-demo-stack">
      <WaterDateTimeInput
        id="water-catalog-date"
        title="방문 일정"
        value={date}
        onChange={setDate}
      />
      <WaterDateTimeInput
        id="water-catalog-date2"
        title="마감일"
        value={dateOnly}
        onChange={setDateOnly}
      />
    </div>
  )
}

// 주소 검색 견본 — 에뮬레이터에는 카카오 키가 없어 카탈로그에서만 가짜로 찾는다. 모양은 실제 함수(techSearchAddress)
// 응답을 따른다: 결과는 많아야 10개(size=10), 도로명이 없으면 jibun이 null, 카카오가 실패하면 함수 메시지를 단 internal.
// "없음" → 0개, "오류" → 함수 실패, "끊김" → 연결 끊김(메시지 없는 internal), "긴" → 긴 주소, 그 밖 → 10개. 0.6초 걸린다
const FAKE_ADDRESSES: AddressResult[] = [
  ['역삼역 2호선', '서울 강남구 강남대로 396', '서울 강남구 역삼동 858', '37.4979', '127.0276'],
  ['서울 강남구 테헤란로 152', '서울 강남구 테헤란로 152', '서울 강남구 역삼동 737', '37.5000', '127.0365'],
  ['강남파이낸스센터', '서울 강남구 테헤란로 152', '서울 강남구 역삼동 737', '37.5001', '127.0366'],
  ['역삼1동 주민센터', '서울 강남구 테헤란로7길 22', '서울 강남구 역삼동 635-7', '37.4953', '127.0333'],
  ['서울 강남구 논현로 508', '서울 강남구 논현로 508', null, '37.5004', '127.0396'],
  ['역삼초등학교', '서울 강남구 역삼로 307', '서울 강남구 역삼동 711', '37.4987', '127.0466'],
  ['GS타워', '서울 강남구 논현로 508', '서울 강남구 역삼동 679', '37.5021', '127.0398'],
  ['서울 강남구 역삼동', '서울 강남구 역삼동', null, '37.4954', '127.0331'],
  ['역삼동 공영주차장', '서울 강남구 역삼동 826-20', null, '37.4968', '127.0312'],
  ['역삼문화공원', '서울 강남구 역삼로 228', '서울 강남구 역삼동 754-1', '37.4972', '127.0421'],
].map(([label, address, jibun, lat, lng]) => ({
  label: label as string,
  address: address as string,
  jibun,
  lat: lat as string,
  lng: lng as string,
}))

const LONG_ADDRESSES: AddressResult[] = [
  {
    label: '경기도 성남시 분당구 판교역로 235 에이치스퀘어 엔동 7층 소프트웨어 드림센터 제2연구동',
    address: '경기도 성남시 분당구 판교역로 235 에이치스퀘어 엔동 7층 소프트웨어 드림센터 제2연구동',
    jibun: '경기도 성남시 분당구 삼평동 681 에이치스퀘어 엔동 소프트웨어 드림센터',
    lat: '37.4020',
    lng: '127.1086',
  },
  {
    label: '세종특별자치시 도움6로 11 정부세종청사 중앙동(국무조정실·국무총리비서실) 민원실',
    address: '세종특별자치시 도움6로 11',
    jibun: '세종특별자치시 어진동 590',
    lat: '36.5040',
    lng: '127.2650',
  },
]

// httpsCallable이 던지는 FunctionsError 모양(code + 메시지)
const internalError = (message: string) =>
  Object.assign(new Error(message), { code: 'functions/internal' })

const fakeAddressSearch = (query: string) =>
  new Promise<AddressResult[]>((resolve, reject) =>
    window.setTimeout(() => {
      if (query.includes('오류'))
        reject(internalError('주소를 찾지 못했어요. 잠시 후 다시 해 주세요'))
      else if (query.includes('끊김')) reject(internalError('internal'))
      else if (query.includes('없음')) resolve([])
      else if (query.includes('긴')) resolve(LONG_ADDRESSES)
      else resolve(FAKE_ADDRESSES)
    }, 600),
  )

function LocationSample() {
  const [location, setLocation] = useState<LocationState>({
    address: '',
    detail: '',
    lat: '',
    lng: '',
  })
  return (
    <div className="water-board-demo-w">
      <WaterLocationInput
        id="water-catalog-location"
        value={location}
        onChange={setLocation}
        search={fakeAddressSearch}
      />
    </div>
  )
}

function TableSample() {
  const [drawer, setDrawer] = useState<SampleRecord | null>(null)
  const [effect, setEffect] = useState<WaterDropEffect | 'none'>('bounce')
  const [many, setMany] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  // 견본 보드 — "새로 만들기"·"수정" 단추가 보이게(누르면 견본이라 안내만)
  // 서랍의 파일 칸 — 가짜 올리기(sample-files.ts)
  const files = useSampleFiles(SAMPLE_META)
  const edit = useMemo<BoardEditState>(
    () => ({
      boardKey: 'repair',
      meta: files.meta,
      openEditor: (itemId) => {
        setNotice(
          itemId
            ? '견본이라 편집 패널은 열지 않아요'
            : '견본이라 새 항목은 만들지 않아요',
        )
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setNotice(null), SUCCESS_MS)
      },
      itemOf: files.itemOf,
    }),
    [files.meta, files.itemOf],
  )

  return (
    <BoardEditContext.Provider value={edit}>
      <div className="water-board-demo-full">
        <div className="water-board-demo-bar">
          <WaterChips
            ariaLabel="물방울 효과"
            options={EFFECTS}
            value={effect}
            onChange={setEffect}
          />
          <WaterChips
            ariaLabel="견본 줄 수"
            options={ROW_COUNTS}
            value={many ? 'many' : 'few'}
            onChange={(v) => setMany(v === 'many')}
          />
          {notice && (
            <span className="water-board-demo-note" role="status">
              {notice}
            </span>
          )}
        </div>
        <WaterRecordTable
          key={many ? 'many' : 'few'}
          title={
            many
              ? '<WaterRecordTable> — 300줄(비용 재기)'
              : '<WaterRecordTable> — 줄을 누르면 <WaterRecordDrawer>'
          }
          records={many ? MANY : SAMPLE_RECORDS}
          columns={COLUMNS}
          assigneesOf={assigneesOf}
          searchOf={searchOf}
          onSelect={setDrawer}
          selectedId={drawer?.itemId}
          pageSize={many ? 300 : undefined}
          effect={effect === 'none' ? undefined : effect}
        />
      </div>

      <WaterRecordDrawer
        fileActions={files.actions}
        record={
          drawer
            ? {
                itemId: drawer.itemId,
                name: drawer.name,
                stage: drawer.stage,
                status: drawer.status,
              }
            : null
        }
        eyebrow="견본 보드"
        onClose={() => setDrawer(null)}
        fields={
          drawer
            ? [
                {
                  label: '연락처',
                  value: <WaterPhoneLink phone={drawer.phone || null} />,
                },
                { label: '기기', value: drawer.device },
                { label: '접수일', value: shortDate(drawer.receivedAt) },
                {
                  label: '담당자',
                  value: <WaterAssignees names={drawer.assignees} />,
                },
                { label: '상태', value: drawer.status },
              ]
            : []
        }
        texts={
          drawer
            ? [
                {
                  label: '증상',
                  text: '전원이 들어오지 않아요. 어댑터를 바꿔 끼워도 같아요.\n(견본 글)',
                },
              ]
            : []
        }
      />
    </BoardEditContext.Provider>
  )
}

function ToastSample() {
  const sample = useSampleToasts()
  const progressToSuccess = () => {
    const id = sample.push({ tone: 'pending', title: '사진.jpg 올리는 중… 0%' })
    sample.later(500, () =>
      sample.upsert({ id, tone: 'pending', title: '사진.jpg 올리는 중… 62%' }),
    )
    sample.later(1300, () =>
      sample.upsert({ id, tone: 'success', title: '사진.jpg 올렸어요' }),
    )
  }
  return (
    <div className="water-board-demo-full water-board-demo-toasts">
      <div className="water-board-demo-bar">
        <WaterButton
          variant="ghost"
          size="sm"
          onClick={() => sample.push({ tone: 'success', title: '저장했어요' })}
        >
          성공
        </WaterButton>
        <WaterButton
          variant="ghost"
          size="sm"
          onClick={() => {
            // 진행 중 토스트는 닫기가 없다 — 견본은 4초 뒤 걷는다
            const id = sample.push({ tone: 'pending', title: '올리는 중… 45%' })
            sample.later(4000, () => sample.dismiss(id))
          }}
        >
          진행 중
        </WaterButton>
        <WaterButton
          variant="ghost"
          size="sm"
          onClick={() =>
            sample.push({
              tone: 'error',
              title: '저장에 실패했어요',
              message: 'Monday에 저장하지 못했어요: 예시 오류',
              action: {
                label: '다시 시도',
                run: () =>
                  sample.push({ tone: 'success', title: '다시 저장했어요' }),
              },
            })
          }
        >
          실패
        </WaterButton>
        <WaterButton variant="ghost" size="sm" onClick={progressToSuccess}>
          진행 → 성공
        </WaterButton>
      </div>
      <WaterToaster inline toasts={sample.toasts} onDismiss={sample.dismiss} />
    </div>
  )
}

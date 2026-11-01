import { CircleCheck, OctagonAlert, PackageOpen, Wrench } from 'lucide-react'
import { useCallback } from 'react'
import { Assignees, PhoneLink } from '../../components/board/cells'
import { RecordDrawer } from '../../components/board/record-drawer'
import { RecordTable, type RecordColumn } from '../../components/board/record-table'
import { UpcomingList } from '../../components/board/upcoming-list'
import { BarList } from '../../components/charts/bar-list'
import { countBy } from '../../components/charts/chart-utils'
import { GlassCard } from '../../components/ui/glass-card'
import { StatCard } from '../../components/ui/stat-card'
import { StatusPill } from '../../components/ui/status-pill'
import type { RentalRecord, TechBoardDoc } from '../../data/tech-boards'
import type { Tone } from '../../data/types'
import { formatPhone } from '../../data/tech-stage'
import { byDateAsc, koreaToday, shortDate } from '../../lib/dates'
import { useItemParam } from '../../lib/use-item-param'

type R = RentalRecord

/** 대여 상태 — 상태 칸(없으면 그룹 이름)으로 가른다. */
type Phase = 'available' | 'rented' | 'checking' | 'broken' | 'other'
const phaseOf = (r: R): Phase => {
  const text = `${r.status ?? ''} ${r.stage ?? ''}`
  if (/불량/.test(text)) return 'broken'
  if (/점검/.test(text)) return 'checking'
  if (/대여\s*중/.test(text)) return 'rented'
  if (/가능/.test(text)) return 'available'
  return 'other'
}
const PHASE: Record<Phase, { label: string; tone: Tone }> = {
  available: { label: '대여 가능', tone: 'good' },
  rented: { label: '대여 중', tone: 'info' },
  checking: { label: '회수 후 점검', tone: 'warn' },
  broken: { label: '불량', tone: 'crit' },
  other: { label: '기타', tone: 'neutral' },
}

const assigneesOf = (r: R) => r.assignees
const searchOf = (r: R) => [r.name, r.serialNumber, r.renter, r.renterPhone, ...r.assignees].join(' ')

const COLUMNS: RecordColumn<R>[] = [
  { key: 'name', header: '기기', sortValue: (r) => r.name, cell: (r) => <strong className="cell-title">{r.name || '(이름 없음)'}</strong> },
  { key: 'sn', header: 'SN', sortValue: (r) => r.serialNumber, cell: (r) => <span className="table__mono">{r.serialNumber ?? '—'}</span> },
  {
    key: 'renter',
    header: '대여자',
    sortValue: (r) => r.renter,
    cell: (r) =>
      r.renter ? (
        <span className="cell-person">
          <strong>{r.renter}</strong>
          <small>{formatPhone(r.renterPhone) ?? '연락처 없음'}</small>
        </span>
      ) : (
        <span className="table__muted">—</span>
      ),
  },
  { key: 'rented', header: '대여일', sortValue: (r) => r.rentedAt, cell: (r) => shortDate(r.rentedAt), className: 'table__muted' },
  { key: 'returned', header: '회수일', sortValue: (r) => r.returnedAt, cell: (r) => shortDate(r.returnedAt), className: 'table__muted' },
  { key: 'assignee', header: '담당자', sortValue: (r) => r.assignees[0], cell: (r) => <Assignees names={r.assignees} /> },
  {
    key: 'stage',
    header: '상태',
    sortValue: (r) => r.stage,
    cell: (r) => (
      <StatusPill tone={PHASE[phaseOf(r)].tone} dot>
        {r.status ?? PHASE[phaseOf(r)].label}
      </StatusPill>
    ),
  },
]

/** 대여품 관리 — 대여 기기가 지금 어디 있는지: 대여 가능 → 대여 중 → 회수 후 점검(→ 불량). */
export function RentalsBoard({ doc }: { doc: TechBoardDoc<'rentals'> }) {
  const [selectedId, setSelectedId] = useItemParam()
  const close = useCallback(() => setSelectedId(null), [setSelectedId])
  const today = koreaToday()
  const records = doc.records
  const count = (phase: Phase) => records.filter((r) => phaseOf(r) === phase).length
  const rented = records.filter((r) => phaseOf(r) === 'rented' && r.rentedAt).sort((a, b) => byDateAsc(a.rentedAt, b.rentedAt))
  const selected = records.find((r) => r.itemId === selectedId) ?? null

  return (
    <>
      <div className="grid grid--kpi">
        <StatCard title="대여 가능" value={`${count('available')}대`} icon={CircleCheck} tint="green" caption="바로 내보낼 수 있음" />
        <StatCard title="대여 중" value={`${count('rented')}대`} icon={PackageOpen} tint="blue" caption="고객에게 나가 있음" />
        <StatCard title="회수 후 점검" value={`${count('checking')}대`} icon={Wrench} tint="amber" caption="돌아와서 확인 중" />
        <StatCard title="불량" value={`${count('broken')}대`} icon={OctagonAlert} tint="violet" caption="쓸 수 없는 기기" />
      </div>

      <div className="grid grid--pair">
        <GlassCard title="오래 나가 있는 대여품" subtitle={`${rented.length}대`}>
          <UpcomingList
            mode="since"
            today={today}
            empty="대여 중인 기기가 없어요."
            items={rented.slice(0, 6).map((r) => ({
              key: r.itemId,
              date: r.rentedAt!,
              title: r.name || '(이름 없음)',
              meta: [r.renter, r.serialNumber].filter(Boolean).join(' · '),
              onSelect: () => setSelectedId(r.itemId),
            }))}
          />
        </GlassCard>
        <GlassCard title="기기별 대여품" subtitle={`전체 ${records.length}대`}>
          <BarList items={countBy(records.map((r) => r.name))} unit="대" ariaLabel="기기별 대여품 수" />
        </GlassCard>
      </div>

      <RecordTable
        title="대여품 목록"
        records={records}
        columns={COLUMNS}
        assigneesOf={assigneesOf}
        searchOf={searchOf}
        progress={false}
        onSelect={(r) => setSelectedId(r.itemId)}
        selectedId={selectedId}
        searchPlaceholder="기기·SN·대여자 검색"
      />

      <RecordDrawer
        record={selected}
        eyebrow={doc.name}
        onClose={close}
        fields={
          selected
            ? [
                { label: 'SN', value: selected.serialNumber },
                { label: '상태', value: selected.status },
                { label: '담당자', value: selected.assignees.join(', ') || null },
                { label: '대여자', value: selected.renter },
                { label: '연락처', value: selected.renterPhone ? <PhoneLink phone={selected.renterPhone} /> : null },
                { label: '대여일', value: selected.rentedAt ? shortDate(selected.rentedAt) : null },
                { label: '발송 예정일', value: selected.shipAt ? shortDate(selected.shipAt) : null },
                { label: '회수일', value: selected.returnedAt ? shortDate(selected.returnedAt) : null },
              ]
            : []
        }
      />
    </>
  )
}
